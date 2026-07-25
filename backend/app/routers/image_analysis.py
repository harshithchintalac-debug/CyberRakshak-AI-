from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import ai_image_analysis_col
from app.services.image_forensics import analyze_image

router = APIRouter(prefix="/api/ai-image", tags=["ai-content"])

ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}


@router.post("/analyze")
async def analyze_image_endpoint(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format .{ext}. Allowed: {', '.join(sorted(ALLOWED_EXT))}")

    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"Image exceeds {settings.MAX_IMAGE_SIZE_MB}MB limit")

    try:
        result = analyze_image(file.filename, content)
    except Exception:
        raise HTTPException(400, "Could not read this image — the file may be corrupt or unsupported")

    doc = {**result, "user_id": str(user["_id"]), "created_at": datetime.now(timezone.utc)}
    await ai_image_analysis_col().insert_one(doc)
    return result


@router.get("/history")
async def image_history(limit: int = 20, user: dict = Depends(get_current_user)):
    cursor = ai_image_analysis_col().find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return {"items": items}
