import { useEffect, useRef, useState } from "react";
import { usePrediction } from "../hooks/usePrediction";
import ResultCard from "../components/ResultCard";
import ModelPerformanceModal from "../components/ModelPerformanceModal";
import ReportPreview from "../components/ReportPreview";
import "./Camera.css";

function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reportPrediction, setReportPrediction] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const cameraListPrimedRef = useRef(false);

  const { prediction, loading, error, submitImage, reset } = usePrediction();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    enumerateCamerasQuiet();

    const handleDeviceChange = () => {
      enumerateCamerasQuiet();
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
      stopCamera();
    };
  }, []);

  const enumerateCamerasQuiet = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(videos);
      setSelectedDeviceId((prev) =>
        prev && videos.some((d) => d.deviceId === prev) ? prev : ""
      );
    } catch (error) {
      console.error("Could not enumerate camera devices:", error);
    }
  };

  const refreshCameraListWithPermission = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setCameraError("");
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videos = devices.filter((d) => d.kind === "videoinput");
      const lacksIds = videos.length === 0 || videos.every((d) => !d.deviceId);
      if (lacksIds && navigator.mediaDevices?.getUserMedia) {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true });
        temp.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
        videos = devices.filter((d) => d.kind === "videoinput");
      }
      setCameraDevices(videos);
      setSelectedDeviceId((prev) =>
        prev && videos.some((d) => d.deviceId === prev) ? prev : ""
      );
    } catch (error) {
      setCameraError(getCameraErrorMessage(error));
      console.error("Refresh camera list failed:", error);
    }
  };

  const getCameraErrorMessage = (error) => {
    switch (error?.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera permission is blocked. Please allow camera access in your browser settings and reload.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "The selected camera is unavailable. Try Refresh Cameras or reconnect the webcam.";
      case "NotReadableError":
      case "AbortError":
        return "The camera is busy or the USB stream stalled. Close other apps using the camera, wait a few seconds, and click Retry Camera.";
      default:
        return "Unable to access camera. Reconnect your webcam if needed and click Retry Camera.";
    }
  };

  const bindStreamLifetime = (stream) => {
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (streamRef.current !== stream) return;
        stopCamera();
        setCameraError(
          "Camera stream stopped unexpectedly. Choose the camera again or click Retry Camera."
        );
      };
    });
  };

  const startCamera = async (deviceIdOverride) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access.");
      return;
    }
    const requestedId =
      deviceIdOverride !== undefined &&
      deviceIdOverride !== null &&
      String(deviceIdOverride).trim() !== ""
        ? deviceIdOverride
        : selectedDeviceId;
    if (!requestedId) {
      setCameraError("Select a camera from the menu first.");
      return;
    }
    setStartingCamera(true);
    setCameraError("");
    stopCamera();

    const constraintSets = [
      { deviceId: { exact: requestedId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } },
      { deviceId: { exact: requestedId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      { deviceId: { exact: requestedId }, width: { ideal: 640 }, height: { ideal: 480 } },
      { deviceId: { exact: requestedId } },
    ];

    const openStream = async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        for (const videoConstraints of constraintSets) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            streamRef.current = stream;
            bindStreamLifetime(stream);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
            }
            await enumerateCamerasQuiet();
            setPreviewActive(true);
            return;
          } catch (error) {
            lastError = error;
            stopCamera();
            if (error?.name === "OverconstrainedError") continue;
            if (error?.name === "NotFoundError") break;
          }
        }
        await sleep(400 * (attempt + 1));
      }
      throw lastError || new Error("Camera failed to start");
    };

    try {
      await openStream();
    } catch (error) {
      setCameraError(getCameraErrorMessage(error));
      console.error(error);
    } finally {
      setStartingCamera(false);
    }
  };

  const stopCamera = () => {
    const stream = streamRef.current || videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setPreviewActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setImageBlob(blob);
      setCapturedImage(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg");
  };

  const analyzeImage = async () => {
    if (!imageBlob) return;
    const result = await submitImage(imageBlob);
    if (result) {
      localStorage.setItem("leafai-last-prediction", JSON.stringify(result));
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setImageBlob(null);
    reset();
    startCamera();
  };

  return (
    <div className="page-container camera-page">
      <h1 className="page-title">Capture Leaf Image</h1>
      <p className="page-subtitle">
        Use your camera to take a photo of the leaf
      </p>

      <div className="page-content">
        {/* LEFT CARD */}
        <div className="glass-card" style={{ flex: 1, textAlign: "center" }}>
          {!capturedImage && (
            <>
              <div className="camera-controls">
                <select
                  className="camera-select"
                  value={selectedDeviceId}
                  onFocus={() => {
                    if (!cameraListPrimedRef.current) {
                      cameraListPrimedRef.current = true;
                      refreshCameraListWithPermission();
                    }
                  }}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId) return;
                    setSelectedDeviceId(nextId);
                    startCamera(nextId);
                  }}
                  disabled={startingCamera}
                >
                  <option value="" disabled>Select camera</option>
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {`Camera ${index + 1}`}
                    </option>
                  ))}
                </select>

                <button
                  className="camera-ctrl-btn camera-ctrl-outline"
                  onClick={() => refreshCameraListWithPermission()}
                  disabled={startingCamera}
                >
                  Refresh Cameras
                </button>

                <button
                  className="camera-ctrl-btn camera-ctrl-filled"
                  onClick={() => startCamera()}
                  disabled={startingCamera || !selectedDeviceId}
                >
                  {startingCamera ? "Starting..." : "Retry Camera"}
                </button>
              </div>

              {cameraError && (
                <p className="camera-error">{cameraError}</p>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />

              <button
                className="camera-capture-btn"
                onClick={captureImage}
                disabled={!previewActive || startingCamera}
              >
                Capture
              </button>
            </>
          )}

          {capturedImage && (
            <>
              <img
                src={capturedImage}
                alt="Captured"
                className="camera-captured-img"
              />

              <div className="camera-action-row">
                <button className="camera-analyze-btn" onClick={analyzeImage}>
                  {loading ? "Analyzing..." : "Detect Disease"}
                </button>
                <button className="camera-retake-btn" onClick={retake}>
                  Retake
                </button>
              </div>
              {loading && <p className="ui-processing" role="status">Analyzing your captured leaf…</p>}
              {error && <p className="ui-message ui-message-error" role="alert">{error}</p>}
            </>
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* RIGHT CARD */}
        <ResultCard
          prediction={prediction}
          onDownloadPDF={() => setReportPrediction(prediction)}
          onShowModal={() => setShowModal(true)}
        />
      </div>

      {showModal && <ModelPerformanceModal onClose={() => setShowModal(false)} />}
          {reportPrediction && (
            <ReportPreview prediction={reportPrediction} onClose={() => setReportPrediction(null)} />
          )}
    </div>
  );
}

export default Camera;
