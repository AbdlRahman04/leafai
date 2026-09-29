import inspect
import json
import os
import zipfile
import tempfile
import shutil
import importlib


SOURCE_MODEL = "models/plant_disease_model.keras"
PATCHED_MODEL = "models/plant_disease_model_patched.keras"


DROP_KEYS = {
    "renorm",
    "renorm_clipping",
    "renorm_momentum",
    "quantization_config",
    "optional",
}


def resolve_class(module_name: str, class_name: str):
    try:
        module = importlib.import_module(module_name)
        return getattr(module, class_name, None)
    except Exception:
        return None


def accepted_kwargs(cls):
    if cls is None:
        return None
    try:
        sig = inspect.signature(cls.__init__)
    except Exception:
        return None

    allow_any = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
    if allow_any:
        return None

    return {name for name in sig.parameters.keys() if name != "self"}


def patch_node(node):
    if isinstance(node, dict):
        module_name = node.get("module")
        class_name = node.get("class_name")
        cfg = node.get("config")

        if isinstance(cfg, dict):
            for key in list(cfg.keys()):
                if key in DROP_KEYS:
                    cfg.pop(key, None)

            cls = resolve_class(module_name, class_name) if module_name and class_name else None
            allowed = accepted_kwargs(cls)
            if allowed is not None:
                for key in list(cfg.keys()):
                    if key not in allowed:
                        cfg.pop(key, None)

        for value in node.values():
            patch_node(value)
    elif isinstance(node, list):
        for value in node:
            patch_node(value)


def patch_model_file(src_path: str, dst_path: str):
    temp_dir = tempfile.mkdtemp(prefix="keras_patch_")
    try:
        with zipfile.ZipFile(src_path, "r") as zf:
            zf.extractall(temp_dir)

        config_path = os.path.join(temp_dir, "config.json")
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        patch_node(config)

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False)

        with zipfile.ZipFile(dst_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(temp_dir):
                for file_name in files:
                    abs_path = os.path.join(root, file_name)
                    rel_path = os.path.relpath(abs_path, temp_dir)
                    zf.write(abs_path, rel_path)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    patch_model_file(SOURCE_MODEL, PATCHED_MODEL)
    print(f"Patched model written to {PATCHED_MODEL}")
