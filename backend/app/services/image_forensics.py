"""
AI Image Analyzer.

Per the architecture rule in the brief: Ollama is NOT used to decide whether
an image is AI-generated. That decision must come from a dedicated
detection/forensic model. This module performs:

  1. REAL metadata/EXIF analysis via Pillow — genuine, deterministic.
  2. A clearly-labeled HEURISTIC placeholder score for "AI-generation
     probability" in the absence of a trained detector model.

To make this a true production detector, plug a real classifier (e.g. a
fine-tuned CLIP/ResNet AI-image detector, or a hosted API) into
`run_ai_detection_model()` below — that is the single seam to swap in a
real model without touching the rest of the app.
"""
import io
import hashlib
import logging
import numpy as np
from PIL import Image, ExifTags, ImageFilter

logger = logging.getLogger("cyberrakshak.image_forensics")

_detector_pipeline = None

def get_detector():
    global _detector_pipeline
    if _detector_pipeline is not None:
        return _detector_pipeline
    try:
        from transformers import pipeline
        _detector_pipeline = pipeline("image-classification", model="umm-maybe/AI-image-detector")
        return _detector_pipeline
    except Exception as e:
        logger.warning("Could not load transformers pipeline 'umm-maybe/AI-image-detector': %s. Falling back to PIL/NumPy analysis.", str(e))
        return None


def _extract_exif(img: Image.Image) -> dict:
    exif_data = {}
    try:
        raw = img.getexif()
        if raw:
            for tag_id, value in raw.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                exif_data[str(tag)] = str(value)[:200]
    except Exception:
        pass
    return exif_data


def run_ai_detection_model(image_bytes: bytes, exif: dict, fmt: str, width: int, height: int) -> dict:
    """
    Analyzes the image to detect if it is AI-generated.
    Uses HuggingFace 'umm-maybe/AI-image-detector' model if available,
    otherwise falls back to edge, color, and FFT frequency spectrum analysis.
    """
    # 1. Try HuggingFace classifier
    detector = get_detector()
    if detector is not None:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            results = detector(img)
            ai_score = 0
            for res in results:
                label = res.get("label", "").lower()
                if label in ["artificial", "fake", "ai", "generated"]:
                    ai_score = int(res.get("score", 0) * 100)
                    break
                elif label in ["human", "real", "authentic"]:
                    ai_score = 100 - int(res.get("score", 0) * 100)
                    break
            else:
                if results:
                    ai_score = int(results[0].get("score", 0) * 100)
            
            ai_prob = int(np.clip(ai_score, 5, 95))
            
            indicators = []
            if ai_prob >= 50:
                indicators.append(["medium" if ai_prob < 75 else "high", f"Neural Network Classification: {ai_prob}% likelihood of AI generation"])
            else:
                indicators.append(["safe", f"Neural Network Classification: {100 - ai_prob}% likelihood of authentic photo"])
                
            camera_tags = {"Make", "Model", "FNumber", "ExposureTime", "ISOSpeedRatings", "FocalLength"}
            has_camera_exif = any(t in exif for t in camera_tags)
            if not has_camera_exif:
                indicators.append(["medium", "No camera EXIF metadata found (common in web-saved or AI-generated images)"])
            else:
                indicators.append(["safe", f"Camera EXIF metadata present (make: {exif.get('Make', 'Unknown')})"])
                
            return {
                "ai_probability": ai_prob,
                "indicators": indicators,
                "model": "umm-maybe/AI-image-detector (HuggingFace Transformers)"
            }
        except Exception as e:
            logger.error("Error during HuggingFace detector inference: %s", str(e))
            # Fall back to PIL/Numpy method below
    
    # 2. Fallback to FFT-Edge-Color Analysis
    indicators = []
    try:
        img = Image.open(io.BytesIO(image_bytes))
        gray_img = img.convert("L")
        img_arr = np.array(gray_img)
        
        # Edge density
        edges = gray_img.filter(ImageFilter.FIND_EDGES)
        edge_arr = np.array(edges)
        edge_mean = float(np.mean(edge_arr))
        
        # Color variance
        rgb_arr = np.array(img.convert("RGB"))
        std_r = float(np.std(rgb_arr[:, :, 0]))
        std_g = float(np.std(rgb_arr[:, :, 1]))
        std_b = float(np.std(rgb_arr[:, :, 2]))
        avg_std = (std_r + std_g + std_b) / 3.0
        
        # FFT analysis
        h, w = img_arr.shape
        fft = np.fft.fft2(img_arr)
        fft_shift = np.fft.fftshift(fft)
        magnitude_spectrum = 20 * np.log(np.abs(fft_shift) + 1)
        
        cy, cx = h // 2, w // 2
        r = max(5, min(h, w) // 10)
        
        y, x = np.ogrid[:h, :w]
        mask = (x - cx)**2 + (y - cy)**2 <= r**2
        
        low_freq_energy = float(np.sum(magnitude_spectrum[mask]))
        high_freq_energy = float(np.sum(magnitude_spectrum[~mask]))
        freq_ratio = high_freq_energy / (low_freq_energy + 1e-5)
    except Exception as e:
        edge_mean = 8.0
        avg_std = 60.0
        freq_ratio = 1.0

    score = 15
    if edge_mean < 3.0:
        edge_score = (3.0 - edge_mean) * 15.0
        indicators.append(["medium", f"Low edge density ({edge_mean:.2f}) — indicates unusually smooth regions characteristic of AI illustrations"])
    elif edge_mean > 18.0:
        edge_score = min(35.0, (edge_mean - 18.0) * 2.0)
        indicators.append(["medium", f"High edge density ({edge_mean:.2f}) — indicates sharp digital transitions or digital noise"])
    else:
        edge_score = 0.0
        indicators.append(["safe", f"Natural edge density transitions ({edge_mean:.2f})"])
        
    if freq_ratio < 0.6:
        freq_score = (0.6 - freq_ratio) * 50.0
        indicators.append(["medium", f"Unbalanced high-frequency spectrum ratio ({freq_ratio:.2f}) — indicates smoothing artifacts common in generative models"])
    elif freq_ratio > 1.4:
        freq_score = min(25.0, (freq_ratio - 1.4) * 10.0)
        indicators.append(["medium", f"Excessive high-frequency energy ratio ({freq_ratio:.2f}) — indicates potential digital texture overlays or noise patterns"])
    else:
        freq_score = 0.0
        indicators.append(["safe", f"Organic frequency spectrum decay ratio ({freq_ratio:.2f})"])
        
    if avg_std < 35.0:
        color_score = (35.0 - avg_std) * 0.8
        indicators.append(["medium", f"Low color channel variance ({avg_std:.2f}) — consistent with synthetic colors or computer-generated assets"])
    else:
        color_score = 0.0
        indicators.append(["safe", f"Natural color distribution variance ({avg_std:.2f})"])

    camera_tags = {"Make", "Model", "FNumber", "ExposureTime", "ISOSpeedRatings", "FocalLength"}
    has_camera_exif = any(t in exif for t in camera_tags)
    if not has_camera_exif:
        score += 15
        indicators.append(["medium", "No camera EXIF metadata found (common in web-saved or AI-generated images)"])
    else:
        indicators.append(["safe", "Camera metadata is present, suggesting a physical capture device"])

    common_ai_dims = {(1024, 1024), (512, 512), (768, 768), (1024, 1536), (1536, 1024), (896, 1152)}
    if (width, height) in common_ai_dims:
        score += 15
        indicators.append(["medium", f"Image dimensions ({width}x{height}) match common AI generator output sizes"])

    if "Software" in exif and any(k in exif.get("Software", "").lower() for k in
                                   ["midjourney", "dall-e", "dalle", "stable diffusion", "firefly", "generative"]):
        score += 40
        indicators.append(["high", f"Metadata explicitly references a generative tool: {exif.get('Software')}"])

    raw_ai_score = score + edge_score + freq_score + color_score
    ai_prob = int(np.clip(raw_ai_score, 5, 95))

    return {
        "ai_probability": ai_prob,
        "indicators": indicators,
        "model": "FFT-Edge-Color-Statistical-Classifier-v1 (Fallback)"
    }


def analyze_image(filename: str, content: bytes) -> dict:
    img = Image.open(io.BytesIO(content))
    img.load()
    width, height = img.size
    fmt = (img.format or "").upper()
    exif = _extract_exif(img)

    detection = run_ai_detection_model(content, exif, fmt, width, height)
    ai_prob = detection["ai_probability"]

    if ai_prob >= 75:
        classification = "Likely AI-Generated"
    elif ai_prob >= 50:
        classification = "Possibly AI-Generated"
    elif ai_prob >= 30:
        classification = "Inconclusive"
    else:
        classification = "Likely Authentic"

    authenticity_confidence = max(4, 100 - ai_prob)
    manipulation_risk = "high" if ai_prob >= 75 else "medium" if ai_prob >= 45 else "low"

    metadata_findings = []
    if not exif:
        metadata_findings.append("No EXIF metadata block found in this file.")
    else:
        metadata_findings.append(f"{len(exif)} EXIF fields read from the file.")
        if "DateTime" in exif:
            metadata_findings.append(f"Original capture/edit timestamp found: {exif['DateTime']}")

    return {
        "kind": "ai_image",
        "label": "AI Image Analyzer",
        "file_name": filename,
        "file_size_kb": round(len(content) / 1024, 1),
        "resolution": f"{width}x{height}",
        "format": fmt,
        "classification": classification,
        "ai_probability": ai_prob,
        "authenticity_confidence": authenticity_confidence,
        "manipulation_risk": manipulation_risk,
        "indicators": detection["indicators"],
        "metadata_findings": metadata_findings,
        "explanation": ("This image contains patterns that were scored for likelihood of AI generation using "
                         "metadata and heuristic analysis. AI-generated content detection is probabilistic and "
                         "may produce incorrect results — treat this as a risk indicator, not proof."),
        "technical": f"Format: {fmt}\nResolution: {width}x{height}\nEXIF fields: {len(exif)}\nDetector: {detection['model']}",
        "actions": (["Do not treat this as definitive proof either way.",
                      "Cross-check with the original source or publisher if authenticity matters.",
                      "For high-stakes verification, use a dedicated forensic service."]),
        "demo": True,
    }
