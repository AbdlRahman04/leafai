"""Windows background camera monitor for LeafAI.

Run this alongside the Flask backend. It reads configuration from the backend
storage directory, captures the configured USB camera, and submits JPEG frames
to the existing /predict API.
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from datetime import datetime, timedelta
from urllib import request as urlrequest

try:
    import cv2
except ImportError:  # Report a useful runtime alert instead of crashing at import.
    cv2 = None

from automation_store import add_alert, ensure_runtime_files, get_config, get_status, save_status


def _multipart_body(fields, filename, image_bytes):
    boundary = f"----LeafAI{uuid.uuid4().hex}"
    chunks = []
    for name, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
            str(value).encode(), b"\r\n",
        ])
    chunks.extend([
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="file"; filename="scheduled-camera.jpg"\r\n',
        b"Content-Type: image/jpeg\r\n\r\n",
        image_bytes, b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ])
    return boundary, b"".join(chunks)


def capture_camera_frame(camera_index):
    if cv2 is None:
        raise RuntimeError("OpenCV is not installed. Install backend requirements first.")
    backend = cv2.CAP_DSHOW if sys.platform.startswith("win") else cv2.CAP_ANY
    camera = cv2.VideoCapture(camera_index, backend)
    if not camera.isOpened():
        camera.release()
        raise RuntimeError(f"Camera {camera_index} could not be opened")
    try:
        frame = None
        for _ in range(4):  # Let USB webcams settle before using a frame.
            ok, frame = camera.read()
            if ok and frame is not None:
                break
            time.sleep(0.15)
        if frame is None:
            raise RuntimeError(f"Camera {camera_index} did not return an image")
        ok, encoded = cv2.imencode(".jpg", frame)
        if not ok:
            raise RuntimeError("Camera image could not be encoded as JPEG")
        return encoded.tobytes()
    finally:
        camera.release()


def submit_prediction(config, image_bytes):
    run_key = f"automation-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    boundary, body = _multipart_body({
        "run_key": run_key,
        "source": "automation",
        "camera_index": config["camera_index"],
        "plant_label": config["plant_label"],
    }, "scheduled-camera.jpg", image_bytes)
    target = f"{config['backend_url'].rstrip('/')}/predict"
    request = urlrequest.Request(target, data=body, method="POST")
    request.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    request.add_header("Content-Length", str(len(body)))
    try:
        with urlrequest.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise RuntimeError(f"LeafAI backend request failed: {error}") from error
    if payload.get("error"):
        raise RuntimeError(payload["error"])
    return payload


class AutomationMonitor:
    def __init__(self):
        self.last_manual_run_id = get_status().get("last_manual_run_id")
        self.next_run_at = None
        self.last_schedule_signature = None

    def _schedule_next_run(self, config):
        self.next_run_at = datetime.now() + timedelta(minutes=config["interval_minutes"])
        return self.next_run_at

    def _record_failure(self, error):
        message = str(error)
        save_status({
            "service_state": "error",
            "last_run_at": datetime.now().isoformat(),
            "last_error": message,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
        })
        add_alert(
            "automation_failure",
            "Automated scan failed",
            message,
            severity="error",
            dedupe_key=f"automation_failure:{message[:100]}",
        )

    def run_once(self, config):
        save_status({"service_state": "running", "last_error": None})
        try:
            result = submit_prediction(config, capture_camera_frame(config["camera_index"]))
            completed_at = datetime.now().isoformat()
            save_status({
                "service_state": "running",
                "last_run_at": completed_at,
                "last_success_at": completed_at,
                "last_error": None,
                "last_prediction_id": result.get("id"),
                "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            })
            return result
        except Exception as error:
            self._record_failure(error)
            return None

    def run_forever(self):
        ensure_runtime_files()
        save_status({"service_state": "running", "last_error": None})
        try:
            while True:
                config = get_config()
                schedule_signature = (
                    config["enabled"],
                    config["interval_minutes"],
                    config["camera_index"],
                )
                if schedule_signature != self.last_schedule_signature:
                    self.last_schedule_signature = schedule_signature
                    self.next_run_at = self._schedule_next_run(config) if config["enabled"] else None
                manual_run_id = config.get("manual_run_id")
                should_run_manual = bool(manual_run_id and manual_run_id != self.last_manual_run_id)
                if should_run_manual:
                    self.last_manual_run_id = manual_run_id
                    save_status({"last_manual_run_id": manual_run_id})

                if not config["enabled"]:
                    self.next_run_at = None
                    save_status({"service_state": "idle", "next_run_at": None})

                due = bool(self.next_run_at and datetime.now() >= self.next_run_at)
                if should_run_manual or (config["enabled"] and due):
                    self._schedule_next_run(config)
                    self.run_once(config)
                else:
                    save_status({
                        "service_state": "running" if config["enabled"] else "idle",
                        "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
                    })
                time.sleep(2)
        except KeyboardInterrupt:
            save_status({"service_state": "stopped", "next_run_at": None})


if __name__ == "__main__":
    AutomationMonitor().run_forever()
