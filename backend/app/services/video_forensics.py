"""
AI Video Analyzer — intelligent frame sampling + per-frame image heuristics,
aggregated into an overall score. Real deepfake detection (face-consistency,
temporal-artifact models) is a dedicated-model concern; the seam to plug one
in is `run_deepfake_model()` below. Everything here is honestly labeled
Demo Data because the underlying detector is a heuristic placeholder, same
caveat as the image analyzer.
"""
import io
import tempfile
import os
import cv2
from PIL import Image

from app.services.image_forensics import run_ai_detection_model


def _sample_frame_indices(total_frames: int, max_samples: int = 8) -> list:
    if total_frames <= max_samples:
        return list(range(total_frames))
    step = total_frames / max_samples
    return [int(i * step) for i in range(max_samples)]


def run_deepfake_model(frame_scores: list) -> dict:
    """PLACEHOLDER aggregation of per-frame AI/manipulation scores into a
    video-level deepfake risk. Replace with a real temporal-consistency /
    face-landmark model for production use."""
    if not frame_scores:
        return {"deepfake_risk": 0, "suspicious_frame_indices": []}
    avg = sum(frame_scores) / len(frame_scores)
    variance = sum((s - avg) ** 2 for s in frame_scores) / len(frame_scores)
    # High variance between frames is treated as a mild extra signal of inconsistency
    deepfake_risk = min(97, int(avg + (variance ** 0.5) * 0.3))
    suspicious = [i for i, s in enumerate(frame_scores) if s >= 60]
    return {"deepfake_risk": deepfake_risk, "suspicious_frame_indices": suspicious}


def analyze_video(filename: str, content: bytes) -> dict:
    suffix = "." + (filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp4")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError("Could not open video file — unsupported codec or corrupt file")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_sec = total_frames / fps if fps else 0

        indices = _sample_frame_indices(total_frames, max_samples=8)
        frame_scores = []
        frame_timestamps = []

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok:
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=85)
            frame_bytes = buf.getvalue()
            detection = run_ai_detection_model(frame_bytes, {}, "JPEG", pil_img.width, pil_img.height)
            frame_scores.append(detection["ai_probability"])
            frame_timestamps.append(round(idx / fps, 1) if fps else 0)

        cap.release()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    agg = run_deepfake_model(frame_scores)
    deepfake_risk = agg["deepfake_risk"]
    suspicious_idx = agg["suspicious_frame_indices"]

    if deepfake_risk >= 80:
        classification = "High Deepfake Risk"
    elif deepfake_risk >= 60:
        classification = "Possible Deepfake"
    elif deepfake_risk >= 40:
        classification = "Possibly AI-Generated"
    elif deepfake_risk >= 20:
        classification = "Inconclusive"
    else:
        classification = "Likely Authentic"

    timeline = []
    for i, ts in enumerate(frame_timestamps):
        seg_risk = "high" if i in suspicious_idx else ("medium" if frame_scores[i] >= 40 else "safe")
        timeline.append({"timestamp": ts, "risk": seg_risk, "score": frame_scores[i] if i < len(frame_scores) else 0})

    return {
        "kind": "ai_video",
        "label": "AI Video Analyzer",
        "file_name": filename,
        "file_size_kb": round(len(content) / 1024, 1),
        "resolution": f"{width}x{height}",
        "duration_seconds": round(duration_sec, 1),
        "frames_analyzed": len(frame_scores),
        "classification": classification,
        "ai_probability": int(sum(frame_scores) / len(frame_scores)) if frame_scores else 0,
        "deepfake_risk": deepfake_risk,
        "suspicious_frame_count": len(suspicious_idx),
        "timeline": timeline,
        "explanation": ("This video was sampled at up to 8 evenly-spaced frames and each frame was scored with "
                         "the same heuristic image-analysis engine, then aggregated into a video-level risk score. "
                         "This is Demo Data using a placeholder detector — production deepfake detection needs a "
                         "dedicated temporal/face-consistency model."),
        "technical": f"FPS: {fps:.1f}\nTotal frames: {total_frames}\nSampled frames: {len(frame_scores)}\nResolution: {width}x{height}",
        "actions": ["Treat this as an indicator, not proof.",
                     "Cross-verify with the original source/publisher.",
                     "For high-stakes verification (legal, journalistic), use a specialized forensic service."],
        "demo": True,
    }
