"""Select compact, traceable LeafAI evidence for a chat question."""

import re
from collections import Counter

from plant_knowledge import PLANT_KNOWLEDGE


HISTORY_TERMS = re.compile(
    r"\b(previous|past|recent|latest|last|history|scans?|results?|trends?|recorded|detected)\b|\bhow many\b",
    re.IGNORECASE,
)
HISTORY_SUBJECT = re.compile(r"\b(my|our|saved|scan|scans|history|recorded|previous|past|latest|recent)\b", re.I)
WORD = re.compile(r"[a-z]+(?:['’-][a-z]+)?", re.I)


def _edit_distance_one(left, right):
    if abs(len(left) - len(right)) > 1:
        return False
    if len(left) > len(right):
        left, right = right, left
    i = j = differences = 0
    while i < len(left) and j < len(right):
        if left[i] == right[j]:
            i += 1
            j += 1
        else:
            differences += 1
            if differences > 1:
                return False
            if len(left) == len(right):
                i += 1
            j += 1
    return differences + (j < len(right)) == 1


def _name_forms():
    forms = {}
    for name, entry in PLANT_KNOWLEDGE.items():
        for form in [name, *entry.get("aliases", [])]:
            normalized = re.sub(r"\s+", " ", str(form).lower().strip())
            forms[normalized] = name
            if normalized.endswith("y"):
                forms[normalized[:-1] + "ies"] = name
            elif normalized.endswith(("s", "x", "z", "ch", "sh", "o")):
                forms[normalized + "es"] = name
                forms[normalized + "s"] = name
            else:
                forms[normalized + "s"] = name
    return forms


NAME_FORMS = _name_forms()


def resolve_plant(text):
    """Resolve an exact/alias/plural plant, then one unambiguous edit away."""
    lowered = re.sub(r"\s+", " ", str(text or "").lower())
    exact = set()
    for form, name in NAME_FORMS.items():
        if re.search(rf"(?<!\w){re.escape(form)}(?!\w)", lowered):
            exact.add(name)
    if len(exact) == 1:
        return next(iter(exact)), None
    if len(exact) > 1:
        return None, sorted(exact)

    words = WORD.findall(lowered)
    candidates = set()
    for word in words:
        for form, name in NAME_FORMS.items():
            if " " not in form and _edit_distance_one(word, form):
                candidates.add(name)
    if len(candidates) == 1:
        return next(iter(candidates)), None
    if len(candidates) > 1:
        return None, sorted(candidates)
    return None, None


def _explicit_unknown_plant(question):
    """Catch crop-shaped mentions so they cannot silently fall back to UI state."""
    patterns = (
        r"\bmy\s+([a-z]+)\s+(?:is|are|has|have|looks|seems)\b",
        r"\b([a-z]+(?:\s+[a-z]+)?)\s+(?:plant|crop|leaves|leaf|problems|diseases|symptoms)\b",
        r"\b(?:about|for|of|on|affect)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:plant|crop|leaves|leaf|disease|diseases|symptoms|treatment|treatments)\b",
        r"\b(?:affect|on|in)\s+([a-z]+)\b",
        r"^\s*([a-z]+)\s*(?:\?|$)",
        r"^\s*(?:how do i care for|care for|growing conditions for|what about|tell me about)\s+([a-z]+)\b",
        r"^\s*([a-z]+)\s+(?:care|diseases|symptoms|treatments)\b",
    )
    known_forms = set(NAME_FORMS)
    for pattern in patterns:
        match = re.search(pattern, question.lower())
        if match:
            candidate = re.sub(r"\s+", " ", match.group(1).strip())
            while candidate.split(" ", 1)[0] in {"my", "our", "the", "a", "an", "these", "those"}:
                candidate = candidate.split(" ", 1)[1] if " " in candidate else ""
            if candidate not in known_forms and candidate not in {"my", "the", "this", "these", "those", "it", "them", "one"}:
                return candidate
    return None


def _history_topic(history):
    if not isinstance(history, list):
        return None
    for item in reversed(history[-8:]):
        if not isinstance(item, dict) or item.get("role") not in ("user", "bot"):
            continue
        name, _ = resolve_plant(item.get("text", ""))
        if name:
            return name
    return None


def collect_evidence(question, context=None, scan_history=None, use_scan_history=False, history=None):
    """Return model-ready facts and source metadata derived only from app data."""
    context = context if isinstance(context, dict) else {}
    scans = scan_history if isinstance(scan_history, list) else []
    explicit_plant, ambiguous = resolve_plant(question)
    explicit_unknown = _explicit_unknown_plant(question) if not explicit_plant and not ambiguous else None
    wants_history = bool(HISTORY_TERMS.search(question) and HISTORY_SUBJECT.search(question))
    plants = []
    resolution = "question" if explicit_plant else None

    if ambiguous:
        return {"facts": [], "sources": [], "used_scan_history": False,
                "resolved_plant": None, "plant_resolution": "ambiguous", "candidates": ambiguous,
                "explicit_history": wants_history, "history_summary": None}
    if explicit_plant:
        plants = [explicit_plant]
    elif not explicit_unknown:
        topic = _history_topic(history)
        if topic:
            plants, resolution = [topic], "conversation"
        else:
            context_plant = str(context.get("plant") or "").strip()
            selected, _ = resolve_plant(context_plant)
            if selected:
                plants, resolution = [selected], "selected"

    facts = []
    sources = []
    lowered = question.lower()
    disease_question = bool(re.search(r"\b(disease|diseases|symptom|symptoms|treatment|treatments|condition|problem|spots|blight)\b", lowered))
    for name in plants:
        entry = PLANT_KNOWLEDGE[name]
        summary = {key: entry.get(key) for key in ("definition", "climate", "temperature_range", "soil") if entry.get(key)}
        matched = {disease: data for disease, data in entry.get("diseases", {}).items()
                   if disease in lowered or disease in str(context.get("disease") or "").lower()}
        if disease_question and not matched:
            matched = {key: value for key, value in entry.get("diseases", {}).items() if key != "healthy"}
        if matched:
            summary["diseases"] = matched
        facts.append({"type": "plant_knowledge", "plant": name, "data": summary})
        sources.append({"type": "knowledge", "label": f"{name.title()} knowledge", "detail": ", ".join(summary.keys())})

    history_summary = None
    add_history = not explicit_unknown and (wants_history or bool(use_scan_history))
    if add_history:
        relevant = [scan for scan in scans if isinstance(scan, dict)]
        if plants:
            relevant = [scan for scan in relevant if resolve_plant(scan.get("plant", ""))[0] in plants]
        relevant.sort(key=lambda scan: str(scan.get("timestamp") or ""), reverse=True)
        conditions = Counter(str(scan.get("disease") or "Unknown") for scan in relevant)
        records = [{key: scan.get(key) for key in ("id", "timestamp", "plant", "disease", "confidence", "severity", "needs_review")}
                   for scan in relevant[:8]]
        history_summary = {"total_matching_scans": len(relevant), "condition_counts": dict(conditions.most_common(12)),
                           "records_shown": len(records), "recent_records": records}
        if wants_history:
            facts.append({"type": "scan_history", **history_summary})
        elif plants and relevant:
            facts.append({"type": "supporting_scan_history", **history_summary})
        for scan in relevant[:8]:
            sources.append({"type": "scan", "label": f"{scan.get('plant', 'Plant')} early-screening scan · {str(scan.get('timestamp') or 'undated')[:10]}",
                            "detail": f"{scan.get('disease', 'Unknown')} · {scan.get('severity', 'Unknown')} severity",
                            "id": str(scan.get("id") or scan.get("timestamp") or "")})

    return {"facts": facts, "sources": sources, "used_scan_history": bool(add_history),
            "resolved_plant": plants[0] if plants else None, "plant_resolution": resolution,
            "explicit_unknown_plant": explicit_unknown, "explicit_history": wants_history,
            "history_summary": history_summary}
