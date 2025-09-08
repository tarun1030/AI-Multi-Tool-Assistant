import json
import re
import ollama
import faiss
import numpy as np
import pickle
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import shutil

from app.core.code_notes import (
    sessions_data, faiss_index, session_ids_map, embedding_model,
    DATA_FOLDER, SESSIONS_FOLDER, get_session_folder, 
    get_code_embedding, add_to_faiss_index,search_similar_code
)

def save_session_data():
    """Save sessions data to session-specific folders"""
    try:
        for session_id, session_data in sessions_data.items():
            session_folder = get_session_folder(session_id)
            
            # Save session metadata
            with open(session_folder / "metadata.json", "w") as f:
                json.dump({
                    'session_id': session_id,
                    'metadata': session_data['metadata'],
                    'created_at': session_data['metadata']['created_at']
                }, f, indent=2)
            
            # Save V1 code
            with open(session_folder / "v1_code.txt", "w") as f:
                f.write(session_data['v1_code'])
            
            # Save base embedding
            with open(session_folder / "base_embedding.pkl", "wb") as f:
                pickle.dump(session_data['base_embedding'], f)
            
            # Save histories
            histories_folder = session_folder / "histories"
            histories_folder.mkdir(exist_ok=True)
            
            for history_id, history_data in session_data.get('histories', {}).items():
                history_folder = histories_folder / history_id
                history_folder.mkdir(exist_ok=True)
                
                # Save history metadata
                with open(history_folder / "history_metadata.json", "w") as f:
                    json.dump({
                        'history_id': history_id,
                        'caption': history_data.get('caption', ''),
                        'current_version': history_data.get('current_version', 'v1')
                    }, f, indent=2)
                
                # Save chat memory
                with open(history_folder / "chat_memory.json", "w") as f:
                    json.dump(history_data.get('chat_memory', []), f, indent=2)
                
                # Save versions (code files only)
                versions_folder = history_folder / "versions"
                versions_folder.mkdir(exist_ok=True)
                
                for version, version_data in history_data.get('versions', {}).items():
                    # Save code file
                    with open(versions_folder / f"{version}_code.txt", "w") as f:
                        f.write(version_data['code'])
                    
                    # Save version metadata (without code)
                    version_meta = {
                        'version': version,
                        'timestamp': version_data['timestamp'],
                        'changes': version_data.get('changes', ''),
                        'embedding': version_data.get('embedding', [])
                    }
                    with open(versions_folder / f"{version}_metadata.json", "w") as f:
                        json.dump(version_meta, f, indent=2)
        
        # Save global mapping
        with open(DATA_FOLDER / "global_mapping.pkl", "wb") as f:
            pickle.dump({'session_ids_map': session_ids_map}, f)
            
    except Exception as e:
        print(f"Error saving session data: {e}")

def load_session_data():
    """Load sessions data from session-specific folders"""
    global sessions_data, session_ids_map
    try:
        sessions_data = {}
        
        # Load global mapping
        global_mapping_file = DATA_FOLDER / "global_mapping.pkl"
        if global_mapping_file.exists():
            with open(global_mapping_file, "rb") as f:
                data = pickle.load(f)
                session_ids_map = data.get('session_ids_map', {})
        
        # Load all sessions
        if SESSIONS_FOLDER.exists():
            for session_folder in SESSIONS_FOLDER.iterdir():
                if session_folder.is_dir():
                    session_id = session_folder.name
                    
                    try:
                        # Load metadata
                        with open(session_folder / "metadata.json", "r") as f:
                            metadata_data = json.load(f)
                        
                        # Load V1 code
                        v1_code = ""
                        if (session_folder / "v1_code.txt").exists():
                            with open(session_folder / "v1_code.txt", "r") as f:
                                v1_code = f.read()
                        
                        # Load base embedding
                        base_embedding = []
                        if (session_folder / "base_embedding.pkl").exists():
                            with open(session_folder / "base_embedding.pkl", "rb") as f:
                                base_embedding = pickle.load(f)
                        
                        # Initialize session data
                        sessions_data[session_id] = {
                            'v1_code': v1_code,
                            'base_embedding': base_embedding,
                            'metadata': metadata_data['metadata'],
                            'histories': {}
                        }
                        
                        # Load histories
                        histories_folder = session_folder / "histories"
                        if histories_folder.exists():
                            for history_folder in histories_folder.iterdir():
                                if history_folder.is_dir():
                                    history_id = history_folder.name
                                    
                                    # Load history metadata
                                    history_meta = {}
                                    if (history_folder / "history_metadata.json").exists():
                                        with open(history_folder / "history_metadata.json", "r") as f:
                                            history_meta = json.load(f)
                                    
                                    # Load chat memory
                                    chat_memory = []
                                    if (history_folder / "chat_memory.json").exists():
                                        with open(history_folder / "chat_memory.json", "r") as f:
                                            chat_memory = json.load(f)
                                    
                                    # Load versions
                                    versions = {}
                                    versions_folder = history_folder / "versions"
                                    if versions_folder.exists():
                                        # Group files by version
                                        version_files = {}
                                        for file in versions_folder.iterdir():
                                            if file.is_file():
                                                if file.name.endswith("_code.txt"):
                                                    version = file.name.replace("_code.txt", "")
                                                    if version not in version_files:
                                                        version_files[version] = {}
                                                    with open(file, "r") as f:
                                                        version_files[version]['code'] = f.read()
                                                elif file.name.endswith("_metadata.json"):
                                                    version = file.name.replace("_metadata.json", "")
                                                    if version not in version_files:
                                                        version_files[version] = {}
                                                    with open(file, "r") as f:
                                                        meta = json.load(f)
                                                        version_files[version].update(meta)
                                        
                                        versions = version_files
                                    
                                    sessions_data[session_id]['histories'][history_id] = {
                                        'caption': history_meta.get('caption', ''),
                                        'current_version': history_meta.get('current_version', 'v1'),
                                        'chat_memory': chat_memory,
                                        'versions': versions
                                    }
                        
                    except Exception as e:
                        print(f"Error loading session {session_id}: {e}")
                        continue
                        
    except Exception as e:
        print(f"Error loading session data: {e}")

def get_relative_time(timestamp: datetime) -> str:
    """Convert timestamp to relative time string"""
    now = datetime.now()
    diff = now - timestamp
    
    if diff.seconds < 60:
        return f"{diff.seconds} sec ago"
    elif diff.seconds < 3600:
        return f"{diff.seconds // 60} min ago"
    elif diff.seconds < 86400:
        return f"{diff.seconds // 3600}hr ago"
    else:
        return f"{diff.days} days ago"

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


def extract_code_from_response(response_content: str) -> str:
    """Extract only code from Ollama response, removing explanatory text"""
    # Look for code blocks first
    code_block_pattern = r'```(?:\w+)?\s*\n(.*?)\n```'
    code_blocks = re.findall(code_block_pattern, response_content, re.DOTALL)
    
    if code_blocks:
        # Join all code blocks
        return '\n\n'.join(code_blocks).strip()
    
    # If no code blocks, try to extract code by looking for common programming patterns
    lines = response_content.split('\n')
    code_lines = []
    in_code_section = False
    
    for line in lines:
        stripped = line.strip()
        
        # Skip empty lines and pure text explanations
        if not stripped:
            if in_code_section:
                code_lines.append(line)
            continue
            
        # Check if line looks like code
        is_code_line = (
            stripped.startswith(('def ', 'class ', 'import ', 'from ', 'if ', 'for ', 'while ', 'try:', 'except', 'return ', 'print(')) or
            re.search(r'^[a-zA-Z_][a-zA-Z0-9_]*\s*[=\(]', stripped) or  # variable assignment or function call
            stripped.startswith(('#', '//', '/*', '--', '<!--')) or  # comments
            re.search(r'[{}();,:]$', stripped) or  # ends with code punctuation
            stripped.startswith((' ', '\t'))  # indented (likely code)
        )
        
        # Skip explanatory text lines
        is_text_line = (
            stripped.lower().startswith(('this ', 'here ', 'the above', 'this code', 'explanation:', 'note:', 'output:')) or
            stripped.endswith(('.', '!', '?')) and not stripped.endswith(('.py', '.js', '.java', '.cpp')) or
            len(stripped.split()) > 10 and not any(char in stripped for char in '(){}[];=')
        )
        
        if is_code_line and not is_text_line:
            in_code_section = True
            code_lines.append(line)
        elif in_code_section and (stripped.startswith((' ', '\t')) or not stripped):
            code_lines.append(line)
        elif not is_text_line and ('{' in stripped or '}' in stripped or ';' in stripped):
            code_lines.append(line)
        else:
            in_code_section = False
    
    extracted_code = '\n'.join(code_lines).strip()
    return extracted_code if extracted_code else response_content.strip()

def generate_code_with_ollama(algorithm_name: str, language: str) -> str:
    """Generate code using Ollama Gemma 3:4b"""
    try:
        prompt = f"""Generate ONLY the code implementation of {algorithm_name} in {language}. 
        Do not include any explanations, descriptions, or text outside the code.
        Only provide clean, working code with minimal comments.
        
        Algorithm: {algorithm_name}
        Language: {language}"""
        
        response = ollama.chat(
            model='gemma3:4b',
            messages=[{"role": "user", "content": prompt}],
            stream=False
        )
        
        raw_response = response['message']['content'].strip()
        return extract_code_from_response(raw_response)
    
    except Exception as e:
        print(f"Error generating code with Ollama: {e}")
        return f"# Error generating {algorithm_name} in {language}\n# Please try again"

def modify_code_with_chat(current_code: str, query: str, language: str, chat_context: List = None) -> tuple:
    """Modify code based on chat query using Ollama"""
    try:
        context = ""
        if chat_context:
            context = "\n".join([f"Q: {msg['query']}\nA: {msg['response']}" for msg in chat_context[-3:]])
        
        prompt = f"""You are helping with code modification. 
        
        Current code:
        {current_code}
        
        Previous conversation:
        {context}
        
        User request: {query}
        Language: {language}
        
        Respond with:
        1. A helpful response to the user (conversational text)
        2. Whether code needs modification (true/false)
        3. If modification needed, provide ONLY the complete modified code (no explanations in code section)
        
        Format:
        RESPONSE: [your conversational response]
        CODE_CHANGED: [true/false]
        NEW_CODE: [only pure code if changed, otherwise empty]
        """
        
        response = ollama.chat(
            model='gemma3:4b',
            messages=[{"role": "user", "content": prompt}],
            stream=False
        )
        
        content = response['message']['content'].strip()
        
        # Parse the response
        response_text = ""
        code_changed = False
        new_code = current_code
        
        # Split by sections
        if 'RESPONSE:' in content:
            parts = content.split('RESPONSE:', 1)[1]
            if 'CODE_CHANGED:' in parts:
                response_part, rest = parts.split('CODE_CHANGED:', 1)
                response_text = response_part.strip()
                
                if 'NEW_CODE:' in rest:
                    code_changed_part, code_part = rest.split('NEW_CODE:', 1)
                    code_changed = 'true' in code_changed_part.lower()
                    
                    if code_changed and code_part.strip():
                        new_code = extract_code_from_response(code_part.strip())
                else:
                    code_changed = 'true' in rest.lower()
            else:
                response_text = parts.strip()
        else:
            response_text = content
        
        if code_changed and new_code.strip() and new_code != current_code:
            return response_text.strip(), True, new_code.strip()
        else:
            return response_text.strip(), False, current_code
            
    except Exception as e:
        print(f"Error modifying code: {e}")
        return f"Sorry, I encountered an error processing your request: {str(e)}", False, current_code


def get_code_preview(code: str, lines: int = 4) -> str:
    """Get preview of code (first few lines)"""
    code_lines = code.split('\n')
    preview_lines = code_lines[:lines]
    preview = '\n'.join(preview_lines)
    
    if len(code_lines) > lines:
        preview += '\n...'
    
    return preview

def create_new_code_service(code_name: str, language: str) -> Dict:
    """Service function to create new coding session"""
    session_id = str(uuid.uuid4())
    
    # Generate V1 code using Ollama
    v1_code = generate_code_with_ollama(code_name, language)
    
    # Create session data structure
    sessions_data[session_id] = {
        'v1_code': v1_code,
        'base_embedding': get_code_embedding(v1_code).tolist(),
        'metadata': {
            'name': code_name,
            'language': language,
            'created_at': datetime.now().isoformat()
        },
        'histories': {}
    }
    
    # Add to FAISS index
    add_to_faiss_index(session_id, v1_code)
    
    # Save session data
    save_session_data()
    
    return {
        "session_id": session_id,
        "name": code_name,
        "language": language
    }

def get_all_codes_service() -> List[Dict]:
    """Service function to get all coding sessions"""
    result = []
    
    for session_id, session_data in sessions_data.items():
        metadata = session_data['metadata']
        v1_code = session_data['v1_code']
        
        # Calculate chat count
        chat_count = len(session_data.get('histories', {}))
        
        # Get most recent update time
        updated_at = datetime.fromisoformat(metadata['created_at'])
        for history in session_data.get('histories', {}).values():
            if history.get('chat_memory'):
                last_chat = history['chat_memory'][-1]
                chat_time = datetime.fromisoformat(last_chat['timestamp'])
                if chat_time > updated_at:
                    updated_at = chat_time
        
        result.append({
            'session_id': session_id,
            'name': metadata['name'],
            'language': metadata['language'],
            'v1_preview': get_code_preview(v1_code),
            'updated_at': get_relative_time(updated_at),
            'chat_count': chat_count
        })
    
    # Sort by updated_at (most recent first)
    result.sort(key=lambda x: x['updated_at'])
    
    return result

def get_session_history_service(session_id: str) -> List[Dict]:
    """Service function to get session history"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    session_data = sessions_data[session_id]
    histories = session_data.get('histories', {})
    
    result = []
    for history_id, history_data in histories.items():
        chat_memory = history_data.get('chat_memory', [])
        version_count = len(history_data.get('versions', {})) + 1  # +1 for V1
        
        # Get last updated time
        updated_at = datetime.now()
        if chat_memory:
            updated_at = datetime.fromisoformat(chat_memory[-1]['timestamp'])
        
        result.append({
            'history_id': history_id,
            'caption': history_data.get('caption', 'Untitled Chat'),
            'updated_at': get_relative_time(updated_at),
            'version_count': version_count
        })
    
    # Sort by updated_at (most recent first)
    result.sort(key=lambda x: x['updated_at'])
    
    return result

def get_chat_history_service(session_id: str, history_id: str) -> Dict:
    """Service function to get chat history"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    session_data = sessions_data[session_id]
    histories = session_data.get('histories', {})
    
    if history_id not in histories:
        raise ValueError("History not found")
    
    history_data = histories[history_id]
    chat_memory = history_data.get('chat_memory', [])
    
    # Convert chat memory to required format
    messages = []
    for msg in chat_memory:
        messages.append({
            'query': msg['query'],
            'response': msg['response'],
            'code_changed': msg['code_changed'],
            'version': msg['version'],
            'timestamp': msg['timestamp']
        })
    
    # Get current code (latest version or V1)
    current_version = history_data.get('current_version', 'v1')
    if current_version == 'v1':
        current_code = session_data['v1_code']
    else:
        versions = history_data.get('versions', {})
        current_code = versions.get(current_version, {}).get('code', session_data['v1_code'])
    
    return {
        'messages': messages,
        'current_code': current_code
    }

def chat_interaction_service(session_id: str, history_id: Optional[str], query: str) -> Dict:
    """Service function for chat interaction"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    session_data = sessions_data[session_id]
    
    # Handle new history creation
    if history_id is None:
        history_id = str(uuid.uuid4())
        caption = generate_caption(query)
        
        session_data['histories'][history_id] = {
            'caption': caption,
            'current_version': 'v1',
            'chat_memory': [],
            'versions': {}
        }
    else:
        if history_id not in session_data['histories']:
            raise ValueError("History not found")
        caption = session_data['histories'][history_id]['caption']
    
    history_data = session_data['histories'][history_id]
    
    # Get current code
    current_version = history_data['current_version']
    if current_version == 'v1':
        current_code = session_data['v1_code']
    else:
        versions = history_data.get('versions', {})
        current_code = versions.get(current_version, {}).get('code', session_data['v1_code'])
    
    # Get chat context for better responses
    chat_context = history_data.get('chat_memory', [])
    
    # Use FAISS for similarity search to provide context
    similar_sessions = search_similar_code(query)
    
    # Generate response using Ollama
    response_text, code_changed, new_code = modify_code_with_chat(
        current_code, query, session_data['metadata']['language'], chat_context
    )
    
    # Handle version increment if code changed
    new_version = current_version
    if code_changed:
        # Increment version
        if current_version == 'v1':
            new_version = 'v2'
        else:
            version_num = int(current_version[1:]) + 1
            new_version = f'v{version_num}'
        
        # Store new version (only code and metadata, no text mixed in)
        history_data['versions'][new_version] = {
            'code': new_code,  # Only pure code
            'embedding': get_code_embedding(new_code).tolist(),
            'timestamp': datetime.now().isoformat(),
            'changes': f"Modified based on: {query}"
        }
        
        history_data['current_version'] = new_version
    
    # Add to chat memory
    chat_entry = {
        'query': query,
        'response': response_text,
        'code_changed': code_changed,
        'version': new_version,
        'timestamp': datetime.now().isoformat()
    }
    
    history_data['chat_memory'].append(chat_entry)
    
    # Save session data
    save_session_data()
    
    return {
        'response': response_text,
        'code_updated': code_changed,
        'new_version': new_version if code_changed else None,
        'code_preview': get_code_preview(new_code if code_changed else current_code),
        'history_id': history_id,
        'caption': caption
    }

def get_code_details_service(session_id: str, history_id: str, version: str) -> Dict:
    """Service function to get code details"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    session_data = sessions_data[session_id]
    
    if history_id not in session_data['histories']:
        raise ValueError("History not found")
    
    history_data = session_data['histories'][history_id]
    
    # Get code and metadata based on version
    if version == 'v1':
        code = session_data['v1_code']
        created_at = session_data['metadata']['created_at']
        changes_summary = "Initial code generation"
        diff_from_previous = None
    else:
        versions = history_data.get('versions', {})
        if version not in versions:
            raise ValueError("Version not found")
        
        version_data = versions[version]
        code = version_data['code']
        created_at = version_data['timestamp']
        changes_summary = version_data.get('changes', 'No changes recorded')
        
        # Get previous version for diff
        version_num = int(version[1:])
        prev_version = f'v{version_num - 1}' if version_num > 2 else 'v1'
        
        if prev_version == 'v1':
            prev_code = session_data['v1_code']
        else:
            prev_code = versions.get(prev_version, {}).get('code', '')
        
        # Simple diff (could be enhanced with proper diff library)
        diff_from_previous = f"Previous version ({prev_version}):\n{prev_code}\n\nCurrent version ({version}):\n{code}"
    
    return {
        'version': version,
        'language': session_data['metadata']['language'],
        'algorithm_name': session_data['metadata']['name'],
        'code': code,
        'created_at': created_at,
        'changes_summary': changes_summary,
        'diff_from_previous': diff_from_previous
    }

def delete_session_service(session_id: str) -> Dict:
    """Service function to delete a session"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    # Remove from memory
    del sessions_data[session_id]
    
    # Remove from FAISS index mapping
    global session_ids_map
    session_ids_map = {k: v for k, v in session_ids_map.items() if v != session_id}
    
    # Remove session folder
    session_folder = SESSIONS_FOLDER / session_id
    if session_folder.exists():
        shutil.rmtree(session_folder)
    
    # Save updated data
    save_session_data()
    
    return {"message": f"Session {session_id} deleted successfully"}

def delete_history_service(session_id: str, history_id: str) -> Dict:
    """Service function to delete a specific history"""
    if session_id not in sessions_data:
        raise ValueError("Session not found")
    
    session_data = sessions_data[session_id]
    histories = session_data.get('histories', {})
    
    if history_id not in histories:
        raise ValueError("History not found")
    
    # Get history info for response
    history_caption = histories[history_id].get('caption', 'Unknown')
    
    # Remove from memory
    del histories[history_id]
    
    # Remove history folder from file system
    session_folder = get_session_folder(session_id)
    history_folder = session_folder / "histories" / history_id
    
    if history_folder.exists():
        shutil.rmtree(history_folder)
    
    # Save updated session data
    save_session_data()
    
    return {
        "message": f"History '{history_caption}' deleted successfully",
        "session_id": session_id,
        "history_id": history_id,
        "remaining_histories": len(histories)
    }