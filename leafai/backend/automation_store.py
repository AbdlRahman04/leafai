"""Shared, file-backed state for the LeafAI camera automation service."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BACKEND_DIR, "storage")
CONFIG_PATH = os.path.join(STORAGE_DIR, "automation_config.json")
STATUS_PATH = os.path.join(STORAGE_DIR, "automation_status.json")
ALERTS_PATH = os.path.join(STORAGE_DIR, "automation_alerts.json")

DEFAULT_CONFIG = {
    "enabled": False,
    "interval_minutes": 60,
    "camera_index": 0,
    "plant_label": "Plant 1",
    "backend_url": "http://127.0.0.1:4000",
    "manual_run_id": None,
    "manual_run_requested_at": None,
}

DEFAULT_STATUS = {
    "service_state": "stopped",
    "last_run_at": None,
    "last_success_at": None,
    "last_error": None,
    "next_run_at": None,
    "last_prediction_id": None,
    "updated_at": None,
}


def _read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as file:
            payload = json.load(file)
        return payload if isinstance(payload, type(default)) else default.copy()
    except (OSError, json.JSONDecodeError):
        return default.copy()


def _write_json(path, payload):
    os.makedirs(STORAGE_DIR, exist_ok=True)
    temporary_path = f"{path}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)
    os.replace(temporary_path, path)


def ensure_runtime_files():
    os.makedirs(STORAGE_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_PATH):
        _write_json(CONFIG_PATH, DEFAULT_CONFIG)
    if not os.path.exists(STATUS_PATH):
        _write_json(STATUS_PATH, DEFAULT_STATUS)
    if not os.path.exists(ALERTS_PATH):
        _write_json(ALERTS_PATH, [])


def get_config():
    config = DEFAULT_CONFIG.copy()
    config.update(_read_json(CONFIG_PATH, {}))
    return config


def validate_config(payload):
    if not isinstance(payload, dict):
        raise ValueError("Configuration must be a JSON object")

    config = get_config()
    for key in ("enabled", "interval_minutes", "camera_index", "plant_label"):
        if key in payload:
            config[key] = payload[key]

    if not isinstance(config["enabled"], bool):
        raise ValueError("enabled must be true or false")
    if isinstance(config["interval_minutes"], bool) or not isinstance(config["interval_minutes"], int):
        raise ValueError("interval_minutes must be a whole number")
    if not 1 <= config["interval_minutes"] <= 10080:
        raise ValueError("interval_minutes must be between 1 and 10080")
    if isinstance(config["camera_index"], bool) or not isinstance(config["camera_index"], int):
        raise ValueError("camera_index must be a whole number")
    if not 0 <= config["camera_index"] <= 10:
        raise ValueError("camera_index must be between 0 and 10")
    if not isinstance(config["plant_label"], str) or not config["plant_label"].strip():
        raise ValueError("plant_label is required")
    config["plant_label"] = config["plant_label"].strip()[:80]
    return config


def save_config(payload):
    config = validate_config(payload)
    _write_json(CONFIG_PATH, config)
    return config


def request_manual_run():
    config = get_config()
    config["manual_run_id"] = uuid.uuid4().hex
    config["manual_run_requested_at"] = datetime.now().isoformat()
    _write_json(CONFIG_PATH, config)
    return config


def get_status():
    status = DEFAULT_STATUS.copy()
    status.update(_read_json(STATUS_PATH, {}))
    return status


def save_status(updates):
    status = get_status()
    status.update(updates)
    status["updated_at"] = datetime.now().isoformat()
    _write_json(STATUS_PATH, status)
    return status


def get_alerts():
    alerts = _read_json(ALERTS_PATH, [])
    return [alert for alert in alerts if isinstance(alert, dict)]


def add_alert(alert_type, title, message, *, severity="warning", prediction_id=None, dedupe_key=None):
    """Create an alert unless an equivalent unread/recent alert already exists."""
    alerts = get_alerts()
    cutoff = datetime.now() - timedelta(hours=24)
    if dedupe_key:
        for alert in alerts:
            if alert.get("dedupe_key") != dedupe_key:
                continue
            try:
                if datetime.fromisoformat(alert.get("created_at", "")) >= cutoff:
                    return alert, False
            except ValueError:
                continue

    alert = {
        "id": uuid.uuid4().hex,
        "type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,
        "prediction_id": prediction_id,
        "dedupe_key": dedupe_key,
        "read": False,
        "created_at": datetime.now().isoformat(),
    }
    alerts.append(alert)
    _write_json(ALERTS_PATH, alerts[-200:])
    return alert, True


def mark_alert_read(alert_id):
    alerts = get_alerts()
    for alert in alerts:
        if alert.get("id") == alert_id:
            alert["read"] = True
            alert["read_at"] = datetime.now().isoformat()
            _write_json(ALERTS_PATH, alerts)
            return alert
    return None
