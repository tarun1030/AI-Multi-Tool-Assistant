from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from app.schemas.rag import (
    SessionCreate, SessionResponse, HistoryResponse, ChatRequest, 
    ChatResponse, DocumentResponse, Message
)
from app.services.rag import (
    create_session_service, get_all_sessions_service, get_session_histories_service,
    get_history_messages_service, upload_documents_service, get_session_documents_service,
    chat_service, load_session_data,delete_document_service, delete_history_service, delete_session_service
)
from app.core.rag_config import PDF_SUPPORT, DOCX_SUPPORT, OLLAMA_MODEL

router = APIRouter()

@router.post("/sessions", response_model=SessionResponse)
async def create_session(session: SessionCreate):
    """Create a new session"""
    result = create_session_service(session.name, session.description)
    return SessionResponse(**result)

@router.get("/sessions", response_model=List[SessionResponse])
async def get_all_sessions():
    """Get all sessions"""
    sessions_data = get_all_sessions_service()
    return [SessionResponse(**session) for session in sessions_data]

@router.get("/sessions/{session_id}/histories", response_model=List[HistoryResponse])
async def get_session_histories(session_id: str):
    """Get all histories for a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    histories_data = get_session_histories_service(session_id)
    return [HistoryResponse(**history) for history in histories_data]

@router.get("/sessions/{session_id}/histories/{history_id}/messages", response_model=List[Message])
async def get_history_messages(session_id: str, history_id: str):
    """Get all messages for a specific history"""
    session_data = load_session_data(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages_data = get_history_messages_service(session_id, history_id)
    if not messages_data:
        raise HTTPException(status_code=404, detail="History not found")
    
    return [Message(**message) for message in messages_data]

@router.post("/sessions/{session_id}/documents")
async def upload_documents(session_id: str, files: List[UploadFile] = File(...)):
    """Upload documents to a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Read file contents for processing
    files_with_content = []
    for file in files:
        content = await file.read()
        # Reset file position for service processing
        file.file.seek(0)
        files_with_content.append(file)
    
    result = upload_documents_service(session_id, files_with_content)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

@router.get("/sessions/{session_id}/documents", response_model=List[DocumentResponse])
async def get_session_documents(session_id: str):
    """Get all documents for a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    documents_data = get_session_documents_service(session_id)
    return [DocumentResponse(**document) for document in documents_data]

@router.post("/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    """Chat with RAG system"""
    session_data = load_session_data(chat_request.session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = chat_service({
        "session_id": chat_request.session_id,
        "history_id": chat_request.history_id,
        "caption": chat_request.caption,
        "query": chat_request.query
    })
    
    if "error" in result:
        if result["error"] == "Session not found":
            raise HTTPException(status_code=404, detail="Session not found")
        elif result["error"] == "No documents found for this session":
            raise HTTPException(status_code=404, detail="No documents found for this session")
        elif result["error"] == "History not found":
            raise HTTPException(status_code=404, detail="History not found")
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    
    return ChatResponse(**result)

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all associated data"""
    result = delete_session_service(session_id)
    
    if "error" in result:
        if result["error"] == "Session not found":
            raise HTTPException(status_code=404, detail="Session not found")
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    
    return {"message": result["message"]}

@router.delete("/sessions/{session_id}/histories/{history_id}")
async def delete_history(session_id: str, history_id: str):
    """Delete a specific chat history from a session"""
    result = delete_history_service(session_id, history_id)
    
    if "error" in result:
        if result["error"] == "Session not found":
            raise HTTPException(status_code=404, detail="Session not found")
        elif result["error"] == "History not found":
            raise HTTPException(status_code=404, detail="History not found")
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    
    return {"message": result["message"]}

@router.delete("/sessions/{session_id}/documents/{document_id}")
async def delete_document(session_id: str, document_id: str):
    """Delete a document from a session"""
    result = delete_document_service(session_id, document_id)
    
    if "error" in result:
        if result["error"] == "Session not found":
            raise HTTPException(status_code=404, detail="Session not found")
        elif result["error"] == "Document not found":
            raise HTTPException(status_code=404, detail="Document not found")
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    
    return {"message": result["message"]}

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "model": OLLAMA_MODEL, 
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "pdf_support": PDF_SUPPORT,
        "docx_support": DOCX_SUPPORT
    }