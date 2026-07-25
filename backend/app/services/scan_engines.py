"""
Rule-based detection engines. These are real, deterministic heuristics
(not calls to an LLM) so results are explainable and reproducible.
Where a genuine verdict requires a live third-party API (malware
detonation, breach databases) results are marked demo=True.
"""
import re
import hashlib
from urllib.parse import urlparse

SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly"]
BRANDS = ["paypal", "google", "microsoft", "apple", "amazon", "netflix", "facebook", "instagram",
          "whatsapp", "sbi", "icici", "hdfc", "axis", "irctc", "indiapost", "flipkart"]
SUSPICIOUS_TLDS = [".zip", ".xyz", ".top", ".club", ".gq", ".tk", ".ml", ".cf", ".work", ".click"]
TUNNEL_DOMAINS = ["trycloudflare.com", "ngrok-free.app", "ngrok.io", "localtunnel.me", "duckdns.org"]
COMMON_PASSWORDS = {"password", "123456", "123456789", "qwerty", "111111", "abc123",
                     "password1", "iloveyou", "admin", "letmein", "welcome", "india123"}

SCAM_PATTERNS = [
    (re.compile(r"otp|one[- ]time password", re.I), "OTP Scam", "Mentions an OTP — legitimate services never ask you to share this"),
    (re.compile(r"kyc|update.*(bank|account).*(detail|info)", re.I), "KYC Scam", "Requests KYC/account update, a common banking impersonation scam"),
    (re.compile(r"won|lottery|prize|jackpot|lucky draw", re.I), "Lottery Scam", "Claims you won a prize you never entered for"),
    (re.compile(r"work from home|earn.{0,15}(per day|daily)|part[- ]time job|easy money", re.I), "Fake Job Offer", "Unrealistic earning promises typical of job scams"),
    (re.compile(r"invest|double your money|guaranteed return|crypto.{0,15}profit", re.I), "Investment Scam", "Promises unrealistic investment returns"),
    (re.compile(r"parcel|courier|delivery.{0,15}(fail|hold|pending)|customs", re.I), "Delivery Scam", "Fake delivery/customs notice used to harvest personal data"),
    (re.compile(r"blocked|suspend|deactivat|expire.{0,10}(today|now|24)", re.I), "Urgency / Fear Tactic", "Creates false urgency to pressure quick action"),
    (re.compile(r"click here|verify now|act now|claim now", re.I), "Urgency / Fear Tactic", "Pushes you to click immediately without thinking"),
    (re.compile(r"government|income tax|police|arrest warrant", re.I), "Fake Government Notice", "Impersonates a government authority to intimidate"),
    (re.compile(r"pay.{0,10}(fee|charge)|processing fee|advance payment", re.I), "Payment Request Scam", "Requests upfront payment, a classic scam pattern"),
    (re.compile(r"(https?://|www\.)\S+", re.I), "Suspicious Link", "Contains a link — verify the destination before clicking"),
]


def _risk_from_score(score: int) -> str:
    if score < 15:
        return "safe"
    if score < 35:
        return "low"
    if score < 60:
        return "medium"
    if score < 85:
        return "high"
    return "critical"


def analyze_url(raw: str) -> dict:
    url = raw.strip()
    indicators = []
    score = 6
    try:
        parsed = urlparse(url if re.match(r"^https?://", url) else "http://" + url)
        host = parsed.hostname or url.lower()
    except Exception:
        host = url.lower()
    host = host.lower()

    is_ip = bool(re.match(r"^(\d{1,3}\.){3}\d{1,3}$", host))
    if is_ip:
        indicators.append(["high", "Uses a raw IP address instead of a domain name"]); score += 30
    if not re.match(r"^https?://", url, re.I):
        indicators.append(["low", "No protocol specified — treated as insecure by default"]); score += 5
    if re.match(r"^http://", url, re.I):
        indicators.append(["medium", "Connection is not encrypted (HTTP, not HTTPS)"]); score += 15
    if "@" in url:
        indicators.append(["high", "Contains \"@\" symbol, often used to disguise the real destination"]); score += 25
    hyphens = host.count("-")
    if hyphens >= 3:
        indicators.append(["medium", f"Domain has an unusually high number of hyphens ({hyphens})"]); score += 12
    if any(s in host for s in SHORTENERS):
        indicators.append(["medium", "Uses a link-shortening service that hides the real destination"]); score += 18
    tld_hit = next((t for t in SUSPICIOUS_TLDS if host.endswith(t)), None)
    if tld_hit:
        indicators.append(["medium", f"Uses a top-level domain ({tld_hit}) commonly abused for scam sites"]); score += 15
    brand_hit = next((b for b in BRANDS if b in host), None)
    if brand_hit and not host.endswith(brand_hit + ".com") and f".{brand_hit}." not in host:
        indicators.append(["high", f"Domain references the brand \"{brand_hit}\" but isn't its official domain — possible impersonation"]); score += 28
    if len(host) > 35:
        indicators.append(["low", "Unusually long domain name"]); score += 6
    if re.search(r"\d{4,}", host):
        indicators.append(["low", "Domain contains a long numeric sequence, common in auto-generated scam domains"]); score += 8
    if len(url) > 110:
        indicators.append(["low", "Very long URL, which can conceal redirect chains"]); score += 5

    # Tunnel domain detection (e.g., Cloudflare Tunnels, Ngrok)
    tunnel_hit = next((t for t in TUNNEL_DOMAINS if host.endswith(t)), None)
    if tunnel_hit:
        indicators.append(["high", f"Uses a free tunneling or dynamic DNS service ({tunnel_hit}) — commonly abused to host temporary phishing sites"])
        score += 35
        if any(keyword in url.lower() for keyword in ["login", "signin", "verify", "secure", "credential", "auth"]):
            indicators.append(["critical", "Impersonates a secure login or verification portal on a temporary tunnel domain"])
            score += 40

    # Live VirusTotal v3 API Threat Intelligence
    vt_info = "VirusTotal: not queried"
    try:
        from app.services.virustotal_service import scan_url_vt
        vt_res = scan_url_vt(url)
        if vt_res.get("queried"):
            mal_flags = vt_res.get("malicious_count", 0)
            susp_flags = vt_res.get("suspicious_count", 0)
            total_eng = vt_res.get("total_engines", 0)
            flagged_by = vt_res.get("flagged_engines", [])
            vt_info = vt_res.get("message", "")

            if mal_flags > 0 or susp_flags > 0:
                severity = "critical" if mal_flags >= 3 else "high"
                indicators.append([severity, f"VirusTotal Threat Intel: Flagged by {mal_flags} malicious / {susp_flags} suspicious security engines (out of {total_eng})"])
                score = max(score, 75 + min(22, (mal_flags + susp_flags) * 4))
                if flagged_by:
                    indicators.append(["medium", f"Flagged by security engines: {', '.join(flagged_by[:6])}"])
            else:
                indicators.append(["safe", f"VirusTotal Threat Intel: Verified clean across {total_eng} security engines"])
                score = max(0, score - 10)
    except Exception as e:
        vt_info = f"VirusTotal check skipped: {str(e)}"

    if not indicators:
        indicators.append(["safe", "No common phishing or malware URL patterns detected"])

    score = min(97, score)
    risk = _risk_from_score(score)
    confidence = min(96, 60 + len(indicators) * 6)

    if risk in ("safe", "low"):
        explanation = ("This link doesn't show the typical red flags of phishing or malware URLs "
                        "(no IP-based address, no brand impersonation, no suspicious shortener). "
                        "Still, always check the destination site itself before entering personal information.")
        actions = ["You can proceed, but still verify the site looks legitimate before logging in.",
                   "Bookmark official sites instead of clicking links in messages."]
    else:
        brand_note = f" — particularly impersonation of \"{brand_hit}\"" if brand_hit else ""
        explanation = (f"This link shows patterns commonly seen in phishing or scam campaigns{brand_note}. "
                        "Malicious links often mimic trusted brands to steal login details or payment information.")
        actions = ["Do not click this link or enter any information.",
                   "Do not enter your password, OTP, or card details.",
                   "Report the message to your bank/platform if it claims to be from them.",
                   "Delete the message."]

    technical = (f"Host: {host}\nProtocol: {'HTTPS' if url.startswith('https') else 'HTTP' if url.startswith('http') else 'none specified'}\n"
                 f"IP-based host: {is_ip}\nHyphen count: {hyphens}\nLength: {len(url)} chars\n"
                 f"Engine: rule-based + VirusTotal Reputation Service\nDetails: {vt_info}")

    return {"kind": "url", "label": "Malicious URL Detector", "target": url, "score": score, "risk": risk,
            "confidence": confidence, "indicators": indicators, "explanation": explanation,
            "technical": technical, "actions": actions, "demo": False}


def analyze_email(body: str, sender: str = "", subject: str = "") -> dict:
    indicators = []
    score = 6
    sender_domain = (sender.split("@")[-1] if "@" in sender else "").lower()
    free_providers = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com"}
    haystack = (subject + " " + body).lower()
    claimed_brand = next((b for b in BRANDS if b in haystack), None)

    if claimed_brand and sender_domain in free_providers:
        indicators.append(["high", f"Claims to be from \"{claimed_brand}\" but was sent from a free email provider ({sender_domain or 'unknown'})"]); score += 30
    if claimed_brand and sender_domain and claimed_brand not in sender_domain:
        indicators.append(["high", f"Sender domain \"{sender_domain}\" doesn't match the claimed brand \"{claimed_brand}\""]); score += 25
    if re.search(r"urgent|immediately|within 24 hours|act now|final notice", body, re.I):
        indicators.append(["medium", "Uses urgency language to rush your decision"]); score += 15
    if re.search(r"suspend|blocked|locked|unauthorized (login|access)", body, re.I):
        indicators.append(["medium", "Uses fear tactics about account suspension or unauthorized access"]); score += 14
    if re.search(r"verify your (account|identity|password)|confirm your (details|password)|update.*payment", body, re.I):
        indicators.append(["high", "Asks you to verify credentials or payment details — a classic credential-theft tactic"]); score += 22
    if re.search(r"click here|login here|verify now", body, re.I):
        indicators.append(["medium", "Contains a generic \"click here\" call-to-action typical of phishing"]); score += 10
    if re.search(r"https?://\S+", body):
        indicators.append(["medium", "Contains an embedded link — inspect the destination before clicking"]); score += 8
    if re.search(r"\.(exe|scr|zip|bat|apk)(\s|$)", body, re.I):
        indicators.append(["high", "References a potentially dangerous attachment type"]); score += 20
    if re.search(r"dear (customer|user|valued)", body, re.I):
        indicators.append(["low", "Generic greeting instead of your actual name"]); score += 6
    # Extract embedded URLs and run VirusTotal Reputation check
    vt_email_info = "VirusTotal Email Link Check: No links scanned"
    embedded_urls = re.findall(r"https?://[^\s\"'>]+", subject + " " + body)
    if embedded_urls:
        try:
            from app.services.virustotal_service import scan_url_vt
            for u in embedded_urls[:3]:
                vt_r = scan_url_vt(u)
                if vt_r.get("queried"):
                    m_cnt = vt_r.get("malicious_count", 0)
                    s_cnt = vt_r.get("suspicious_count", 0)
                    t_eng = vt_r.get("total_engines", 0)
                    if m_cnt > 0 or s_cnt > 0:
                        indicators.append(["critical", f"VirusTotal Threat Intel: Embedded email link ({u[:40]}...) FLAGGED by {m_cnt} malicious / {s_cnt} suspicious security engines"])
                        score = max(score, 85)
                        vt_email_info = f"VirusTotal: Embedded link {u} FLAGGED as malicious by {m_cnt} engines"
                    else:
                        vt_email_info = f"VirusTotal: Verified embedded link {u[:40]}... (Clean across {t_eng} engines)"
        except Exception as e:
            vt_email_info = f"VirusTotal link scan skipped: {str(e)}"

    if not indicators:
        indicators.append(["safe", "No common phishing indicators detected in sender, subject, or body"])

    score = min(97, score)
    risk = _risk_from_score(score)
    confidence = min(95, 60 + len(indicators) * 6)

    if risk in ("safe", "low"):
        explanation = ("This email doesn't show strong phishing indicators. It doesn't combine urgency, "
                        "credential requests, and domain mismatches the way typical phishing does.")
        actions = ["Still verify sender address matches the official domain before acting."]
    else:
        brand_note = f", while impersonating \"{claimed_brand}\"" if claimed_brand else ""
        explanation = (f"This email shows classic phishing traits — pressure tactics combined with requests to "
                        f"\"verify\" credentials or account details{brand_note}. Legitimate companies rarely ask "
                        "you to verify sensitive details by email.")
        actions = ["Do not click links or download attachments.",
                   "Do not reply with personal or financial information.",
                   "Report as phishing via your email provider.",
                   "Contact the company directly using their official website, not this email."]

    technical = (f"Sender: {sender or 'not provided'}\nSender domain: {sender_domain or 'unknown'}\n"
                 f"Subject: {subject or 'none'}\nBody length: {len(body)} chars\n"
                 f"Brand referenced: {claimed_brand or 'none'}\nEngine: rule-based NLP + VirusTotal URL Threat Intel\n"
                 f"VirusTotal Details: {vt_email_info}")

    return {"kind": "email", "label": "AI Phishing Email Detector", "target": subject or "(no subject)",
            "score": score, "risk": risk, "confidence": confidence, "indicators": indicators,
            "explanation": explanation, "technical": technical, "actions": actions, "demo": False}


def analyze_message(text: str) -> dict:
    indicators = []
    categories = []
    score = 5
    for pattern, cat, note in SCAM_PATTERNS:
        if pattern.search(text):
            indicators.append(["high", note])
            if cat not in categories:
                categories.append(cat)
            score += 14
    score = min(96, score)
    risk = _risk_from_score(score)
    if not indicators:
        indicators.append(["safe", "No common scam keywords or patterns detected"])
    confidence = min(95, 58 + len(indicators) * 7)

    if risk in ("safe", "low"):
        explanation = ("This message doesn't match common scam patterns used in banking, lottery, delivery, "
                        "or job scams. Still, be cautious with any unexpected message asking for action.")
        actions = ["No immediate action needed — stay alert for follow-up messages."]
    else:
        cat_note = f" ({categories[0]})" if categories else ""
        explanation = (f"This message matches known scam patterns{cat_note}. These messages are designed to "
                        "create urgency and trick you into clicking links or sharing sensitive information.")
        actions = ["Do not click any links in this message.",
                   "Never share OTP, PIN, or card details via SMS/WhatsApp.",
                   "Verify directly with the organization using their official number.",
                   "Block and report the sender."]

    technical = (f"Length: {len(text)} chars\nPattern matches: {len(indicators)}\n"
                 f"Categories flagged: {', '.join(categories) or 'none'}\nEngine: keyword + heuristic pattern matching")

    return {"kind": "message", "label": "SMS / WhatsApp Scam Detector", "target": text[:80] + ("…" if len(text) > 80 else ""),
            "score": score, "risk": risk, "confidence": confidence, "indicators": indicators,
            "explanation": explanation, "technical": technical, "actions": actions, "demo": False,
            "extra": {"scam_category": ", ".join(categories) or "None detected"}}


def analyze_password(pw: str) -> dict:
    score = 0
    indicators = []
    if len(pw) >= 12:
        score += 30
    elif len(pw) >= 8:
        score += 18
    else:
        score += 4
        indicators.append(["high", "Too short — use at least 12 characters"])
    if re.search(r"[a-z]", pw) and re.search(r"[A-Z]", pw):
        score += 18
    else:
        indicators.append(["medium", "Mix uppercase and lowercase letters"])
    if re.search(r"\d", pw):
        score += 16
    else:
        indicators.append(["medium", "Add at least one number"])
    if re.search(r"[^a-zA-Z0-9]", pw):
        score += 18
    else:
        indicators.append(["medium", "Add a symbol (e.g. ! @ # $)"])
    if not re.search(r"(.)\1{2,}", pw):
        score += 8
    else:
        indicators.append(["high", "Contains repeated characters (e.g. \"aaa\")"])
    if not re.search(r"012|123|234|345|456|567|678|789|abc|bcd|cde", pw, re.I):
        score += 6
    else:
        indicators.append(["high", "Contains a sequential pattern (e.g. \"123\", \"abc\")"])
    if pw.lower() not in COMMON_PASSWORDS:
        score += 4
    else:
        indicators.append(["critical", "This is one of the most commonly breached passwords in the world"])
        score = min(score, 8)

    score = min(100, score)
    risk = ("critical" if score < 30 else "high" if score < 50 else "medium" if score < 75
            else "low" if score < 90 else "safe")
    strength = ("Weak" if score < 50 else "Medium" if score < 75 else "Strong" if score < 90 else "Very Strong")
    if not indicators:
        indicators.append(["safe", "Good length and character diversity"])

    explanation = (f"Your password scores as \"{strength}\". "
                    + ("Weak passwords are cracked in seconds by automated tools and are the #1 cause of account takeovers."
                       if score < 50 else
                       "Strong passwords significantly reduce the risk of automated cracking, but should still be unique per account."))
    technical = (f"Length: {len(pw)}\nHas upper+lower: {bool(re.search(r'[a-z]', pw) and re.search(r'[A-Z]', pw))}\n"
                 f"Has digit: {bool(re.search(r'[0-9]', pw))}\nHas symbol: {bool(re.search(r'[^a-zA-Z0-9]', pw))}\n"
                 "Note: password is analyzed server-side for this one request and is never stored in plaintext or logged.")

    return {"kind": "password", "label": "Password Security Checker", "target": "•" * len(pw),
            "score": 100 - score, "risk": risk, "confidence": 92, "indicators": indicators,
            "explanation": explanation, "technical": technical,
            "actions": ["Use a unique password for every account.",
                        "Turn on multi-factor authentication wherever possible.",
                        "Consider a password manager to generate and store strong passwords."],
            "demo": False, "extra": {"strength": strength, "display_score": score}}


def check_breach(email: str) -> dict:
    """Demo Data — real implementation should call a breach-intelligence API
    (e.g. Have I Been Pwned) via services/breach_intel.py."""
    digest = hashlib.sha256(email.lower().encode()).hexdigest()
    seed = int(digest[:8], 16)
    breached = seed % 3 != 0
    count = 1 + (seed % 6) if breached else 0
    types_pool = ["Email addresses", "Passwords (hashed)", "Phone numbers", "Usernames"]
    types = types_pool[: 1 + (seed % 3)] if breached else []
    return {"kind": "breach", "email": email, "breached": breached, "count": count, "types": types, "demo": True}
