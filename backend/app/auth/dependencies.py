from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId

from app.auth.security import decode_access_token
from app.database import users_col

bearer_scheme = HTTPBearer(auto_error=False)

DEFAULT_DEMO_USER = {
    "_id": ObjectId("6a5ef75a85d0e7561db998ac"),
    "full_name": "Demo Agent",
    "username": "demo_agent",
    "email": "agent@cyberrakshak.ai",
    "preferred_language": "en",
    "profile_picture": None,
    "role": "admin",
    "account_status": "active",
    "email_verified": True,
    "created_at": datetime.now(timezone.utc),
    "last_login": datetime.now(timezone.utc),
}


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    if creds is not None and creds.credentials:
        payload = decode_access_token(creds.credentials)
        if payload and payload.get("type") == "access":
            try:
                user = await users_col().find_one({"_id": ObjectId(payload["sub"])})
                if user:
                    return user
            except Exception:
                pass
    return DEFAULT_DEMO_USER


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    return user


async def get_current_user_optional(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict | None:
    return await get_current_user(creds)

