# Chat business logic with streaming support
import ollama
import base64
import io
from PIL import Image
import re
from datetime import datetime
import uuid
from typing import Optional, List, Dict, AsyncGenerator
from fastapi import HTTPException, UploadFile
from app.core.config import settings

def get_session_context(session_id: str, max_messages: int = 10) -> List[Dict[str, str]]:
    """Get recent conversation context from current session (Claude-like behavior)"""
    from app.services.storage import get_session_lazy
    session_data = get_session_lazy(session_id)
    if not session_data:
        return []
    
    messages = session_data["messages"]
    recent_messages = messages[-max_messages:] if len(messages) > max_messages else messages
    
    context_messages = []
    for msg in recent_messages:
        context_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    
    return context_messages


def generate_caption(query: str) -> str:
    """Generate a unique, summarized caption from the first query using Gemma3"""
    try:
        caption_prompt = f"""Create a short, unique title (3-6 words) that summarizes this question or topic. 
        Be specific and descriptive. Avoid generic words like "chat", "question", "discussion".
        
        Question: {query}
        
        Title:"""
        
        response = ollama.chat(
            model='gemma3:4b',
            messages=[{
                "role": "user", 
                "content": caption_prompt
            }],
            stream=False
        )
        
        caption = response['message']['content'].strip()
        caption = caption.strip('"').strip("'")

        # Remove markdown, punctuation symbols like **, :, etc.
        caption = re.sub(r"[*_:#\-]+", "", caption).strip()

        # Stop at first block/separator (prioritize \n\n first)
        for sep in ["\n\n", "\n", "."]:
            if sep in caption:
                caption = caption.split(sep, 1)[0].strip()
                break

        # Truncate if too long
        if len(caption) > 50:
            caption = caption[:47].rstrip() + "..."
        
        return caption.title() if caption else generate_fallback_caption(query)
    
    except Exception as e:
        print(f"Error generating AI caption: {e}")
        return generate_fallback_caption(query)

def generate_fallback_caption(query: str) -> str:
    """Generate a fallback caption if AI generation fails"""
    clean_query = re.sub(r'[^\w\s]', '', query.lower())
    words = clean_query.split()
    
    stop_words = {'what', 'is', 'how', 'can', 'do', 'does', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'help', 'me', 'please', 'tell', 'explain'}
    filtered_words = [word for word in words if word not in stop_words and len(word) > 2]
    
    key_words = filtered_words[:4] if filtered_words else words[:3]
    caption = ' '.join(key_words).title()
    
    if not caption or len(caption) < 6:
        return f"Chat {datetime.now().strftime('%m-%d %H:%M')}"
    
    return caption

def process_image(image_file: UploadFile) -> str:
    """Process uploaded image and convert to base64"""
    try:
        image_data = image_file.file.read()
        image = Image.open(io.BytesIO(image_data))
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        max_size = 1024
        if max(image.size) > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return image_base64
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

def create_new_session(query: str) -> tuple[str, str]:
    """Create a new chat session with Claude-like initialization"""
    session_id = str(uuid.uuid4())
    caption = generate_caption(query)
    
    session_data = {
        "caption": caption,
        "messages": [],
        "created_at": datetime.now().isoformat(),
        "is_new": True,
        "last_accessed": datetime.now().isoformat(),
        "_modified": True
    }
    
    settings.chat_sessions[session_id] = session_data
    
    return session_id, caption

async def get_ollama_streaming_response(query: str, session_id: str, image_base64: Optional[str] = None) -> AsyncGenerator[str, None]:
    """Get streaming response from Ollama Gemma3 model with Claude-like context handling"""
    try:
        from app.services.storage import get_session_lazy
        session_data = get_session_lazy(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        is_new_session = session_data.get("is_new", False)
        
        session_data["last_accessed"] = datetime.now().isoformat()
        session_data["_modified"] = True
        
        conversation_context = get_session_context(session_id)
        
        messages = []
        
        if is_new_session:
            messages.append({
                "role": "system",
                "content": settings.SYSTEM_PROMPT
            })
        
        for msg in conversation_context:
            messages.append(msg)
        
        current_message = {
            "role": "user",
            "content": query
        }
        
        if image_base64:
            current_message["images"] = [image_base64]
        
        messages.append(current_message)
        
        # Add welcome message for new sessions
        if is_new_session:
            welcome = generate_welcome_message(session_data["caption"])
            yield f"{welcome}\n\n"
        
        # Stream the response from Ollama
        stream = ollama.chat(
            model='gemma3:4b',
            messages=messages,
            stream=True
        )
        
        for chunk in stream:
            if 'message' in chunk and 'content' in chunk['message']:
                content = chunk['message']['content']
                if content:  # Only yield non-empty content
                    yield content
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting streaming response from Ollama: {str(e)}")

def get_ollama_response(query: str, session_id: str, image_base64: Optional[str] = None) -> tuple[str, bool]:
    """Get response from Ollama Gemma3 model with Claude-like context handling (non-streaming fallback)"""
    try:
        from app.services.storage import get_session_lazy
        session_data = get_session_lazy(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        is_new_session = session_data.get("is_new", False)
        
        session_data["last_accessed"] = datetime.now().isoformat()
        session_data["_modified"] = True
        
        conversation_context = get_session_context(session_id)
        
        messages = []
        
        if is_new_session:
            messages.append({
                "role": "system",
                "content": settings.SYSTEM_PROMPT
            })
        
        for msg in conversation_context:
            messages.append(msg)
        
        current_message = {
            "role": "user",
            "content": query
        }
        
        if image_base64:
            current_message["images"] = [image_base64]
        
        messages.append(current_message)
        
        response = ollama.chat(
            model='gemma3:4b',
            messages=messages,
            stream=False
        )
        
        return response['message']['content'], is_new_session
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting response from Ollama: {str(e)}")

def generate_welcome_message(caption: str) -> str:
    """Generate a welcome message for new sessions"""
    return f"Hello! I'm ready to help you with your questions. I see we're starting a new conversation about '{caption}'. What would you like to know?"