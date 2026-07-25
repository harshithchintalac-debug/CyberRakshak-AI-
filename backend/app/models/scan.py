from pydantic import BaseModel, field_validator
from typing import Optional, List, Any

# Kept in sync with ollama_service.SUPPORTED_LANGUAGES and the frontend's
# language <select>. "auto" means "match the language the user typed in".
SUPPORTED_CHAT_LANGUAGES = {
    "auto", "en-US", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN",
}


class UnifiedScanRequest(BaseModel):
    text: str


class URLScanRequest(BaseModel):
    url: str


class EmailScanRequest(BaseModel):
    body: str
    sender: Optional[str] = ""
    subject: Optional[str] = ""


class MessageScanRequest(BaseModel):
    text: str


class PasswordCheckRequest(BaseModel):
    password: str


class BreachCheckRequest(BaseModel):
    email: str


class ScanResult(BaseModel):
    kind: str
    label: str
    target: str
    score: int
    risk: str
    confidence: int
    indicators: List[List[str]]
    explanation: str
    technical: str
    actions: List[str]
    demo: bool = False
    extra: Optional[dict] = None


class ChatMessageIn(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    language: str = "auto"

    @field_validator("language")
    @classmethod
    def _normalize_language(cls, v: str) -> str:
        if v not in SUPPORTED_CHAT_LANGUAGES:
            return "auto"
        return v


class ConversationRename(BaseModel):
    title: str


class SafetyQuizSubmit(BaseModel):
    answers: List[bool]  # True = "yes" for each of the 7 questions, in fixed order
