"""
VirusTotal API v3 integration service.
Handles live threat intelligence lookups for URLs, files/PDFs, and embedded email links
using the VirusTotal v3 REST API.
"""
import base64
import hashlib
import json
import logging
import re
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional, List, Tuple

from app.config import settings

logger = logging.getLogger("cyberrakshak.virustotal")


def _get_api_key() -> str:
    key = settings.VIRUSTOTAL_API_KEY or settings.URL_REPUTATION_API_KEY or settings.MALWARE_SCAN_API_KEY
    return key.strip() if key else ""


def _vt_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, timeout: float = 8.0) -> Optional[Dict[str, Any]]:
    api_key = _get_api_key()
    if not api_key:
        return None

    url = f"https://www.virustotal.com/api/v3/{endpoint.lstrip('/')}"
    headers = {
        "x-apikey": api_key,
        "Accept": "application/json",
        "User-Agent": "CyberRakshak-AI-Scanner/2.0",
    }

    req_data = None
    if data:
        req_data = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status in (200, 201):
                body = resp.read().decode("utf-8")
                return json.loads(body)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"error": "not_found", "status": 404}
        logger.warning("VirusTotal API HTTP error %s for %s", e.code, endpoint)
    except Exception as e:
        logger.warning("VirusTotal API request failed (%s): %s", type(e).__name__, str(e))
    return None


def scan_url_vt(url: str) -> Dict[str, Any]:
    """
    Checks URL threat intelligence on VirusTotal v3 API.
    Returns parsed detection statistics and flagged engines.
    """
    api_key = _get_api_key()
    if not api_key:
        return {"configured": False, "queried": False, "message": "VirusTotal API key not configured"}

    url_clean = url.strip()
    url_id = base64.urlsafe_b64encode(url_clean.encode("utf-8")).decode("utf-8").strip("=")

    result = _vt_request(f"urls/{url_id}")

    if result and result.get("error") == "not_found":
        submit_res = _vt_request("urls", method="POST", data={"url": url_clean})
        if submit_res and "data" in submit_res:
            analysis_id = submit_res["data"].get("id")
            return {
                "configured": True,
                "queried": True,
                "submitted": True,
                "analysis_id": analysis_id,
                "malicious_count": 0,
                "total_engines": 0,
                "flagged_engines": [],
                "message": "URL submitted to VirusTotal for analysis",
            }
        return {"configured": True, "queried": True, "error": "Submission failed", "message": "Failed to submit URL to VirusTotal"}

    if not result or "data" not in result:
        return {"configured": True, "queried": False, "message": "VirusTotal lookup failed or timed out"}

    attrs = result["data"].get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    results = attrs.get("last_analysis_results", {})

    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)
    harmless = stats.get("harmless", 0)
    total = sum(stats.values()) if stats else 0

    flagged_engines = []
    for engine_name, res in results.items():
        cat = res.get("category")
        if cat in ("malicious", "suspicious"):
            flagged_engines.append(f"{engine_name} ({res.get('result') or cat})")

    return {
        "configured": True,
        "queried": True,
        "malicious_count": malicious,
        "suspicious_count": suspicious,
        "harmless_count": harmless,
        "total_engines": total,
        "flagged_engines": flagged_engines,
        "categories": attrs.get("categories", {}),
        "reputation": attrs.get("reputation", 0),
        "message": f"VirusTotal: {malicious} malicious / {suspicious} suspicious detections across {total} engines",
    }


def scan_file_vt(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Looks up file SHA-256 hash on VirusTotal v3 API.
    """
    api_key = _get_api_key()
    if not api_key:
        return {"configured": False, "queried": False, "message": "VirusTotal API key not configured"}

    sha256 = hashlib.sha256(file_bytes).hexdigest()
    result = _vt_request(f"files/{sha256}")

    if result and result.get("error") == "not_found":
        return {
            "configured": True,
            "queried": True,
            "found_in_vt": False,
            "sha256": sha256,
            "malicious_count": 0,
            "total_engines": 0,
            "flagged_engines": [],
            "message": f"VirusTotal: File SHA-256 ({sha256[:12]}...) not found in existing threat database.",
        }

    if not result or "data" not in result:
        return {"configured": True, "queried": False, "sha256": sha256, "message": "VirusTotal file lookup failed or timed out"}

    attrs = result["data"].get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    results = attrs.get("last_analysis_results", {})

    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)
    total = sum(stats.values()) if stats else 0

    flagged_engines = []
    for engine_name, res in results.items():
        cat = res.get("category")
        if cat in ("malicious", "suspicious"):
            flagged_engines.append(f"{engine_name} ({res.get('result') or cat})")

    popular_threat = attrs.get("popular_threat_classification", {}).get("suggested_threat_label", "")

    return {
        "configured": True,
        "queried": True,
        "found_in_vt": True,
        "sha256": sha256,
        "malicious_count": malicious,
        "suspicious_count": suspicious,
        "total_engines": total,
        "flagged_engines": flagged_engines,
        "popular_threat": popular_threat,
        "file_type": attrs.get("type_description", ""),
        "message": f"VirusTotal: {malicious} malicious / {suspicious} suspicious detections out of {total} security engines" + (f" (Threat Label: {popular_threat})" if popular_threat else ""),
    }


def analyze_pdf_content(file_bytes: bytes) -> Tuple[List[Tuple[str, str]], List[str]]:
    """
    Performs PDF binary structure inspection.
    Checks for embedded JavaScript, auto-open actions, launch parameters, and embedded URLs.
    """
    indicators = []
    embedded_urls = []

    is_pdf = file_bytes.startswith(b"%PDF-")
    if not is_pdf:
        return [("medium", "File extension is .pdf but binary header does not match PDF format")], []

    content_str = file_bytes.decode("latin-1", errors="ignore")

    js_matches = re.findall(r"/JS\b|/JavaScript\b", content_str, re.I)
    if js_matches:
        indicators.append(("high", f"PDF contains embedded JavaScript ({len(js_matches)} occurrences) — potential automated exploit execution"))

    if re.search(r"/OpenAction\b|/AA\b", content_str, re.I):
        indicators.append(("high", "PDF contains automatic execution actions (/OpenAction /AA) triggered upon viewing"))

    if re.search(r"/Launch\b", content_str, re.I):
        indicators.append(("critical", "PDF contains /Launch action configured to execute external system applications"))

    if re.search(r"/EmbeddedFiles\b|/Type\s*/Filespec", content_str, re.I):
        indicators.append(("medium", "PDF contains embedded binary attachments/files inside document streams"))

    found_urls = re.findall(r"https?://[^\s<>\(\)\"']+", content_str, re.I)
    for u in found_urls:
        u_clean = u.rstrip(".,;)")
        if u_clean not in embedded_urls:
            embedded_urls.append(u_clean)

    if embedded_urls:
        indicators.append(("medium", f"PDF contains {len(embedded_urls)} embedded web link(s)"))

    return indicators, embedded_urls
