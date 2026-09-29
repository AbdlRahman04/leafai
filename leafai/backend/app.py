from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import json
import io
import uuid
import os
import mimetypes
import hashlib
import threading
import sys
from urllib.parse import urlparse
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sklearn.metrics import confusion_matrix
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from reportlab.lib.utils import ImageReader
from plant_knowledge import PLANT_KNOWLEDGE
from llm_service import ask_llm
from chat_grounding import collect_evidence
from utils import (
    split_class_label,
    normalize_plant_name,
    normalize_disease_name,
    get_top_predictions,
    is_confident_prediction
)
from datetime import datetime
from automation_store import (
    add_alert,
    ensure_runtime_files,
    get_alerts,
    get_config as get_automation_config,
    get_status as get_automation_status,
    mark_alert_read,
    request_manual_run,
    save_config as save_automation_config,
)

app = Flask(__name__)
CORS(app)

# Anchor backend assets to this module so launch location cannot change paths.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
KERAS_MODEL_PATH = os.path.join(BACKEND_DIR, "models", "plant_disease_model.keras")
H5_MODEL_PATH = os.path.join(BACKEND_DIR, "models", "plant_disease_model.h5")
CLASS_INDEX_PATH = os.path.join(BACKEND_DIR, "models", "class_indices.json")
IMG_SIZE = (128, 128)

# ── Cache configuration ──────────────────────────────────────────
# Toggle caching: comment/uncomment the line below to disable/enable
USE_CACHE = True        # ← Set to False or comment out to disable caching
# USE_CACHE = False     # ← Uncomment this line to disable caching

CACHE_DIR = os.path.join(BACKEND_DIR, "cache")
CACHE_PATH = os.path.join(CACHE_DIR, "performance_cache.json")
PERFORMANCE_HISTORY_PATH = os.path.join(CACHE_DIR, "performance_history.json")
if USE_CACHE:
    os.makedirs(CACHE_DIR, exist_ok=True)

STORAGE_DIR = os.path.join(BACKEND_DIR, "storage")
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")
PREDICTIONS_PATH = os.path.join(STORAGE_DIR, "predictions.json")
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
ensure_runtime_files()

print("="*50)
print("LOADING MODEL...")
print("="*50)

model = None
MODEL_PATH = None
model_load_errors = []

def concise_model_error(error):
    message = str(error)
    return message.split("Full object config:", 1)[0].strip()

for candidate_path in (KERAS_MODEL_PATH, H5_MODEL_PATH):
    if not os.path.exists(candidate_path):
        continue
    try:
        model = tf.keras.models.load_model(candidate_path, compile=False)
        MODEL_PATH = candidate_path
        print(f"[OK] Model loaded successfully: {candidate_path}")
        break
    except Exception as error:
        short_error = concise_model_error(error)
        model_load_errors.append(f"{candidate_path}: {short_error}")
        print(f"[WARN] Could not load model {candidate_path}: {short_error}")

if model is None:
    print("[ERROR] No usable model could be loaded.")
    for error in model_load_errors:
        print(f"        {error}")
    exit(1)

try:
    with open(CLASS_INDEX_PATH, "r") as f:
        class_indices = json.load(f)
    print(f"[OK] Loaded {len(class_indices)} classes")
    class_names = {v: k for k, v in class_indices.items()}
    output_count = model.output_shape[-1]
    if output_count != len(class_indices):
        raise ValueError(
            f"Model output count ({output_count}) does not match "
            f"class mapping count ({len(class_indices)})"
        )
    print(f"[OK] Model output matches {output_count} classes")
except Exception as e:
    print(f"[ERROR] Error loading class indices: {e}")
    exit(1)

DATASET_PATH = os.path.join(BACKEND_DIR, "dataset", "PlantVillage", "color")
cached_confusion_matrix = None
cached_accuracy = None
cached_labels = None
cached_validation_sample_count = None
cached_model_evaluated_at = None
previous_cached_accuracy = None


def model_signature():
    """Return a lightweight identity for the deployed model and class map."""
    signature = []
    for path in (MODEL_PATH, CLASS_INDEX_PATH):
        try:
            stat = os.stat(path)
            signature.append({"path": os.path.basename(path), "size": stat.st_size, "mtime_ns": stat.st_mtime_ns})
        except OSError:
            signature.append({"path": os.path.basename(path), "missing": True})
    return signature


def model_preprocessing_mode():
    """Return the preprocessing used by the matching training run."""
    return (
        "mobilenet_v2"
        if MODEL_PATH and MODEL_PATH.lower().endswith(".keras")
        else "rescale_1_255"
    )


def record_accuracy_snapshot():
    """Persist model evaluation snapshots so the Dashboard can show a real trend."""
    global previous_cached_accuracy
    if cached_accuracy is None:
        return

    history = []
    if os.path.exists(PERFORMANCE_HISTORY_PATH):
        try:
            with open(PERFORMANCE_HISTORY_PATH, "r", encoding="utf-8") as file:
                history = json.load(file)
        except (OSError, json.JSONDecodeError):
            history = []

    current_timestamp = cached_model_evaluated_at or "current"
    if history and history[-1].get("timestamp") == current_timestamp:
        previous_cached_accuracy = history[-2].get("accuracy") if len(history) > 1 else None
        return

    previous_cached_accuracy = history[-1].get("accuracy") if history else None
    history.append({"accuracy": cached_accuracy, "timestamp": current_timestamp})
    temporary_path = f"{PERFORMANCE_HISTORY_PATH}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        json.dump(history, file, indent=2)
    os.replace(temporary_path, PERFORMANCE_HISTORY_PATH)


def load_prediction_log():
    if not os.path.exists(PREDICTIONS_PATH):
        return []

    try:
        with open(PREDICTIONS_PATH, "r", encoding="utf-8") as file:
            saved_predictions = json.load(file)
        if not isinstance(saved_predictions, list):
            raise ValueError("saved predictions must be a JSON array")
        return [entry for entry in saved_predictions if isinstance(entry, dict)]
    except (OSError, json.JSONDecodeError) as error:
        print(f"[WARN] Could not load saved predictions: {error}")
        return []


def save_prediction_log():
    temporary_path = f"{PREDICTIONS_PATH}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        json.dump(prediction_log, file, indent=2, ensure_ascii=False)
    os.replace(temporary_path, PREDICTIONS_PATH)


def get_scan_image_filename(entry):
    """Return a safe image filename for a saved scan, including legacy records."""
    filename = entry.get("scan_image_filename")
    if not filename:
        filename = os.path.basename(urlparse(entry.get("scan_image", "")).path)
    return os.path.basename(filename) if filename else ""


def remove_scan_image(entry):
    filename = get_scan_image_filename(entry)
    if not filename:
        return
    image_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.isfile(image_path):
        try:
            os.remove(image_path)
        except OSError as error:
            print(f"[WARN] Could not remove scan image {image_path}: {error}")


def scan_image_url(filename):
    return f"{request.host_url.rstrip('/')}/uploads/{filename}"


def prediction_response(entry, duplicate=False):
    """Convert a persisted prediction into the public prediction response shape."""
    response = {
        "id": entry.get("id"),
        "timestamp": entry.get("timestamp", ""),
        "run_key": entry.get("run_key"),
        "run_number": entry.get("run_number"),
        "run_label": entry.get("run_label"),
        "class_key": entry.get("class_key"),
        "class_name": entry.get("class_name"),
        "plant": entry.get("plant", "Unknown"),
        "disease": entry.get("disease", "Unknown"),
        "confidence": round(entry.get("confidence", 0), 2),
        "confidence_spread": entry.get("confidence_spread", 0),
        "is_confident": entry.get("is_confident", True),
        "needs_review": entry.get("needs_review", False),
        "severity": entry.get("severity", "Unknown"),
        "advice": entry.get("advice", ""),
        "scan_image": scan_image_url(get_scan_image_filename(entry)) if get_scan_image_filename(entry) else None,
        "healthy_image": entry.get("healthy_image"),
        "top_predictions": entry.get("top_predictions", []),
        "geography": entry.get("geography", {}),
        "duplicate": duplicate,
        "status": "duplicate" if duplicate else "saved",
        "source": entry.get("source", "manual"),
        "automation": entry.get("automation"),
    }
    if entry.get("warning"):
        response["warning"] = entry["warning"]
    return response


def create_automation_prediction_alerts(entry):
    """Turn actionable scheduled-scan results into de-duplicated dashboard alerts."""
    if entry.get("source") != "automation":
        return

    plant_label = (entry.get("automation") or {}).get("plant_label") or entry.get("plant") or "Plant"
    class_key = entry.get("class_key", entry.get("disease", "unknown"))
    if entry.get("severity") in {"High", "Moderate"}:
        severity = "error" if entry["severity"] == "High" else "warning"
        add_alert(
            "disease_detected",
            f"{entry['severity']} severity detected",
            f"{plant_label}: {entry.get('plant', 'Unknown')} — {entry.get('disease', 'Unknown')}",
            severity=severity,
            prediction_id=entry.get("id"),
            dedupe_key=f"disease:{class_key}",
        )
    if entry.get("needs_review"):
        add_alert(
            "prediction_review",
            "Automated scan needs review",
            f"{plant_label}: {entry.get('warning') or 'The prediction is uncertain.'}",
            severity="warning",
            prediction_id=entry.get("id"),
            dedupe_key=f"review:{class_key}",
        )


prediction_log_lock = threading.Lock()
run_assignments = {}


def get_file_sha256(file_path):
    """Return the SHA-256 fingerprint for a stored upload, or None if unavailable."""
    try:
        digest = hashlib.sha256()
        with open(file_path, "rb") as image_file:
            for chunk in iter(lambda: image_file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except (OSError, IOError):
        return None


def migrate_prediction_log(entries):
    """Backfill fingerprints, run metadata, and remove duplicate legacy records safely."""
    migrated_entries = []
    fingerprints = {}
    changed = False
    existing_run_numbers = [
        int(entry["run_number"])
        for entry in entries
        if str(entry.get("run_number", "")).isdigit()
    ]
    next_run_number = max(existing_run_numbers, default=0) + 1

    for entry in entries:
        if not str(entry.get("run_number", "")).isdigit():
            entry["run_number"] = next_run_number
            entry["run_key"] = f"legacy-{entry.get('id') or next_run_number}"
            entry["run_label"] = f"Run #{next_run_number}"
            next_run_number += 1
            changed = True
        else:
            entry["run_number"] = int(entry["run_number"])
            if not entry.get("run_key"):
                entry["run_key"] = f"legacy-{entry.get('id') or entry['run_number']}"
                changed = True
            if entry.get("run_label") != f"Run #{entry['run_number']}":
                entry["run_label"] = f"Run #{entry['run_number']}"
                changed = True

        filename = get_scan_image_filename(entry)
        file_path = os.path.join(UPLOAD_DIR, filename) if filename else ""
        fingerprint = get_file_sha256(file_path) if file_path else None
        if fingerprint:
            if entry.get("image_sha256") != fingerprint:
                entry["image_sha256"] = fingerprint
                changed = True

            previous_index = fingerprints.get(fingerprint)
            if previous_index is not None:
                previous_entry = migrated_entries[previous_index]
                if get_scan_image_filename(previous_entry) != filename:
                    remove_scan_image(previous_entry)
                migrated_entries[previous_index] = entry
                changed = True
                continue
            fingerprints[fingerprint] = len(migrated_entries)

        migrated_entries.append(entry)

    return migrated_entries, changed


prediction_log = load_prediction_log()
prediction_log, prediction_log_migrated = migrate_prediction_log(prediction_log)
if not os.path.exists(PREDICTIONS_PATH) or prediction_log_migrated:
    save_prediction_log()


def get_run_info(run_key):
    """Return the persisted run identity, creating the next number when needed."""
    assigned_run = run_assignments.get(run_key)
    if assigned_run:
        return assigned_run

    for entry in prediction_log:
        if entry.get("run_key") == run_key:
            assigned_run = (entry.get("run_key"), entry.get("run_number"), entry.get("run_label"))
            run_assignments[run_key] = assigned_run
            return assigned_run

    run_numbers = [
        int(entry["run_number"])
        for entry in prediction_log
        if str(entry.get("run_number", "")).isdigit()
    ]
    run_number = max(run_numbers, default=0) + 1
    assigned_run = (run_key, run_number, f"Run #{run_number}")
    run_assignments[run_key] = assigned_run
    return assigned_run

severity_map = {
    "Apple___Apple_scab": "Moderate",
    "Apple___Black_rot": "High",
    "Apple___Cedar_apple_rust": "Moderate",
    "Apple___healthy": "None",
    "Blueberry___healthy": "None",
    "Cherry_(including_sour)___Powdery_mildew": "Moderate",
    "Cherry_(including_sour)___healthy": "None",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Moderate",
    "Corn_(maize)___Common_rust_": "Moderate",
    "Corn_(maize)___Northern_Leaf_Blight": "High",
    "Corn_(maize)___healthy": "None",
    "Grape___Black_rot": "High",
    "Grape___Esca_(Black_Measles)": "High",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Moderate",
    "Grape___healthy": "None",
    "Orange___Haunglongbing_(Citrus_greening)": "High",
    "Peach___Bacterial_spot": "Moderate",
    "Peach___healthy": "None",
    "Pepper,_bell___Bacterial_spot": "Moderate",
    "Pepper,_bell___healthy": "None",
    "Potato___Early_blight": "Moderate",
    "Potato___Late_blight": "High",
    "Potato___healthy": "None",
    "Raspberry___healthy": "None",
    "Soybean___healthy": "None",
    "Squash___Powdery_mildew": "Moderate",
    "Strawberry___Leaf_scorch": "Moderate",
    "Strawberry___healthy": "None",
    "Tomato___Bacterial_spot": "Moderate",
    "Tomato___Early_blight": "Moderate",
    "Tomato___Late_blight": "High",
    "Tomato___Leaf_Mold": "Moderate",
    "Tomato___Septoria_leaf_spot": "Moderate",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Moderate",
    "Tomato___Target_Spot": "Moderate",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "High",
    "Tomato___Tomato_mosaic_virus": "High",
    "Tomato___healthy": "None",
}

expert_advice = {
    "Apple___Apple_scab": "Apple scab is a fungal disease. Remove infected leaves and apply fungicides early.",
    "Apple___Black_rot": "Black rot affects leaves, fruit, and bark. Prune infected branches.",
    "Apple___Cedar_apple_rust": "Remove nearby juniper plants and apply fungicide.",
    "Apple___healthy": "The apple plant appears healthy. Continue good sanitation.",
    "Blueberry___healthy": "The blueberry plant appears healthy. Maintain acidic soil.",
    "Cherry_(including_sour)___Powdery_mildew": "Apply sulfur-based fungicides and improve air circulation.",
    "Cherry_(including_sour)___healthy": "Continue routine inspection and balanced irrigation.",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Use crop rotation and residue management.",
    "Corn_(maize)___Common_rust_": "Resistant hybrids are recommended.",
    "Corn_(maize)___Northern_Leaf_Blight": "Use resistant varieties and fungicides.",
    "Corn_(maize)___healthy": "Continue proper fertilization and field scouting.",
    "Grape___Black_rot": "Remove infected clusters and apply fungicides early.",
    "Grape___Esca_(Black_Measles)": "Prune infected wood and protect pruning wounds.",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Improve airflow and apply fungicides.",
    "Grape___healthy": "Maintain good irrigation and vineyard sanitation.",
    "Orange___Haunglongbing_(Citrus_greening)": "Remove infected trees and control insect vectors.",
    "Peach___Bacterial_spot": "Use copper sprays and avoid overhead irrigation.",
    "Peach___healthy": "Maintain orchard hygiene and regular monitoring.",
    "Pepper,_bell___Bacterial_spot": "Use disease-free seeds and copper-based sprays.",
    "Pepper,_bell___healthy": "Continue proper irrigation and inspection.",
    "Potato___Early_blight": "Apply fungicide and rotate crops.",
    "Potato___Late_blight": "Remove infected plants immediately and apply fungicides.",
    "Potato___healthy": "Continue crop rotation and regular field checks.",
    "Raspberry___healthy": "Maintain spacing and routine inspection.",
    "Soybean___healthy": "Maintain balanced nutrient management.",
    "Squash___Powdery_mildew": "Remove affected leaves and improve airflow.",
    "Strawberry___Leaf_scorch": "Remove infected leaves and apply fungicides.",
    "Strawberry___healthy": "Maintain proper irrigation and spacing.",
    "Tomato___Bacterial_spot": "Use copper sprays and clean plant debris.",
    "Tomato___Early_blight": "Apply fungicides and remove infected foliage.",
    "Tomato___Late_blight": "Remove infected plants and reduce leaf wetness.",
    "Tomato___Leaf_Mold": "Improve ventilation and reduce humidity.",
    "Tomato___Septoria_leaf_spot": "Remove lower infected leaves and apply fungicides.",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Use insecticidal soap and reduce plant stress.",
    "Tomato___Target_Spot": "Improve airflow and crop rotation.",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Remove infected plants and control whiteflies.",
    "Tomato___Tomato_mosaic_virus": "Remove infected plants and disinfect tools.",
    "Tomato___healthy": "Continue proper irrigation and monitoring.",
}

healthy_map = {
    "Apple": "apple.jpg",
    "Blueberry": "blueberry.jpg",
    "Cherry_(including_sour)": "cherry.jpg",
    "Corn_(maize)": "corn.jpg",
    "Grape": "grape.jpg",
    "Orange": "orange.jpg",
    "Peach": "peach.jpg",
    "Pepper,_bell": "pepper.jpg",
    "Potato": "potato.jpg",
    "Raspberry": "raspberry.jpg",
    "Soybean": "soybean.jpg",
    "Squash": "squash.jpg",
    "Strawberry": "strawberry.jpg",
    "Tomato": "tomato.jpg",
}

def compute_model_performance(force_refresh=False):
    global cached_confusion_matrix, cached_accuracy, cached_labels
    global cached_validation_sample_count, cached_model_evaluated_at
    current_signature = model_signature()
    preprocessing_mode = model_preprocessing_mode()
    
    # ── Try loading from disk cache first (instant startup) ───────
    if USE_CACHE and os.path.exists(CACHE_PATH) and not force_refresh:
        try:
            with open(CACHE_PATH, "r") as f:
                cache = json.load(f)
            if (
                cache.get("model_signature") == current_signature
                and cache.get("preprocessing") == preprocessing_mode
            ):
                cached_confusion_matrix = cache["confusion_matrix"]
                cached_accuracy = cache["accuracy"]
                cached_labels = cache["labels"]
                cached_validation_sample_count = cache.get("validation_sample_count")
                cached_model_evaluated_at = cache.get("computed_at")
                print(f"[OK] Loaded cached performance from {CACHE_PATH}")
                print(f"     Accuracy: {cached_accuracy}%  |  Labels: {cached_labels}")
                return
            print("[INFO] Model, class mapping, or preprocessing changed; recomputing performance cache...")
        except Exception as e:
            print(f"[WARN] Cache file corrupted, recomputing... ({e})")
    
    # ── No cache found — compute from dataset ────────────────────
    if not os.path.exists(DATASET_PATH):
        print(f"Dataset path not found: {DATASET_PATH}")
        cached_accuracy = 85.0
        return
    
    print("Computing confusion matrix (first run, will be cached)...")
    
    try:
        if preprocessing_mode == "mobilenet_v2":
            datagen = ImageDataGenerator(
                preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input
            )
        else:
            datagen = ImageDataGenerator(rescale=1.0 / 255)
        generator = datagen.flow_from_directory(
            DATASET_PATH,
            target_size=IMG_SIZE,
            batch_size=32,
            class_mode="categorical",
            shuffle=False
        )
        
        predictions = model.predict(generator, verbose=1)
        y_pred = np.argmax(predictions, axis=1)
        y_true = generator.classes
        
        cm = confusion_matrix(y_true, y_pred)
        accuracy = round(np.sum(y_pred == y_true) / len(y_true) * 100, 2)
        
        class_counts = np.bincount(y_true)
        top_indices = np.argsort(class_counts)[-5:] if len(class_counts) >= 5 else range(len(class_counts))
        top_cm = cm[np.ix_(top_indices, top_indices)]
        
        cached_confusion_matrix = top_cm.tolist()
        cached_labels = [list(generator.class_indices.keys())[i] for i in top_indices]
        cached_accuracy = accuracy
        cached_validation_sample_count = len(y_true)
        cached_model_evaluated_at = datetime.now().isoformat()
        
        # ── Save to disk cache ───────────────────────────────────
        if USE_CACHE:
            cache_data = {
                "confusion_matrix": cached_confusion_matrix,
                "accuracy": cached_accuracy,
                "labels": cached_labels,
                "validation_sample_count": cached_validation_sample_count,
                "computed_at": cached_model_evaluated_at,
                "model_signature": current_signature,
                "preprocessing": preprocessing_mode,
            }
            with open(CACHE_PATH, "w") as f:
                json.dump(cache_data, f, indent=2)
            print(f"[OK] Cached results saved to {CACHE_PATH}")
        print(f"[OK] Accuracy: {accuracy}%")
    except Exception as e:
        print(f"Error: {e}")
        cached_accuracy = 85.0

def generate_heatmap_image():
    global cached_confusion_matrix, cached_labels
    
    if cached_confusion_matrix is None or cached_labels is None:
        return None
    
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(cached_confusion_matrix, annot=True, fmt="d", cmap="Greens", xticklabels=cached_labels, yticklabels=cached_labels, ax=ax)
    plt.xticks(rotation=45, ha="right")
    plt.title("Top-5 Class Confusion Heatmap")
    plt.tight_layout()
    
    img_buffer = io.BytesIO()
    fig.savefig(img_buffer, format="png")
    plt.close(fig)
    img_buffer.seek(0)
    return img_buffer

def get_plant_metadata(plant_name):
    return PLANT_KNOWLEDGE.get(plant_name)

def build_chatbot_response(question, context=None, history=None, scan_history=None, use_scan_history=False):
    evidence = collect_evidence(question, context, scan_history, use_scan_history, history)
    response_context = {
        "resolved_plant": evidence.get("resolved_plant"),
        "plant_resolution": evidence.get("plant_resolution"),
        "used_scan_history": evidence.get("used_scan_history", False),
    }
    if evidence.get("plant_resolution") == "ambiguous":
        options = ", ".join(name.title() for name in evidence.get("candidates", []))
        return {"answer": f"Which plant did you mean: {options}?", "source": "local", "sources": [], **response_context}
    if evidence.get("explicit_unknown_plant"):
        return {"answer": f"I can’t find {evidence['explicit_unknown_plant'].title()} in LeafAI’s plant library. Try one of the supported plants shown in the library, or describe the plant without assuming a match.",
                "source": "local", "sources": [], **response_context}

    scan_facts = next((fact for fact in evidence["facts"] if fact["type"] == "scan_history"), None)
    if scan_facts:
        count = scan_facts["total_matching_scans"]
        if not count:
            answer = "No saved scans match that question yet. Try another plant name or make a new scan."
        else:
            conditions = ", ".join(f"{name}: {total}" for name, total in scan_facts["condition_counts"].items())
            answer = f"I found **{count} saved scans** matching your question. Recorded predictions: {conditions}. These are early-screening results, not confirmed diagnoses."
        return {"answer": answer, "source": "local", "sources": evidence["sources"],
                "history_summary": evidence.get("history_summary"), **response_context}

    plant_facts = [fact for fact in evidence["facts"] if fact["type"] == "plant_knowledge"]
    if not plant_facts:
        if evidence.get("used_scan_history"):
            return {"answer": "Name a supported plant to get care guidance and matching saved scans. LeafAI scan results are early-screening predictions, not confirmed diagnoses.",
                    "source": "local", "sources": evidence["sources"], **response_context}
        return {"answer": "I could not find matching plant-care information in LeafAI’s library. Try naming a supported plant or condition, or describe the symptom you are seeing.",
                "source": "local", "sources": [], **response_context}

    llm_answer = ask_llm(question, context=context, history=history, evidence=evidence)
    if llm_answer:
        answer = llm_answer
        source = "groq"
    else:
        source = "local"

        sections = []
        for fact in plant_facts:
            plant = fact["plant"].title()
            data = fact["data"]
            diseases = data.get("diseases", {})
            if diseases:
                for disease, details in diseases.items():
                    sections.append(
                        f"**{plant}: {disease.title()}**\n{details.get('definition', 'Information is unavailable.')}\n\n"
                        f"**Symptoms**\n{details.get('symptoms', 'Information is unavailable.')}\n\n"
                        f"**Next steps**\n{details.get('treatment', 'Monitor the plant and seek local advice if it worsens.')}\n\n"
                        f"**Prevention**\n{details.get('prevention', 'Keep the plant monitored and follow sound garden hygiene.')}"
                    )
            else:
                sections.append(
                    f"**{plant} care overview**\n{data.get('definition', 'Information is unavailable.')}\n\n"
                    f"**Climate:** {data.get('climate', 'Varies by variety')}\n"
                    f"**Temperature:** {data.get('temperature_range', 'Varies by variety')}\n"
                    f"**Soil:** {data.get('soil', 'Well-drained soil')}\n\n"
                    "Ask about watering, common symptoms, or a specific disease for more focused guidance."
                )
        answer = "\n\n".join(sections)

    history_summary = evidence.get("history_summary")
    if history_summary and evidence.get("used_scan_history"):
        if source == "groq":
            answer += "\n\n**Saved scans (supporting context)**"
        else:
            answer += "\n\n**Saved scans (supporting context)**"
        count = history_summary["total_matching_scans"]
        if count:
            conditions = ", ".join(f"{name}: {total}" for name, total in history_summary["condition_counts"].items())
            answer += f"\nI found **{count} matching {evidence['resolved_plant'].title()} scans**. Recorded predictions: {conditions}. These are early-screening results, not confirmed diagnoses."
        else:
            answer += f"\nNo saved scans match {evidence['resolved_plant'].title()} yet."
    if evidence.get("resolved_plant"):
        answer = f"**Interpreted crop: {evidence['resolved_plant'].title()}**\n\n" + answer
    answer += "\n\nLeafAI scan results are early-screening predictions, not confirmed diagnoses."
    return {"answer": answer, "source": source, "sources": evidence["sources"],
            "history_summary": history_summary if evidence.get("used_scan_history") else None,
            **response_context}

@app.route("/healthy_references/<filename>")
def get_healthy_image(filename):
    return send_from_directory(os.path.join(BACKEND_DIR, "healthy_references"), filename)

@app.route("/uploads/<filename>")
def get_uploaded_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "Server running", "message": "Use the API endpoints to interact with LeafAI."})

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    requested_run_key = request.form.get("run_key") or uuid.uuid4().hex
    source = request.form.get("source", "manual")
    if source not in {"manual", "automation"}:
        source = "manual"
    
    try:
        original_bytes = file.read()
        image_sha256 = hashlib.sha256(original_bytes).hexdigest()

        # Check before inference, then check again before committing. The second
        # check closes the race where two requests analyze the same file at once.
        with prediction_log_lock:
            existing_entry = next(
                (entry for entry in prediction_log
                 if entry.get("image_sha256") == image_sha256),
                None,
            )
        if existing_entry:
            return jsonify(prediction_response(existing_entry, duplicate=True))

        img = Image.open(io.BytesIO(original_bytes)).convert("RGB")
        img = img.resize(IMG_SIZE)
        image_array = np.array(img)
        # New .keras experiments use MobileNetV2 preprocessing. Keep the
        # legacy H5 fallback on its original 0..1 preprocessing until it is
        # replaced by a newly trained compatible model.
        if MODEL_PATH and MODEL_PATH.lower().endswith(".keras"):
            image_array = preprocess_input(image_array)
        else:
            image_array = image_array / 255.0
        arr = np.expand_dims(image_array, axis=0)
        prediction_id = uuid.uuid4().hex
        image_extension = mimetypes.guess_extension(file.mimetype or "") or ".jpg"
        image_filename = f"{prediction_id}{image_extension}"
        image_path = os.path.join(UPLOAD_DIR, image_filename)

        preds = model.predict(arr, verbose=0)

        all_predictions = []
        for i, score in enumerate(preds[0]):
            all_predictions.append({"class_index": i, "class_name": class_names[i], "confidence": float(score) * 100})

        all_predictions.sort(key=lambda x: x["confidence"], reverse=True)

        top_pred = all_predictions[0]
        predicted_key = top_pred["class_name"]
        confidence = top_pred["confidence"]
        confidence_spread = all_predictions[0]["confidence"] - all_predictions[1]["confidence"] if len(all_predictions) > 1 else 100

        raw_plant, raw_disease = split_class_label(predicted_key)
        normalized_plant = normalize_plant_name(raw_plant)
        normalized_disease = normalize_disease_name(raw_disease)

        is_prediction_confident = is_confident_prediction(confidence)
        is_healthy = "healthy" in predicted_key.lower()
        needs_review = not is_prediction_confident or confidence_spread < 15

        healthy_image_url = None
        if not is_healthy:
            filename = healthy_map.get(raw_plant)
            if filename:
                healthy_image_url = f"http://localhost:4000/healthy_references/{filename}"

        plant_metadata = get_plant_metadata(normalized_plant)

        top_predictions = []
        for p in all_predictions[:3]:
            p_plant, p_disease = split_class_label(p["class_name"])
            top_predictions.append({
                "label": p["class_name"],
                "class_name": p["class_name"].replace("___", " ").replace("_", " "),
                "plant": normalize_plant_name(p_plant),
                "disease": normalize_disease_name(p_disease),
                "confidence": round(p["confidence"], 2)
            })
        warning = None
        if not is_prediction_confident:
            warning = "Low confidence prediction. Please upload a clearer image."
        elif confidence_spread < 15:
            warning = "Multiple diseases have similar confidence. Consider uploading a clearer image."

        entry = {
            "id": prediction_id,
            "class_key": predicted_key,
            "class_name": predicted_key.replace("___", " ").replace("_", " "),
            "image_sha256": image_sha256,
            "severity": severity_map.get(predicted_key, "Unknown"),
            "confidence": confidence,
            "confidence_spread": round(confidence_spread, 2),
            "plant": normalized_plant,
            "disease": normalized_disease,
            "timestamp": datetime.now().isoformat(),
            "scan_image_filename": image_filename,
            "advice": expert_advice.get(predicted_key, "No expert advice available."),
            "is_confident": is_prediction_confident,
            "needs_review": needs_review,
            "top_predictions": top_predictions,
            "healthy_image": healthy_image_url,
            "warning": warning,
            "geography": {
                "climate": plant_metadata.get("climate") if plant_metadata else None,
                "temperature_range": plant_metadata.get("temperature_range") if plant_metadata else None,
                "typical_regions": plant_metadata.get("typical_regions") if plant_metadata else [],
                "soil": plant_metadata.get("soil") if plant_metadata else None,
            },
            "source": source,
        }
        if source == "automation":
            entry["automation"] = {
                "camera_index": request.form.get("camera_index"),
                "plant_label": (request.form.get("plant_label") or "Plant 1")[:80],
            }

        with prediction_log_lock:
            existing_entry = next(
                (saved for saved in prediction_log
                 if saved.get("image_sha256") == image_sha256),
                None,
            )
            if existing_entry:
                return jsonify(prediction_response(existing_entry, duplicate=True))

            run_key, run_number, run_label = get_run_info(requested_run_key)
            with open(image_path, "wb") as image_file:
                image_file.write(original_bytes)
            entry["scan_image"] = scan_image_url(image_filename)
            entry["run_key"] = run_key
            entry["run_number"] = run_number
            entry["run_label"] = run_label
            prediction_log.append(entry)
            save_prediction_log()

        create_automation_prediction_alerts(entry)
        response = prediction_response(entry)
        print(f"\nPrediction: {normalized_plant} - {normalized_disease} ({confidence:.1f}%)")
        return jsonify(response)
        
    except Exception as e:
        if "image_path" in locals() and os.path.isfile(image_path):
            try:
                os.remove(image_path)
            except OSError as cleanup_error:
                print(f"[WARN] Could not clean up failed scan image: {cleanup_error}")
        print(f"Error: {e}")
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route("/start-analysis-run", methods=["POST"])
def start_analysis_run():
    """Reserve one run identity for a single or bulk analysis operation."""
    requested_run_key = (request.get_json(silent=True) or {}).get("run_key") or uuid.uuid4().hex
    with prediction_log_lock:
        run_key, run_number, run_label = get_run_info(requested_run_key)
    return jsonify({
        "run_key": run_key,
        "run_number": run_number,
        "run_label": run_label,
        "status": "started",
    })


@app.route("/automation/config", methods=["GET"])
def automation_config():
    return jsonify(get_automation_config())


@app.route("/automation/config", methods=["PUT"])
def update_automation_config():
    try:
        config = save_automation_config(request.get_json(silent=True) or {})
        return jsonify(config)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/automation/status", methods=["GET"])
def automation_status():
    return jsonify(get_automation_status())


@app.route("/automation/run-now", methods=["POST"])
def automation_run_now():
    config = request_manual_run()
    return jsonify({
        "status": "queued",
        "manual_run_id": config["manual_run_id"],
        "requested_at": config["manual_run_requested_at"],
    }), 202


@app.route("/automation/alerts", methods=["GET"])
def automation_alerts():
    alerts = sorted(get_alerts(), key=lambda item: item.get("created_at", ""), reverse=True)
    return jsonify({
        "alerts": alerts,
        "unread_count": sum(1 for alert in alerts if not alert.get("read")),
    })


@app.route("/automation/alerts/<alert_id>/read", methods=["POST"])
def read_automation_alert(alert_id):
    alert = mark_alert_read(alert_id)
    if not alert:
        return jsonify({"error": "Alert not found"}), 404
    return jsonify(alert)

@app.route("/dashboard-data", methods=["GET"])
def dashboard_data():
    severity_distribution = {"High": 0, "Moderate": 0, "None": 0}
    for entry in prediction_log:
        sev = entry["severity"]
        if sev in severity_distribution:
            severity_distribution[sev] += 1
    
    confidence_distribution = {"0-70": 0, "70-85": 0, "85-100": 0}
    for entry in prediction_log:
        conf = entry["confidence"]
        if conf < 70:
            confidence_distribution["0-70"] += 1
        elif 70 <= conf < 85:
            confidence_distribution["70-85"] += 1
        elif 85 <= conf <= 100:
            confidence_distribution["85-100"] += 1
    
    # Plant distribution
    plant_distribution = {}
    for entry in prediction_log:
        p = entry.get("plant", "Unknown")
        plant_distribution[p] = plant_distribution.get(p, 0) + 1
    
    # Disease distribution
    disease_distribution = {}
    for entry in prediction_log:
        d = entry.get("disease", "Unknown")
        if d.lower() != "healthy":
            disease_distribution[d] = disease_distribution.get(d, 0) + 1
    
    # Healthy vs diseased
    healthy_count = sum(1 for e in prediction_log if e.get("disease", "").lower() == "healthy")
    diseased_count = len(prediction_log) - healthy_count
    
    # Average confidence
    avg_confidence = round(
        sum(e["confidence"] for e in prediction_log) / len(prediction_log), 2
    ) if prediction_log else 0
    
    # High severity count
    high_severity_count = sum(1 for e in prediction_log if e.get("severity") == "High")
    needs_review_count = sum(1 for e in prediction_log if e.get("needs_review", False))
    high_confidence_count = sum(
        1 for e in prediction_log if e.get("confidence", 0) >= 85
    )
    high_confidence_percentage = round(
        high_confidence_count / len(prediction_log) * 100, 2
    ) if prediction_log else 0
    
    # Predictions over time (grouped by date)
    predictions_over_time = {}
    for entry in prediction_log:
        ts = entry.get("timestamp", "")
        date_key = ts[:10] if len(ts) >= 10 else "Unknown"
        predictions_over_time[date_key] = predictions_over_time.get(date_key, 0) + 1
    
    # Recent predictions (last 10)
    recent_predictions = []
    for entry in prediction_log[-10:]:
        recent_predictions.append({
            "id": entry.get("id") or entry.get("timestamp"),
            "timestamp": entry.get("timestamp", ""),
            "run_key": entry.get("run_key"),
            "run_number": entry.get("run_number"),
            "run_label": entry.get("run_label"),
            "plant": entry.get("plant", "Unknown"),
            "disease": entry.get("disease", "Unknown"),
            "confidence": round(entry.get("confidence", 0), 2),
            "confidence_spread": entry.get("confidence_spread", 0),
            "severity": entry.get("severity", "Unknown"),
            "advice": entry.get("advice", ""),
            "is_confident": entry.get("is_confident", True),
            "needs_review": entry.get("needs_review", False),
            "scan_image": scan_image_url(get_scan_image_filename(entry)) if get_scan_image_filename(entry) else None,
            "scan_image_filename": get_scan_image_filename(entry),
            "healthy_image": entry.get("healthy_image"),
            "top_predictions": entry.get("top_predictions", []),
            "geography": entry.get("geography", {}),
        })
    recent_predictions.reverse()

    scan_history = []
    for entry in prediction_log:
        filename = get_scan_image_filename(entry)
        scan_history.append({
            "id": entry.get("id") or entry.get("timestamp"),
            "timestamp": entry.get("timestamp", ""),
            "run_key": entry.get("run_key"),
            "run_number": entry.get("run_number"),
            "run_label": entry.get("run_label"),
            "plant": entry.get("plant", "Unknown"),
            "disease": entry.get("disease", "Unknown"),
            "confidence": round(entry.get("confidence", 0), 2),
            "confidence_spread": entry.get("confidence_spread", 0),
            "severity": entry.get("severity", "Unknown"),
            "advice": entry.get("advice", ""),
            "is_confident": entry.get("is_confident", True),
            "needs_review": entry.get("needs_review", False),
            "scan_image": scan_image_url(filename) if filename else None,
            "healthy_image": entry.get("healthy_image"),
            "top_predictions": entry.get("top_predictions", []),
            "geography": entry.get("geography", {}),
        })

    runs_by_key = {}
    for entry in prediction_log:
        run_key = entry.get("run_key") or f"legacy-{entry.get('id') or entry.get('timestamp')}"
        run = runs_by_key.setdefault(run_key, {
            "run_key": run_key,
            "run_number": entry.get("run_number"),
            "run_label": entry.get("run_label") or f"Run #{entry.get('run_number')}",
            "timestamp": entry.get("timestamp", ""),
            "image_count": 0,
        })
        run["image_count"] += 1
        if entry.get("timestamp", "") > run["timestamp"]:
            run["timestamp"] = entry.get("timestamp", "")
    runs = sorted(runs_by_key.values(), key=lambda item: item.get("run_number") or 0, reverse=True)
    accuracy_change_percent = None
    if previous_cached_accuracy not in (None, 0) and cached_accuracy is not None:
        accuracy_change_percent = round(
            (cached_accuracy - previous_cached_accuracy) / abs(previous_cached_accuracy) * 100,
            2,
        )

    return jsonify({
        "accuracy": cached_accuracy,
        "accuracy_change_percent": accuracy_change_percent,
        "confusion_matrix": cached_confusion_matrix,
        "labels": cached_labels,
        "severity_distribution": severity_distribution,
        "confidence_distribution": confidence_distribution,
        "total_predictions": len(prediction_log),
        "plant_distribution": plant_distribution,
        "disease_distribution": disease_distribution,
        "healthy_vs_diseased": {"healthy": healthy_count, "diseased": diseased_count},
        "avg_confidence": avg_confidence,
        "high_severity_count": high_severity_count,
        "needs_review_count": needs_review_count,
        "high_confidence_count": high_confidence_count,
        "high_confidence_percentage": high_confidence_percentage,
        "validation_sample_count": cached_validation_sample_count,
        "model_evaluated_at": cached_model_evaluated_at,
        "predictions_over_time": predictions_over_time,
        "recent_predictions": recent_predictions,
        "scan_history": scan_history,
        "runs": runs,
        "automation": {
            "config": get_automation_config(),
            "status": get_automation_status(),
            "unread_alert_count": sum(1 for alert in get_alerts() if not alert.get("read")),
        },
    })

@app.route("/prediction/<prediction_id>", methods=["DELETE"])
def delete_prediction(prediction_id):
    with prediction_log_lock:
        original_count = len(prediction_log)
        removed_entries = [
            entry for entry in prediction_log
            if (entry.get("id") or entry.get("timestamp")) == prediction_id
        ]
        prediction_log[:] = [
            entry for entry in prediction_log
            if (entry.get("id") or entry.get("timestamp")) != prediction_id
        ]

        if len(prediction_log) == original_count:
            return jsonify({"error": "Prediction not found"}), 404

        for entry in removed_entries:
            remove_scan_image(entry)
        save_prediction_log()

    return jsonify({"status": "deleted", "id": prediction_id})

@app.route("/save-analysis", methods=["POST"])
def save_analysis():
    """Confirm and persist a completed analysis run for Dashboard history."""
    data = request.get_json(silent=True) or {}
    run_key = data.get("run_key")
    if not run_key:
        return jsonify({"error": "run_key is required"}), 400

    with prediction_log_lock:
        run_entries = [entry for entry in prediction_log if entry.get("run_key") == run_key]
        if not run_entries:
            return jsonify({"error": "Analysis run not found"}), 404

        saved_at = datetime.now().isoformat()
        for entry in run_entries:
            entry["saved_at"] = saved_at
        save_prediction_log()

        first_entry = run_entries[0]
        return jsonify({
            "status": "saved",
            "run_key": run_key,
            "run_number": first_entry.get("run_number"),
            "run_label": first_entry.get("run_label"),
            "saved_count": len(run_entries),
            "dashboard_count": len(prediction_log),
            "saved_at": saved_at,
        })

@app.route("/predictions/bulk-delete", methods=["POST"])
def bulk_delete_predictions():
    data = request.get_json(silent=True) or {}
    prediction_ids = {str(item) for item in data.get("ids", []) if item}
    if not prediction_ids:
        return jsonify({"error": "At least one prediction id is required"}), 400

    with prediction_log_lock:
        removed_entries = [
            entry for entry in prediction_log
            if str(entry.get("id") or entry.get("timestamp")) in prediction_ids
        ]
        if not removed_entries:
            return jsonify({"error": "No matching predictions found"}), 404

        prediction_log[:] = [
            entry for entry in prediction_log
            if str(entry.get("id") or entry.get("timestamp")) not in prediction_ids
        ]
        for entry in removed_entries:
            remove_scan_image(entry)
        save_prediction_log()

    return jsonify({"status": "deleted", "deleted_count": len(removed_entries)})

@app.route("/analysis-run/<run_key>", methods=["DELETE"])
def delete_analysis_run(run_key):
    with prediction_log_lock:
        removed_entries = [entry for entry in prediction_log if entry.get("run_key") == run_key]
        if not removed_entries:
            return jsonify({"error": "Analysis run not found"}), 404

        prediction_log[:] = [entry for entry in prediction_log if entry.get("run_key") != run_key]
        run_assignments.pop(run_key, None)
        for entry in removed_entries:
            remove_scan_image(entry)
        save_prediction_log()

    return jsonify({
        "status": "deleted",
        "run_key": run_key,
        "deleted_count": len(removed_entries),
    })

@app.route("/plant-geography/<plant_name>", methods=["GET"])
def plant_geography(plant_name):
    normalized_name = normalize_plant_name(plant_name)
    plant_data = PLANT_KNOWLEDGE.get(normalized_name)
    if not plant_data:
        return jsonify({"error": "Plant not found"}), 404
    return jsonify({
        "plant": normalized_name,
        "climate": plant_data.get("climate"),
        "temperature_range": plant_data.get("temperature_range"),
        "typical_regions": plant_data.get("typical_regions"),
        "soil": plant_data.get("soil")
    })

@app.route("/chatbot", methods=["POST"])
def chatbot():
    data = request.get_json(silent=True) or {}
    question = data.get("question")
    if not isinstance(question, str) or not question.strip() or len(question) > 500:
        return jsonify({"error": "Question is required"}), 400
    context = data.get("context") if isinstance(data.get("context"), dict) else None
    history = data.get("history") if isinstance(data.get("history"), list) else None
    with prediction_log_lock:
        scans = [dict(entry) for entry in prediction_log]
    result = build_chatbot_response(question.strip(), context=context, history=history,
                                    scan_history=scans, use_scan_history=data.get("use_scan_history") is True)
    return jsonify(result)


@app.route("/chatbot/topics", methods=["GET"])
def chatbot_topics():
    return jsonify({"plants": [
        {"name": name, "diseases": [disease for disease in entry.get("diseases", {}) if disease != "healthy"]}
        for name, entry in PLANT_KNOWLEDGE.items()
    ]})

@app.route("/generate-pdf", methods=["POST"])
def generate_pdf():
    data = request.get_json()
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 50
    
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(50, y, "Plant Disease Detection Report")
    y -= 40
    
    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, y, f"Date: {data.get('date', datetime.now().strftime('%Y-%m-%d'))}")
    y -= 20
    pdf.drawString(50, y, f"Disease: {data.get('disease')}")
    y -= 20
    pdf.drawString(50, y, f"Confidence: {data.get('confidence')}%")
    y -= 20
    pdf.drawString(50, y, f"Severity: {data.get('severity')}")
    y -= 30
    
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "Model Overall Accuracy:")
    y -= 20
    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, y, f"{cached_accuracy if cached_accuracy else 'N/A'}%")
    y -= 40
    
    heatmap_img = generate_heatmap_image()
    if heatmap_img:
        heatmap_image_reader = ImageReader(heatmap_img)
        pdf.drawImage(heatmap_image_reader, 50, y - 250, width=450, height=250)
        y -= 280
    
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "Expert Advice:")
    y -= 20
    
    pdf.setFont("Helvetica", 11)
    text_object = pdf.beginText(50, y)
    text_object.setLeading(15)
    advice = data.get("advice", "")
    words = advice.split()
    line = ""
    for word in words:
        if len(line + word) < 90:
            line += word + " "
        else:
            text_object.textLine(line)
            line = word + " "
    text_object.textLine(line)
    pdf.drawText(text_object)
    
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    
    return send_file(buffer, as_attachment=True, download_name="plant_disease_report.pdf", mimetype="application/pdf")

@app.route("/test", methods=["GET"])
def test():
    return jsonify({"status": "Server running", "num_classes": len(class_names)})

# ── Startup: Model Performance ───────────────────────────────────
# Comment out the line below to skip model evaluation entirely on startup
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    model_only = "--model-only" in sys.argv
    force_refresh = "--refresh" in sys.argv
    compute_model_performance(force_refresh=force_refresh)
    record_accuracy_snapshot()

    if model_only:
        print("Model validation completed. The performance cache was updated.")
        sys.exit(0)

    print("\n" + "="*50)
    print("STARTING FLASK SERVER")
    print("="*50)
    print(f"Model loaded with {len(class_names)} classes")
    print(f"Server running at: http://localhost:4000")
    print("="*50 + "\n")
    app.run(debug=True, port=4000, use_reloader=False)
