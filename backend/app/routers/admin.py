from fastapi import APIRouter, Depends

from app.auth.dependencies import require_admin
from app.database import users_col, security_scans_col, ai_image_analysis_col, ai_video_analysis_col

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await users_col().count_documents({})
    total_scans = await security_scans_col().count_documents({})
    phishing = await security_scans_col().count_documents({"kind": {"$in": ["email", "message"]}})
    malicious_urls = await security_scans_col().count_documents({"kind": "url", "risk": {"$in": ["high", "critical"]}})
    malware = await security_scans_col().count_documents({"kind": "file", "risk": {"$in": ["high", "critical"]}})
    ai_images = await ai_image_analysis_col().count_documents({})
    ai_videos = await ai_video_analysis_col().count_documents({})

    category_counts = {}
    async for doc in security_scans_col().find({}, {"kind": 1}):
        k = doc.get("kind", "other")
        category_counts[k] = category_counts.get(k, 0) + 1

    return {
        "total_users": total_users,
        "total_scans": total_scans,
        "phishing_detections": phishing,
        "malicious_urls": malicious_urls,
        "malware_detections": malware,
        "ai_image_analyses": ai_images,
        "ai_video_analyses": ai_videos,
        "category_counts": category_counts,
    }
