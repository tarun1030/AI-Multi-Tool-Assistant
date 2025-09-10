from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas.code_notes import (
    NewCodeRequest, ChatRequest, SessionResponse, HistoryResponse,
    ChatMessage, ChatHistoryResponse, CodeResponse, ChatResponse
)
from app.services.code_notes import (
    create_new_code_service, get_all_codes_service, get_session_history_service,
    get_chat_history_service, chat_interaction_service, get_code_details_service,
    delete_session_service, delete_history_service
)

router = APIRouter()

@router.post("/new_code")
async def create_new_code(request: NewCodeRequest):
    """Initialize new coding session"""
    try:
        result = create_new_code_service(request.code_name, request.language)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating new code session: {str(e)}")

@router.get("/codes", response_model=List[SessionResponse])
async def get_all_codes():
    """Dashboard - show all coding sessions"""
    try:
        result = get_all_codes_service()
        return [SessionResponse(**item) for item in result]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching codes: {str(e)}")

@router.get("/history/{session_id}", response_model=List[HistoryResponse])
async def get_session_history(session_id: str):
    """Show all chat conversations within a session"""
    try:
        result = get_session_history_service(session_id)
        return [HistoryResponse(**item) for item in result]
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching session history: {str(e)}")

@router.get("/history/{session_id}/{history_id}", response_model=ChatHistoryResponse)
async def get_chat_history(session_id: str, history_id: str):
    """View complete chat conversation with evolution"""
    try:
        result = get_chat_history_service(session_id, history_id)
        
        # Convert messages to proper format
        messages = [ChatMessage(**msg) for msg in result['messages']]
        
        return ChatHistoryResponse(
            messages=messages,
            current_code=result['current_code']
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat history: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat_interaction(request: ChatRequest):
    """Interactive chat to modify/discuss code"""
    try:
        result = chat_interaction_service(request.session_id, request.history_id, request.query)
        return ChatResponse(**result)
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in chat interaction: {str(e)}")

@router.get("/code/{session_id}/{history_id}/{version}", response_model=CodeResponse)
async def get_code_details(session_id: str, history_id: str, version: str):
    """Code viewer - get full code details"""
    try:
        result = get_code_details_service(session_id, history_id, version)
        return CodeResponse(**result)
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching code details: {str(e)}")

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its data"""
    try:
        result = delete_session_service(session_id)
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")

@router.delete("/sessions/{session_id}/history/{history_id}")
async def delete_history(session_id: str, history_id: str):
    """Delete a specific history within a session"""
    try:
        result = delete_history_service(session_id, history_id)
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting history: {str(e)}")