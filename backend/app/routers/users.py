from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.auth.security import verify_password, hash_password
from app.database import users_col, security_scans_col
from app.models.user import UserPublic, UpdateProfileRequest, ChangePasswordRequest, DeleteAccountRequest

router = APIRouter(prefix="/api/users", tags=["users"])


def _to_public(user: dict) -> UserPublic:
    created_at = user.get("created_at")
    if not created_at or not isinstance(created_at, datetime):
        created_at = datetime.now(timezone.utc)
    last_login = user.get("last_login")
    if last_login and not isinstance(last_login, datetime):
        last_login = None

    return UserPublic(
        id=str(user.get("_id", "")),
        full_name=user.get("full_name") or user.get("username") or "User",
        username=user.get("username") or "user",
        email=user.get("email") or "user@example.com",
        preferred_language=user.get("preferred_language", "en"),
        profile_picture=user.get("profile_picture"),
        role=user.get("role", "user"),
        account_status=user.get("account_status", "active"),
        email_verified=user.get("email_verified", False),
        created_at=created_at,
        last_login=last_login,
    )


@router.get("/me", response_model=UserPublic)
async def get_me(user: dict = Depends(get_current_user)):
    return _to_public(user)


@router.patch("/me", response_model=UserPublic)
async def update_me(payload: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "username" in updates:
        clash = await users_col().find_one({"username": updates["username"], "_id": {"$ne": user["_id"]}})
        if clash:
            raise HTTPException(409, "That username is already taken")
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await users_col().update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await users_col().find_one({"_id": user["_id"]})
    return _to_public(fresh or {**user, **updates})


@router.post("/me/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await users_col().update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Password changed successfully"}


@router.delete("/me")
async def delete_account(payload: DeleteAccountRequest, user: dict = Depends(get_current_user)):
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(400, "Password is incorrect")
    await users_col().delete_one({"_id": user["_id"]})
    return {"message": "Account deleted"}


@router.get("/me/stats")
async def my_stats(user: dict = Depends(get_current_user)):
    user_id = str(user["_id"])
    total_scans = await security_scans_col().count_documents({"user_id": user_id})
    threats = await security_scans_col().count_documents({"user_id": user_id, "risk": {"$in": ["high", "critical"]}})
    return {"total_scans": total_scans, "threats_detected": threats}
