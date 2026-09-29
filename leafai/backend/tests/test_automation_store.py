import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

import automation_service
import automation_store


class AutomationStoreTests(unittest.TestCase):
    def setUp(self):
        test_root = os.path.join(os.path.dirname(__file__), ".automation-test-state")
        os.makedirs(test_root, exist_ok=True)
        self.temp_dir = tempfile.mkdtemp(dir=test_root)
        self.paths = {
            "STORAGE_DIR": self.temp_dir,
            "CONFIG_PATH": os.path.join(self.temp_dir, "automation_config.json"),
            "STATUS_PATH": os.path.join(self.temp_dir, "automation_status.json"),
            "ALERTS_PATH": os.path.join(self.temp_dir, "automation_alerts.json"),
        }
        self.patchers = [patch.object(automation_store, name, value) for name, value in self.paths.items()]
        for patcher in self.patchers:
            patcher.start()
        automation_store.ensure_runtime_files()

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        shutil.rmtree(self.temp_dir)

    def test_config_rejects_invalid_camera_and_interval(self):
        with self.assertRaisesRegex(ValueError, "interval_minutes"):
            automation_store.save_config({"interval_minutes": 0})
        with self.assertRaisesRegex(ValueError, "camera_index"):
            automation_store.save_config({"camera_index": -1})

    def test_config_and_manual_request_are_persisted(self):
        config = automation_store.save_config({
            "enabled": True,
            "interval_minutes": 5,
            "camera_index": 1,
            "plant_label": "Tomato A",
        })
        self.assertTrue(config["enabled"])
        self.assertEqual(config["camera_index"], 1)
        queued = automation_store.request_manual_run()
        self.assertTrue(queued["manual_run_id"])

    def test_alerts_are_deduplicated_and_can_be_read(self):
        first, created = automation_store.add_alert(
            "automation_failure", "Automated scan failed", "Camera unavailable", dedupe_key="camera"
        )
        second, second_created = automation_store.add_alert(
            "automation_failure", "Automated scan failed", "Camera unavailable", dedupe_key="camera"
        )
        self.assertTrue(created)
        self.assertFalse(second_created)
        self.assertEqual(first["id"], second["id"])
        self.assertTrue(automation_store.mark_alert_read(first["id"])["read"])

    def test_monitor_records_mocked_camera_prediction(self):
        monitor = automation_service.AutomationMonitor()
        config = automation_store.get_config()
        with patch.object(automation_service, "capture_camera_frame", return_value=b"jpeg"), \
             patch.object(automation_service, "submit_prediction", return_value={"id": "prediction-1"}):
            monitor.run_once(config)
        self.assertEqual(automation_store.get_status()["last_prediction_id"], "prediction-1")


if __name__ == "__main__":
    unittest.main()
