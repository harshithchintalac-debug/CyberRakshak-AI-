from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    preferred_language: str = "en"
    accept_terms: bool

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Asha Rao",
                "username": "asha_rao",
                "email": "asha@example.com",
                "password": "StrongPass123!",
                "preferred_language": "en",
                "accept_terms": True,
            }
        }


class LoginRequest(BaseModel):
    identifier: str  # email or username
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: str
    full_name: str
    username: str
    email: EmailStr
    preferred_language: str
    profile_picture: Optional[str] = None
    role: str
    account_status: str
    email_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    preferred_language: Optional[str] = None
    profile_picture: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str
