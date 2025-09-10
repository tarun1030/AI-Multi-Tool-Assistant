# Storage operations
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict
import threading
import time
from app.core.config import settings

def get_session_file_path(session_id: str) -> Path:
    """Get the file path for a specific session"""
    return settings.SESSIONS_DIR / f"session_{session_id}.json"

def load_session_index():
    """Load the session index from persistent storage"""
    try:
        if settings.SESSION_INDEX_FILE.exists():
            with open(settings.SESSION_INDEX_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                settings.session_index = data.get('sessions', {})
                print(f"Loaded session index with {len(settings.session_index)} sessions")
        else:
            settings.session_index = {}
            print("No existing session index found, starting fresh")
    except Exception as e:
        print(f"Error loading session index: {e}")
        settings.session_index = {}

def save_session_index():
    """Save the session index to persistent storage"""
    try:
        with settings._save_lock:
            data = {
                'sessions': settings.session_index,
                'last_saved': datetime.now().isoformat(),
                'total_sessions': len(settings.session_index)
            }
            
            temp_file = settings.SESSION_INDEX_FILE.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            temp_file.replace(settings.SESSION_INDEX_FILE)
            print(f"Saved session index with {len(settings.session_index)} sessions")
            
    except Exception as e:
        print(f"Error saving session index: {e}")

def load_individual_session(session_id: str) -> Optional[Dict]:
    """Load an individual session from its file"""
    try:
        session_file = get_session_file_path(session_id)
        if session_file.exists():
            with open(session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
                return session_data
        return None
    except Exception as e:
        print(f"Error loading session {session_id}: {e}")
        return None

def save_individual_session(session_id: str, session_data: Dict):
    """Save an individual session to its file"""
    try:
        session_file = get_session_file_path(session_id)
        
        temp_file = session_file.with_suffix('.tmp')
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, indent=2, ensure_ascii=False)
        
        temp_file.replace(session_file)
        
        settings.session_index[session_id] = {
            'caption': session_data['caption'],
            'created_at': session_data['created_at'],
            'last_accessed': session_data.get('last_accessed', session_data['created_at']),
            'message_count': len(session_data['messages']),
            'last_saved': datetime.now().isoformat()
        }
        
        print(f"Saved session {session_id}: {session_data['caption']}")
        
    except Exception as e:
        print(f"Error saving session {session_id}: {e}")

def load_all_sessions():
    """Load all sessions on startup"""
    load_session_index()
    
    settings.chat_sessions = {}
    loaded_count = 0
    
    for session_id in settings.session_index:
        session_data = load_individual_session(session_id)
        if session_data:
            settings.chat_sessions[session_id] = session_data
            loaded_count += 1
    
    print(f"Loaded {loaded_count} sessions into memory")

def get_session_lazy(session_id: str) -> Optional[Dict]:
    """Get session data, loading from file if not in memory"""
    if session_id in settings.chat_sessions:
        return settings.chat_sessions[session_id]
    
    if session_id in settings.session_index:
        session_data = load_individual_session(session_id)
        if session_data:
            settings.chat_sessions[session_id] = session_data
            return session_data
    
    return None

def save_sessions():
    """Save all modified sessions and the index"""
    try:
        for session_id, session_data in settings.chat_sessions.items():
            if session_data.get('_modified', True):
                save_individual_session(session_id, session_data)
                session_data['_modified'] = False
        
        save_session_index()
        
    except Exception as e:
        print(f"Error in save_sessions: {e}")

def auto_save_worker():
    """Background worker to auto-save sessions periodically"""
    while not settings._shutdown:
        time.sleep(30)
        if not settings._shutdown and (settings.chat_sessions or settings.session_index):
            save_sessions()

def start_auto_save():
    """Start the auto-save background thread"""
    if settings._auto_save_thread is None or not settings._auto_save_thread.is_alive():
        settings._auto_save_thread = threading.Thread(target=auto_save_worker, daemon=True)
        settings._auto_save_thread.start()
        print("Auto-save thread started")

def cleanup_on_exit():
    """Cleanup function called on server shutdown"""
    settings._shutdown = True
    if settings._auto_save_thread and settings._auto_save_thread.is_alive():
        settings._auto_save_thread.join(timeout=5)
    
    if settings.chat_sessions or settings.session_index:
        save_sessions()
        print("Final session save completed")