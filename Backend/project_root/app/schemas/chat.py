# Pydantic schemas
from pydantic import BaseModel
from typing import Optional, List

class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str

class ChatSession(BaseModel):
    session_id: str
    caption: str
    messages: List[ChatMessage]
    created_at: str