import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.auth.dependencies import get_current_user_optional, get_current_user
from app.database import security_scans_col
from app.config import settings
from app.models.scan import (UnifiedScanRequest, URLScanRequest, EmailScanRequest,
                              MessageScanRequest, PasswordCheckRequest, BreachCheckRequest)
from app.services.scan_engines import analyze_url, analyze_email, analyze_message, analyze_password, check_breach
from app.services.file_engine import analyze_file_bytes, analyze_qr_demo

router = APIRouter(prefix="/api/scan", tags=["scan"])

URL_PATTERN = re.compile(r"^(https?://|www\.)?[a-z0-9-]+\.[a-z]{2,}(/\S*)?$", re.I)


async def _save_scan(user: dict | None, result: dict):
    if user is None:
        return
    doc = {**result, "user_id": str(user["_id"]), "created_at": datetime.now(timezone.utc)}
    await security_scans_col().insert_one(doc)


@router.post("/unified")
async def unified_scan(payload: UnifiedScanRequest, user: dict | None = Depends(get_current_user_optional)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(400, "No content provided")

    if URL_PATTERN.match(text) and " " not in text and "\n" not in text:
        result = analyze_url(text)
    elif re.search(r"(?im)^(from|subject)[:\s]", text) or ("@" in text and re.search(r"subject|dear|regards|click here|verify", text, re.I)):
        from_match = re.search(r"from[:\s]+([^\n]+)", text, re.I)
        subj_match = re.search(r"subject[:\s]+([^\n]+)", text, re.I)
        result = analyze_email(text, from_match.group(1).strip() if from_match else "unknown@unknown.com",
                                subj_match.group(1).strip() if subj_match else "")
    else:
        result = analyze_message(text)

    await _save_scan(user, result)
    return result


@router.post("/url")
async def scan_url(payload: URLScanRequest, user: dict | None = Depends(get_current_user_optional)):
    result = analyze_url(payload.url)
    await _save_scan(user, result)
    return result


@router.post("/email")
async def scan_email(payload: EmailScanRequest, user: dict | None = Depends(get_current_user_optional)):
    result = analyze_email(payload.body, payload.sender or "", payload.subject or "")
    await _save_scan(user, result)
    return result


@router.post("/message")
async def scan_message(payload: MessageScanRequest, user: dict | None = Depends(get_current_user_optional)):
    result = analyze_message(payload.text)
    await _save_scan(user, result)
    return result


@router.post("/password")
async def scan_password(payload: PasswordCheckRequest, user: dict | None = Depends(get_current_user_optional)):
    # Password is analyzed in-memory for this single request only — never persisted, never logged.
    result = analyze_password(payload.password)
    safe_to_store = {**result, "target": "•" * len(payload.password)}
    await _save_scan(user, safe_to_store)
    return result


@router.post("/breach")
async def scan_breach(payload: BreachCheckRequest, user: dict | None = Depends(get_current_user_optional)):
    result = check_breach(payload.email)
    await _save_scan(user, {**result, "label": "Data Breach Checker", "score": 0, "risk": "medium" if result["breached"] else "safe",
                             "confidence": 60, "indicators": [], "explanation": "", "technical": "", "actions": [], "target": payload.email})
    return result


@router.post("/file")
async def scan_file(file: UploadFile = File(...), user: dict | None = Depends(get_current_user_optional)):
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")
    result = analyze_file_bytes(file.filename or "unknown", content)
    await _save_scan(user, result)
    return result


@router.post("/qr")
async def scan_qr(file: UploadFile = File(...), user: dict | None = Depends(get_current_user_optional)):
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")
    result = analyze_qr_demo(file.filename or "qr.png")
    await _save_scan(user, result)
    return result


@router.get("/history")
async def scan_history(limit: int = 30, user: dict = Depends(get_current_user)):
    # user_id is always taken from the authenticated token, never a client-supplied
    # parameter, so users can only ever see their own scan history.
    cursor = security_scans_col().find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return {"items": items}
