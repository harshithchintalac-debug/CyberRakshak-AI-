from datetime import datetime, timezone, timedelta
import logging

from fastapi import APIRouter, HTTPException, status
from bson import ObjectId

from app.models.user import (RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
                              ForgotPasswordRequest, ResetPasswordRequest)
from app.auth.security import (hash_password, verify_password, create_access_token,
                                create_refresh_token, decode_refresh_token, generate_reset_token)
from app.database import users_col, activity_col

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("cyberrakshak.auth")


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest):
    if not payload.accept_terms:
        raise HTTPException(400, "You must accept the Terms and Conditions")

    existing = await users_col().find_one({"$or": [{"email": payload.email}, {"username": payload.username}]})
    if existing:
        field = "email" if existing.get("email") == payload.email else "username"
        raise HTTPException(409, f"That {field} is already registered")

    now = datetime.now(timezone.utc)
    doc = {
        "full_name": payload.full_name,
        "username": payload.username,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "preferred_language": payload.preferred_language,
        "profile_picture": None,
        "role": "user",
        "account_status": "active",
        "email_verified": False,
        "created_at": now,
        "updated_at": now,
        "last_login": now,
    }
    result = await users_col().insert_one(doc)
    user_id = str(result.inserted_id)

    await activity_col().insert_one({"user_id": user_id, "action": "register", "timestamp": now})

    return TokenResponse(
        access_token=create_access_token(user_id, "user"),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = await users_col().find_one({"$or": [{"email": payload.identifier}, {"username": payload.identifier}]})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email/username or password")
    if user.get("account_status") == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    user_id = str(user["_id"])
    await users_col().update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.now(timezone.utc)}})
    await activity_col().insert_one({"user_id": user_id, "action": "login", "timestamp": datetime.now(timezone.utc)})

    return TokenResponse(
        access_token=create_access_token(user_id, user.get("role", "user")),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest):
    data = decode_refresh_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    user = await users_col().find_one({"_id": ObjectId(data["sub"])})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenResponse(
        access_token=create_access_token(str(user["_id"]), user.get("role", "user")),
        refresh_token=create_refresh_token(str(user["_id"])),
    )


@router.post("/logout")
async def logout():
    # Stateless JWTs: logout is handled client-side by discarding tokens.
    # For true server-side revocation, maintain a refresh-token denylist collection.
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    user = await users_col().find_one({"email": payload.email})
    # Always return a generic success message — never reveal whether an email is registered.
    if user:
        token = generate_reset_token()
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await users_col().update_one(
            {"_id": user["_id"]},
            {"$set": {"reset_token": token, "reset_token_expires": expires}},
        )
        # TODO: wire an email-sending service (e.g. SES/SendGrid) to actually deliver the link:
        # f"https://yourapp.com/reset-password?token={token}"
        logger.info("Password reset token generated for user %s (email delivery not wired in this demo)", user["_id"])
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    user = await users_col().find_one({"reset_token": payload.token})
    if not user or not user.get("reset_token_expires") or user["reset_token_expires"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Reset link is invalid or has expired")
    await users_col().update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)},
         "$unset": {"reset_token": "", "reset_token_expires": ""}},
    )
    return {"message": "Password updated. You can now log in with your new password."}
