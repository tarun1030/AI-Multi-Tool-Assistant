from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from app.schemas.chat import QueryRequest, ChatSession, ChatMessage
from app.services.chat import (
    get_session_context, generate_caption, generate_fallback_caption,
    process_image, create_new_session, get_ollama_streaming_response,
    generate_welcome_message
)
from app.services.storage import get_session_lazy, save_individual_session
from app.core.config import settings
from typing import Optional
from datetime import datetime
import json
import asyncio

router = APIRouter()

@router.post("/chat")
async def chat_stream(
    query: str = Form(...),
    session_id: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    """Main chat endpoint with streaming response"""
    try:
        # Process image if provided
        image_base64 = None
        if image:
            if not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Uploaded file must be an image")
            image_base64 = process_image(image)
        
        # Create new session if not provided
        is_completely_new = False
        if not session_id:
            session_id, caption = create_new_session(query)
            is_completely_new = True
        
        # Check if session exists
        session_data = get_session_lazy(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Store user message immediately
        timestamp = datetime.now().isoformat()
        user_message = {
            "role": "user",
            "content": query,
            "timestamp": timestamp,
            "has_image": image is not None
        }
        session_data["messages"].append(user_message)
        session_data["_modified"] = True
        
        async def generate_response():
            full_response = ""
            bot_timestamp = datetime.now().isoformat()
            
            # Send initial metadata
            yield f"data: {json.dumps({'type': 'metadata', 'session_id': session_id, 'caption': session_data['caption'], 'timestamp': bot_timestamp, 'is_new_session': is_completely_new})}\n\n"
            
            # Get streaming response from Ollama
            async for chunk in get_ollama_streaming_response(query, session_id, image_base64):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'content', 'chunk': chunk})}\n\n"
                    await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
            
            # Store the complete bot response
            bot_message = {
                "role": "assistant", 
                "content": full_response,
                "timestamp": bot_timestamp
            }
            session_data["messages"].append(bot_message)
            
            # Mark session as no longer new
            if session_data.get("is_new"):
                session_data["is_new"] = False
            
            # Save session
            if is_completely_new or len(session_data["messages"]) % 10 == 0:
                save_individual_session(session_id, session_data)
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'done', 'full_response': full_response})}\n\n"
        
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Keep all other endpoints unchanged
@router.get("/history")
async def get_all_chat_history():
    """Get all chat sessions with their captions"""
    try:
        sessions_summary = []
        
        for session_id, index_data in settings.session_index.items():
            sessions_summary.append({
                "session_id": session_id,
                "caption": index_data["caption"],
                "created_at": index_data["created_at"],
                "last_accessed": index_data.get("last_accessed", index_data["created_at"]),
                "message_count": index_data.get("message_count", 0),
                "last_message_time": index_data.get("last_accessed", index_data["created_at"])
            })
        
        sessions_summary.sort(key=lambda x: x.get("last_accessed", x["created_at"]), reverse=True)
        
        return {
            "total_sessions": len(sessions_summary),
            "sessions": sessions_summary
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving chat history: {str(e)}")

@router.get("/history/{session_identifier}")
async def get_individual_chat_history(session_identifier: str):
    """Get individual chat session history by session_id or caption"""
    try:
        session_data = get_session_lazy(session_identifier)
        if session_data:
            session_data["last_accessed"] = datetime.now().isoformat()
            session_data["_modified"] = True
            return {
                "session_id": session_identifier,
                "caption": session_data["caption"],
                "created_at": session_data["created_at"],
                "last_accessed": session_data.get("last_accessed"),
                "messages": session_data["messages"]
            }
        
        for session_id, index_data in settings.session_index.items():
            if index_data["caption"].lower() == session_identifier.lower():
                session_data = get_session_lazy(session_id)
                if session_data:
                    session_data["last_accessed"] = datetime.now().isoformat()
                    session_data["_modified"] = True
                    return {
                        "session_id": session_id,
                        "caption": session_data["caption"],
                        "created_at": session_data["created_at"],
                        "last_accessed": session_data.get("last_accessed"),
                        "messages": session_data["messages"]
                    }
        
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving chat session: {str(e)}")

@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    try:
        if session_id in settings.chat_sessions:
            del settings.chat_sessions[session_id]
        
        if session_id in settings.session_index:
            del settings.session_index[session_id]
        
        session_file = settings.SESSIONS_DIR / f"session_{session_id}.json"
        if session_file.exists():
            session_file.unlink()
        
        from app.services.storage import save_session_index
        save_session_index()
        
        return {"message": f"Session {session_id} deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")

@router.get("/session/{session_id}/status")
async def get_session_status(session_id: str):
    """Get the status of a specific session including question count"""
    try:
        session_data = get_session_lazy(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        current_questions = sum(1 for msg in session_data["messages"] if msg["role"] == "user")
        
        return {
            "session_id": session_id,
            "caption": session_data["caption"],
            "created_at": session_data["created_at"],
            "last_accessed": session_data.get("last_accessed"),
            "current_questions": current_questions,
            "max_questions": 20,
            "questions_remaining": 20 - current_questions,
            "is_full": current_questions >= 20,
            "parent_session_id": session_data.get("parent_session_id"),
            "is_continuation": "parent_session_id" in session_data,
            "total_messages": len(session_data["messages"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting session status: {str(e)}")

@router.get("/sessions/by-topic/{topic}")
async def get_sessions_by_topic(topic: str):
    """Get all sessions related to a specific topic (including continuations)"""
    try:
        related_sessions = []
        
        for session_id, index_data in settings.session_index.items():
            caption = index_data["caption"].lower()
            if topic.lower() in caption or caption.startswith(topic.lower()):
                session_data = get_session_lazy(session_id)
                current_questions = sum(1 for msg in session_data["messages"] if msg["role"] == "user") if session_data else 0
                
                related_sessions.append({
                    "session_id": session_id,
                    "caption": index_data["caption"],
                    "created_at": index_data["created_at"],
                    "last_accessed": index_data.get("last_accessed", index_data["created_at"]),
                    "current_questions": current_questions,
                    "is_full": current_questions >= 20,
                    "parent_session_id": session_data.get("parent_session_id") if session_data else None,
                    "is_continuation": session_data and "parent_session_id" in session_data
                })
        
        related_sessions.sort(key=lambda x: x["created_at"])
        
        return {
            "topic": topic,
            "total_sessions": len(related_sessions),
            "sessions": related_sessions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving sessions by topic: {str(e)}")

@router.post("/save")
async def manual_save():
    """Manually trigger a save operation"""
    try:
        from app.services.storage import save_sessions
        save_sessions()
        return {
            "message": "Sessions saved successfully",
            "total_sessions": len(settings.session_index),
            "active_sessions": len(settings.chat_sessions),
            "saved_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving sessions: {str(e)}")

@router.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Ollama Gemma3 Chatbot API",
        "model": "gemma3:4b",
        "status": "running",
        "total_sessions": len(settings.session_index),
        "active_sessions": len(settings.chat_sessions),
        "storage_location": str(settings.SESSIONS_DIR.absolute()),
        "index_location": str(settings.SESSION_INDEX_FILE.absolute())
    }