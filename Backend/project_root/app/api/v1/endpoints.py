# API router aggregation
from fastapi import APIRouter
from app.api.v1.routes import chat
from app.api.v1.routes import rag
from app.api.v1.routes import code_notes
api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG"])
api_router.include_router(code_notes.router, prefix="/code_notes", tags=["Code Notes"])
