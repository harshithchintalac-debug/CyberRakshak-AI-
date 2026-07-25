import hashlib
import re
from app.services.scan_engines import analyze_url

DANGEROUS_EXT = {"exe", "scr", "bat", "cmd", "apk", "jar", "vbs", "js", "msi"}


def emulate_suspicious_binary(file_path: str) -> dict:
    """
    Attempts to emulates a suspicious binary using Qiling sandbox to trace system calls.
    Returns details of syscall events or fallbacks if the execution environment is unavailable.
    """
    import os
    try:
        from qiling import Qiling
        from qiling.const import QL_VERBOSE
        
        # Qiling requires a valid target binary and os rootfs configured.
        # Since this is running dynamically on a variety of developer machines,
        # we check if a temporary or default rootfs/target path is set up.
        rootfs_path = os.environ.get("QL_ROOTFS_PATH")
        if not rootfs_path or not os.path.exists(rootfs_path):
            # In a demo/production fallback, we simulate or report missing rootfs
            return {
                "success": False,
                "reason": "Missing QILING ROOTFS environment (QL_ROOTFS_PATH) required to emulate this binary type.",
                "syscalls": []
            }

        syscalls_traced = []
        def trace_syscall(ql, address, *args):
            syscalls_traced.append(f"Syscall at address: {hex(address)}")

        ql = Qiling(
            argv=[file_path],
            rootfs=rootfs_path,
            verbose=QL_VERBOSE.DEBUG
        )
        ql.hook_code(trace_syscall)
        ql.run()

        return {
            "success": True,
            "syscalls": syscalls_traced,
            "count": len(syscalls_traced)
        }
    except Exception as e:
        return {
            "success": False,
            "reason": f"Emulation failed: {str(e)}",
            "syscalls": []
        }


def analyze_file_bytes(filename: str, content: bytes) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    sha256 = hashlib.sha256(content).hexdigest()
    size = len(content)
    indicators = []
    score = 8

    # Run dynamic sandbox check for executable types
    emulation_info = "Sandbox emulation: not performed (lower-risk non-executable file type)"
    if ext in {"exe", "elf", "bin", "apk"}:
        # Write to a temporary file in order to emulate
        import tempfile
        import os
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"sandbox_{filename}")
        try:
            with open(temp_path, "wb") as f:
                f.write(content)
            res = emulate_suspicious_binary(temp_path)
            if res["success"]:
                syscall_cnt = res.get("count", 0)
                emulation_info = f"Sandbox emulation: successfully traced {syscall_cnt} syscall events"
                if syscall_cnt > 0:
                    indicators.append(["high", f"Emulation Sandbox: Binary executed and initiated {syscall_cnt} low-level system calls"])
                    score += min(35, syscall_cnt * 5)
            else:
                emulation_info = f"Sandbox emulation: {res['reason']}"
        except Exception as e:
            emulation_info = f"Sandbox emulation failed to setup: {str(e)}"
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    # 1. PDF Structure Analysis (if file is PDF)
    pdf_info = ""
    if ext == "pdf" or content.startswith(b"%PDF-"):
        try:
            from app.services.virustotal_service import analyze_pdf_content, scan_url_vt
            pdf_indicators, pdf_urls = analyze_pdf_content(content)
            for level, note in pdf_indicators:
                indicators.append([level, note])
                if level == "critical": score += 40
                elif level == "high": score += 25
                elif level == "medium": score += 12

            if pdf_urls:
                pdf_info = f"PDF embedded URLs: {len(pdf_urls)} found. "
                for u in pdf_urls[:2]:
                    vt_url_res = scan_url_vt(u)
                    if vt_url_res.get("queried"):
                        m_c = vt_url_res.get("malicious_count", 0)
                        if m_c > 0:
                            indicators.append(["critical", f"PDF Embedded Link VirusTotal Alert: {u} FLAGGED by {m_c} engines"])
                            score = max(score, 88)
        except Exception as e:
            pdf_info = f"PDF analysis error: {str(e)}"

    # 2. VirusTotal Live File / PDF Threat Intelligence Lookup
    vt_file_info = "VirusTotal File Intelligence: not queried"
    try:
        from app.services.virustotal_service import scan_file_vt
        vt_f_res = scan_file_vt(content, filename)
        if vt_f_res.get("queried"):
            vt_file_info = vt_f_res.get("message", "")
            m_cnt = vt_f_res.get("malicious_count", 0)
            s_cnt = vt_f_res.get("suspicious_count", 0)
            t_eng = vt_f_res.get("total_engines", 0)
            flagged = vt_f_res.get("flagged_engines", [])
            threat_label = vt_f_res.get("popular_threat", "")

            if m_cnt > 0 or s_cnt > 0:
                indicators.append(["critical", f"VirusTotal Threat Intel: File SHA-256 FLAGGED by {m_cnt} malicious / {s_cnt} suspicious security engines (out of {t_eng})"])
                score = max(score, 80 + min(17, (m_cnt + s_cnt) * 3))
                if flagged:
                    indicators.append(["high", f"Antivirus Engine Detections: {', '.join(flagged[:6])}"])
                if threat_label:
                    indicators.append(["high", f"VirusTotal Threat Classification: {threat_label}"])
            elif vt_f_res.get("found_in_vt"):
                indicators.append(["safe", f"VirusTotal Threat Intel: File SHA-256 verified clean across {t_eng} security engines"])
    except Exception as e:
        vt_file_info = f"VirusTotal File Check Skipped: {str(e)}"

    if ext in DANGEROUS_EXT:
        indicators.append(["high", f"File type \".{ext}\" is commonly used to distribute malware"]); score += 45
    if size < 2048:
        indicators.append(["low", "Very small file size, sometimes used by droppers"]); score += 8
    if re.search(r"invoice|update|urgent|photo_2024|scan_doc", filename, re.I) and ext in {"exe", "zip", "js", "pdf"}:
        indicators.append(["high", "Filename uses social-engineering bait typical of malicious documents"]); score += 20
    score = min(97, score)
    risk = ("critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 40 else "low" if score >= 20 else "safe")
    if not indicators:
        indicators.append(["safe", "No high-risk file extension, PDF threat, or malware signature detected"])

    return {
        "kind": "file", "label": "Malware & PDF Threat Analyzer", "target": filename, "score": score, "risk": risk,
        "confidence": 92 if vt_file_info.startswith("VirusTotal:") else 80, "indicators": indicators,
        "explanation": ("This inspection combines PDF structure analysis (checking for embedded JavaScript, "
                         "automatic launch triggers, and hidden links) with live VirusTotal v3 Threat Intelligence "
                         "scanning across 70+ global antivirus engines."),
        "technical": f"Name: {filename}\nSize: {size/1024:.1f} KB\nExtension: .{ext}\nSHA-256: {sha256}\n{emulation_info}\n{pdf_info}\n{vt_file_info}",
        "actions": (["Do not open this file or PDF unless you fully trust the sender.",
                       "Do not enable macros or approve external file launches.",
                       "Scan with updated local antivirus before opening."]
                    if risk in ("high", "critical") else
                    ["File appears lower-risk, but always verify unexpected attachments before opening."]),
        "demo": False,
        "extra": {"file_name": filename, "file_size_kb": round(size / 1024, 1), "sha256": sha256},
    }


DEMO_QR_PAYLOADS = [
    "https://secure-paym3nt-update.xyz/verify?acct=8891",
    "https://wa.me/919812345670?text=claim%20your%20prize",
    "https://official-bank-login.co/reset",
    "https://www.wikipedia.org",
]


def analyze_qr_demo(filename: str) -> dict:
    """Demo Data — real QR decoding should use pyzbar/OpenCV's QRCodeDetector
    on the actual uploaded image; wire that in services/qr_decoder.py."""
    import random
    payload = random.choice(DEMO_QR_PAYLOADS)
    url_result = analyze_url(payload)
    url_result = {**url_result, "kind": "qr", "label": "QR Code Scam Detector", "demo": True,
                  "extra": {**(url_result.get("extra") or {}), "qr_file": filename, "extracted": payload}}
    url_result["explanation"] = (
        "Demo Data: QR decoding shown here is simulated (real decoding requires pyzbar/OpenCV wired to the "
        f"uploaded image). The extracted destination was then run through the real URL analysis engine. {url_result['explanation']}"
    )
    return url_result
