import uuid
import json
import os
import re
from datetime import datetime, timezone
import faiss
import numpy as np
import ollama
import pickle
import chardet
from io import BytesIO
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from fastapi import UploadFile

from app.core.rag_config import (
    embedding_model, SESSIONS_DIR, DOCUMENTS_DIR, VECTORS_DIR,
    PDF_SUPPORT, DOCX_SUPPORT, DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP,
    DEFAULT_K_SIMILAR, OLLAMA_MODEL
)

# Import libraries conditionally
if PDF_SUPPORT:
    import PyPDF2

if DOCX_SUPPORT:
    import docx

# Utility functions
def format_time_ago(timestamp: datetime) -> str:
    """Format timestamp to human readable time ago format"""
    now = datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    
    diff = now - timestamp
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return f"{int(seconds)} sec ago"
    elif seconds < 3600:
        return f"{int(seconds // 60)} min ago"
    elif seconds < 86400:
        return f"{int(seconds // 3600)} hr ago"
    else:
        days = int(seconds // 86400)
        return f"{days}d ago"

def generate_fallback_caption(query: str) -> str:
    """Generate fallback caption from query"""
    words = query.split()[:4]
    return " ".join(words).title()

def extract_text_from_file(content: bytes, filename: str) -> str:
    """Extract text from different file formats"""
    file_extension = Path(filename).suffix.lower()
    
    try:
        if file_extension == '.pdf' and PDF_SUPPORT:
            # Handle PDF files
            try:
                pdf_file = BytesIO(content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                text = ""
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
            except Exception as e:
                print(f"Error reading PDF {filename}: {e}")
                # Fallback to binary decode
                detected_encoding = chardet.detect(content[:10000])  # Check first 10KB
                encoding = detected_encoding.get('encoding', 'utf-8') if detected_encoding else 'utf-8'
                return content.decode(encoding, errors='ignore')
        
        elif file_extension == '.docx' and DOCX_SUPPORT:
            # Handle Word documents
            try:
                doc_file = BytesIO(content)
                doc = docx.Document(doc_file)
                text = ""
                for paragraph in doc.paragraphs:
                    if paragraph.text:
                        text += paragraph.text + "\n"
                return text.strip()
            except Exception as e:
                print(f"Error reading DOCX {filename}: {e}")
                # Fallback to binary decode
                detected_encoding = chardet.detect(content[:10000])
                encoding = detected_encoding.get('encoding', 'utf-8') if detected_encoding else 'utf-8'
                return content.decode(encoding, errors='ignore')
        
        elif file_extension == '.txt':
            # Handle text files with encoding detection
            detected_encoding = chardet.detect(content)
            encoding = detected_encoding.get('encoding', 'utf-8') if detected_encoding else 'utf-8'
            return content.decode(encoding, errors='ignore')
        
        else:
            # For other files or when libraries aren't available, try to detect encoding and decode
            detected_encoding = chardet.detect(content[:10000])  # Check first 10KB for speed
            encoding = detected_encoding.get('encoding', 'utf-8') if detected_encoding else 'utf-8'
            
            if encoding and encoding.lower() != 'ascii':
                try:
                    return content.decode(encoding, errors='ignore')
                except:
                    pass
            
            # Final fallback to utf-8
            return content.decode('utf-8', errors='ignore')
    
    except Exception as e:
        print(f"Error extracting text from {filename}: {e}")
        # Final fallback - try to decode as utf-8 ignoring errors
        try:
            return content.decode('utf-8', errors='ignore')
        except:
            return f"Could not extract text from {filename}"

def chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_OVERLAP) -> List[str]:
    """Split text into overlapping chunks"""
    # Clean the text first
    text = text.strip()
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Only add non-empty chunks
        if chunk.strip():
            chunks.append(chunk.strip())
        
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks

def generate_caption(query: str) -> str:
    """Generate a unique, summarized caption from the first query using Gemma3"""
    try:
        caption_prompt = f"""Create a short, unique title (3-6 words) that summarizes this question or topic. 
        Be specific and descriptive. Avoid generic words like "chat", "question", "discussion".
        
        Question: {query}
        
        Title:"""
        
        response = ollama.chat(
            model=OLLAMA_MODEL,
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

def load_session_data(session_id: str) -> Optional[Dict[str, Any]]:
    """Load session data from file"""
    session_file = SESSIONS_DIR / f"{session_id}.json"
    if session_file.exists():
        with open(session_file, 'r') as f:
            return json.load(f)
    return None

def save_session_data(session_id: str, data: dict) -> None:
    """Save session data to file"""
    session_file = SESSIONS_DIR / f"{session_id}.json"
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    with open(session_file, 'w') as f:
        json.dump(data, f, indent=2)

def load_vector_store(session_id: str) -> Tuple[Optional[faiss.Index], List[Dict[str, Any]]]:
    """Load FAISS vector store for a session"""
    vector_file = VECTORS_DIR / f"{session_id}.faiss"
    metadata_file = VECTORS_DIR / f"{session_id}_metadata.pkl"
    
    if vector_file.exists() and metadata_file.exists():
        index = faiss.read_index(str(vector_file))
        with open(metadata_file, 'rb') as f:
            metadata = pickle.load(f)
        return index, metadata
    return None, []

def save_vector_store(session_id: str, index: faiss.Index, metadata: List[Dict[str, Any]]) -> None:
    """Save FAISS vector store for a session"""
    vector_file = VECTORS_DIR / f"{session_id}.faiss"
    metadata_file = VECTORS_DIR / f"{session_id}_metadata.pkl"
    
    faiss.write_index(index, str(vector_file))
    with open(metadata_file, 'wb') as f:
        pickle.dump(metadata, f)

def create_session_service(name: str, description: str) -> Dict[str, Any]:
    """Create a new session"""
    session_id = str(uuid.uuid4())
    session_data = {
        "session_id": session_id,
        "name": name,
        "description": description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "histories": {},
        "documents": {}
    }
    
    save_session_data(session_id, session_data)
    return {
        "session_id": session_id,
        "name": name,
        "description": description,
        "updated_at": format_time_ago(datetime.now(timezone.utc))
    }

def get_all_sessions_service() -> List[Dict[str, Any]]:
    """Get all sessions"""
    sessions = []
    for session_file in SESSIONS_DIR.glob("*.json"):
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        updated_at = datetime.fromisoformat(session_data['updated_at'])
        sessions.append({
            "session_id": session_data['session_id'],
            "name": session_data['name'],
            "description": session_data['description'],
            "updated_at": format_time_ago(updated_at)
        })
    
    # Sort by updated_at in descending order
    sessions.sort(key=lambda x: x['updated_at'], reverse=True)
    return sessions

def get_session_histories_service(session_id: str) -> List[Dict[str, Any]]:
    """Get all histories for a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        return []
    
    histories = []
    for history_id, history_data in session_data.get('histories', {}).items():
        updated_at = datetime.fromisoformat(history_data['updated_at'])
        histories.append({
            "history_id": history_id,
            "caption": history_data['caption'],
            "message_count": len(history_data['messages']),
            "updated_at": format_time_ago(updated_at)
        })
    
    # Sort by updated_at in descending order
    histories.sort(key=lambda x: x['updated_at'], reverse=True)
    return histories

def get_history_messages_service(session_id: str, history_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a specific history"""
    session_data = load_session_data(session_id)
    if not session_data:
        return []
    
    history = session_data.get('histories', {}).get(history_id)
    if not history:
        return []
    
    messages = []
    for msg in history['messages']:
        # Handle backwards compatibility - older messages might not have related_chunks
        message = {
            "role": msg['role'],
            "content": msg['content'],
            "timestamp": msg['timestamp'],
            "related_chunks": msg.get('related_chunks', None)
        }
        messages.append(message)
    
    return messages

def upload_documents_service(session_id: str, files: List[UploadFile]) -> Dict[str, Any]:
    """Upload documents to a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        return {"error": "Session not found"}
    
    # Load existing vector store or create new one
    index, metadata = load_vector_store(session_id)
    if index is None:
        # Create new FAISS index with dimension matching sentence transformer
        dimension = embedding_model.get_sentence_embedding_dimension()
        index = faiss.IndexFlatL2(dimension)
        metadata = []
    
    uploaded_docs = []
    all_chunks = []
    errors = []
    
    for file in files:
        try:
            print(f"Processing file: {file.filename}")
            
            # Read file content
            content = file.file.read()
            print(f"File size: {len(content)} bytes")
            
            # Extract text based on file type
            text_content = extract_text_from_file(content, file.filename)
            print(f"Extracted text length: {len(text_content)}")
            
            # Skip if no text content extracted
            if not text_content or not text_content.strip():
                errors.append(f"No text content found in {file.filename}")
                continue
            
            # Generate document ID
            doc_id = str(uuid.uuid4())
            
            # Save original document file
            doc_file = DOCUMENTS_DIR / f"{session_id}_{doc_id}_{file.filename}"
            with open(doc_file, 'wb') as f:
                f.write(content)
            
            # Save extracted text for reference
            text_file = DOCUMENTS_DIR / f"{session_id}_{doc_id}_{file.filename}.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(text_content)
            
            # Chunk the document
            chunks = chunk_text(text_content)
            print(f"Created {len(chunks)} chunks")
            
            if not chunks:
                errors.append(f"No valid chunks created from {file.filename}")
                continue
            
            # Create embeddings for chunks
            try:
                print("Creating embeddings...")
                embeddings = embedding_model.encode(chunks)
                print(f"Created embeddings with shape: {embeddings.shape}")
                
                # Add to FAISS index
                index.add(embeddings.astype('float32'))
                
                # Update metadata
                for i, chunk in enumerate(chunks):
                    metadata.append({
                        'document_id': doc_id,
                        'document_name': file.filename,
                        'chunk_index': i,
                        'content': chunk
                    })
                    all_chunks.append(chunk)
                
                # Update session data
                session_data['documents'][doc_id] = {
                    'document_id': doc_id,
                    'document_name': file.filename,
                    'document_size': len(content),
                    'text_size': len(text_content),
                    'chunk_count': len(chunks),
                    'uploaded_at': datetime.now(timezone.utc).isoformat()
                }
                
                uploaded_docs.append({
                    'document_id': doc_id,
                    'document_name': file.filename,
                    'document_size': len(content),
                    'chunk_count': len(chunks)
                })
                
                print(f"Successfully processed {file.filename}")
                
            except Exception as e:
                error_msg = f"Error processing embeddings for {file.filename}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"Error processing {file.filename}: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
            continue
    
    # Save vector store and session data only if we have successful uploads
    if uploaded_docs:
        try:
            save_vector_store(session_id, index, metadata)
            save_session_data(session_id, session_data)
            print("Saved vector store and session data")
        except Exception as e:
            error_msg = f"Error saving data: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
    
    response = {
        "uploaded_documents": uploaded_docs, 
        "total_chunks": len(all_chunks),
        "success_count": len(uploaded_docs),
        "total_files": len(files),
        "pdf_support": PDF_SUPPORT,
        "docx_support": DOCX_SUPPORT
    }
    
    if errors:
        response["errors"] = errors
    
    return response

def get_session_documents_service(session_id: str) -> List[Dict[str, Any]]:
    """Get all documents for a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        return []
    
    documents = []
    for doc_id, doc_data in session_data.get('documents', {}).items():
        documents.append({
            "document_id": doc_data['document_id'],
            "document_name": doc_data['document_name'],
            "document_size": doc_data['document_size']
        })
    
    return documents

def chat_service(chat_request: Dict[str, Any]) -> Dict[str, Any]:
    """Chat with RAG system"""
    session_id = chat_request['session_id']
    query = chat_request['query']
    history_id = chat_request.get('history_id')
    caption = chat_request.get('caption')
    
    session_data = load_session_data(session_id)
    if not session_data:
        return {"error": "Session not found"}
    
    # Load vector store
    index, metadata = load_vector_store(session_id)
    if index is None:
        return {"error": "No documents found for this session"}
    
    # Determine if this is a new chat or continuing existing one
    is_new_chat = history_id is None
    
    if is_new_chat:
        # Create new chat history
        history_id = str(uuid.uuid4())
        caption = caption or generate_caption(query)
        history = {
            'history_id': history_id,
            'caption': caption,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'messages': []
        }
        session_data['histories'][history_id] = history
        print(f"Created new chat history: {history_id} with caption: {caption}")
    else:
        # Continue existing chat history
        if history_id not in session_data['histories']:
            return {"error": "History not found"}
        history = session_data['histories'][history_id]
        caption = history['caption']
        print(f"Continuing existing chat: {history_id}")
    
    # Get query embedding and search similar chunks
    query_embedding = embedding_model.encode([query])
    distances, indices = index.search(query_embedding.astype('float32'), k=DEFAULT_K_SIMILAR)
    
    # Get related chunks
    related_chunks = []
    for idx in indices[0]:
        if idx < len(metadata):
            related_chunks.append(metadata[idx]['content'])
    
    # Add user message (user messages don't have related_chunks)
    user_message = {
        'role': 'user',
        'content': query,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'related_chunks': None  # Users don't have related chunks
    }
    history['messages'].append(user_message)
    
    # Create context from related chunks
    context = "\n\n".join(related_chunks)
    
    # Generate response with Ollama
    rag_prompt = f"""Based on the following context, answer the user's question. If the context doesn't contain relevant information, say so.

Context:
{context}

Question: {query}

Answer:"""
    
    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[{
                "role": "user",
                "content": rag_prompt
            }],
            stream=False
        )
        
        answer = response['message']['content'].strip()
    except Exception as e:
        answer = f"I'm sorry, I encountered an error while generating the response: {str(e)}"
    
    # Add assistant message with related chunks
    assistant_message = {
        'role': 'assistant',
        'content': answer,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'related_chunks': related_chunks  # Save the related chunks with assistant message
    }
    history['messages'].append(assistant_message)
    
    # Update history timestamp
    history['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Save session data
    save_session_data(session_id, session_data)
    
    return {
        "answer": answer,
        "related_chunks": related_chunks,
        "history_id": history_id,  # Return the history_id (new or existing)
        "caption": caption
    }

def delete_session_service(session_id: str) -> Dict[str, Any]:
    """Delete a session and all associated data"""
    session_data = load_session_data(session_id)
    if not session_data:
        return {"error": "Session not found"}
    
    try:
        # Delete session file
        session_file = SESSIONS_DIR / f"{session_id}.json"
        if session_file.exists():
            session_file.unlink()
        
        # Delete vector store files
        vector_file = VECTORS_DIR / f"{session_id}.faiss"
        metadata_file = VECTORS_DIR / f"{session_id}_metadata.pkl"
        if vector_file.exists():
            vector_file.unlink()
        if metadata_file.exists():
            metadata_file.unlink()
        
        # Delete document files
        for doc_file in DOCUMENTS_DIR.glob(f"{session_id}_*"):
            doc_file.unlink()
        
        return {"message": "Session deleted successfully"}
    
    except Exception as e:
        return {"error": f"Error deleting session: {str(e)}"}

def delete_history_service(session_id: str, history_id: str) -> Dict[str, Any]:
    """Delete a specific chat history from a session"""
    session_data = load_session_data(session_id)
    if not session_data:
        return {"error": "Session not found"}
    
    if history_id not in session_data.get('histories', {}):
        return {"error": "History not found"}
    
    try:
        # Remove the history from session data
        del session_data['histories'][history_id]
        
        # Save updated session data
        save_session_data(session_id, session_data)
        
        return {"message": "History deleted successfully"}
    
    except Exception as e:
        return {"error": f"Error deleting history: {str(e)}"}

def delete_document_service(session_id: str, document_id: str) -> Dict[str, Any]:
    """Delete a document and rebuild vector store without it"""
    session_data = load_session_data(session_id)
    if not session_data:
        return {"error": "Session not found"}
    
    if document_id not in session_data.get('documents', {}):
        return {"error": "Document not found"}
    
    try:
        # Get document info before deletion
        doc_info = session_data['documents'][document_id]
        document_name = doc_info['document_name']
        
        # Remove document from session data
        del session_data['documents'][document_id]
        
        # Delete physical document files
        for doc_file in DOCUMENTS_DIR.glob(f"{session_id}_{document_id}_*"):
            doc_file.unlink()
        
        # Rebuild vector store without this document
        index, metadata = load_vector_store(session_id)
        if index is not None:
            # Filter out metadata for the deleted document
            new_metadata = [item for item in metadata if item['document_id'] != document_id]
            
            if new_metadata:
                # Rebuild the index with remaining chunks
                remaining_chunks = [item['content'] for item in new_metadata]
                embeddings = embedding_model.encode(remaining_chunks)
                
                # Create new FAISS index
                dimension = embedding_model.get_sentence_embedding_dimension()
                new_index = faiss.IndexFlatL2(dimension)
                new_index.add(embeddings.astype('float32'))
                
                # Save updated vector store
                save_vector_store(session_id, new_index, new_metadata)
            else:
                # No documents left, delete vector store files
                vector_file = VECTORS_DIR / f"{session_id}.faiss"
                metadata_file = VECTORS_DIR / f"{session_id}_metadata.pkl"
                if vector_file.exists():
                    vector_file.unlink()
                if metadata_file.exists():
                    metadata_file.unlink()
        
        # Save updated session data
        save_session_data(session_id, session_data)
        
        return {"message": f"Document '{document_name}' deleted successfully"}
    
    except Exception as e:
        return {"error": f"Error deleting document: {str(e)}"}