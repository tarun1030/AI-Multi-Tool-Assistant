from pydantic import BaseModel
from typing import List, Optional

# Pydantic models
class SessionCreate(BaseModel):
    name: str
    description: str

class SessionResponse(BaseModel):
    session_id: str
    name: str
    description: str
    updated_at: str

class HistoryResponse(BaseModel):
    history_id: str
    caption: str
    message_count: int
    updated_at: str

class ChatRequest(BaseModel):
    session_id: str
    history_id: Optional[str] = None
    caption: Optional[str] = None
    query: str

class ChatResponse(BaseModel):
    answer: str
    related_chunks: List[str]
    history_id: str
    caption: str

class DocumentResponse(BaseModel):
    document_id: str
    document_name: str
    document_size: int

class Message(BaseModel):
    role: str
    content: str
    timestamp: str
    related_chunks: Optional[List[str]] = None  # Added related_chunks to Message model