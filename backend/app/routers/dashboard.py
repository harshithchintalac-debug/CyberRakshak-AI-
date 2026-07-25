from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.database import security_scans_col, safety_assessments_col, conversations_col
from app.models.scan import SafetyQuizSubmit

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

QUIZ_QUESTIONS = [
    ("Do you use different passwords for different accounts?", True),
    ("Is multi-factor authentication (MFA) enabled on your important accounts?", True),
    ("Do you regularly update your phone and apps?", True),
    ("Do you click links from unknown senders?", False),
    ("Do you download APK files from unknown websites?", False),
    ("Do you use public Wi-Fi for banking or sensitive transactions?", False),
    ("Do you back up your important files regularly?", True),
]


@router.get("/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    user_id = str(user.get("_id", ""))
    total_scans = 0
    threats = 0
    total_conversations = 0
    latest_assessment = None
    category_counts = {}

    try:
        total_scans = await security_scans_col().count_documents({"user_id": user_id})
        threats = await security_scans_col().count_documents({"user_id": user_id, "risk": {"$in": ["high", "critical"]}})
        total_conversations = await conversations_col().count_documents({"user_id": user_id})
        latest_assessment = await safety_assessments_col().find_one({"user_id": user_id}, sort=[("created_at", -1)])

        async for doc in security_scans_col().find({"user_id": user_id}):
            k = doc.get("kind", "other")
            category_counts[k] = category_counts.get(k, 0) + 1
    except Exception as e:
        import logging
        logging.getLogger("cyberrakshak").warning("Dashboard DB query fallback: %s", e)

    return {
        "welcome_name": user.get("full_name") or user.get("username") or "Agent",
        "total_scans": total_scans,
        "threats_detected": threats,
        "total_conversations": total_conversations,
        "safety_score": latest_assessment.get("score") if (latest_assessment and isinstance(latest_assessment, dict)) else None,
        "category_counts": category_counts,
    }


@router.post("/safety-score")
async def submit_safety_score(payload: SafetyQuizSubmit, user: dict = Depends(get_current_user)):
    if len(payload.answers) != len(QUIZ_QUESTIONS):
        from fastapi import HTTPException
        raise HTTPException(400, f"Expected {len(QUIZ_QUESTIONS)} answers")

    strong, weak = [], []
    points = 0
    for (question, positive_is_good), answer in zip(QUIZ_QUESTIONS, payload.answers):
        good = answer if positive_is_good else not answer
        if good:
            points += 1
            strong.append(question)
        else:
            weak.append(question)

    score = round(points / len(QUIZ_QUESTIONS) * 100)
    level = "At Risk" if score < 40 else "Needs Improvement" if score < 65 else "Good" if score < 85 else "Excellent"

    doc = {
        "user_id": str(user["_id"]), "score": score, "level": level,
        "strong_areas": strong, "weak_areas": weak, "created_at": datetime.now(timezone.utc),
    }
    await safety_assessments_col().insert_one(doc)
    return {"score": score, "level": level, "strong_areas": strong, "weak_areas": weak}
