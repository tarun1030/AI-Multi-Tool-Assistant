from pydantic import BaseModel
from typing import Dict, List, Optional, Any

class NewCodeRequest(BaseModel):
    code_name: str
    language: str

class ChatRequest(BaseModel):
    session_id: str
    history_id: Optional[str] = None
    query: str

class SessionResponse(BaseModel):
    session_id: str
    name: str
    language: str
    v1_preview: str
    updated_at: str
    chat_count: int

class HistoryResponse(BaseModel):
    history_id: str
    caption: str
    updated_at: str
    version_count: int

class ChatMessage(BaseModel):
    query: str
    response: str
    code_changed: bool
    version: str
    timestamp: str

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]
    current_code: str

class CodeResponse(BaseModel):
    version: str
    language: str
    algorithm_name: str
    code: str
    created_at: str
    changes_summary: str
    diff_from_previous: Optional[str]

class ChatResponse(BaseModel):
    response: str
    code_updated: bool
    new_version: Optional[str]
    code_preview: Optional[str]
    history_id: str
    caption: str