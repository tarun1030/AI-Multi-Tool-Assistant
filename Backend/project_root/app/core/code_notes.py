import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path
from typing import Dict, List

# Initialize sentence transformer for embeddings
embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Global storage
sessions_data: Dict[str, Dict] = {}
faiss_index = None
session_ids_map = {}  # Maps FAISS index to session_id

# FAISS setup
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 embedding dimension

# Data folder setup
DATA_FOLDER = Path("codenotes_data")
SESSIONS_FOLDER = DATA_FOLDER / "sessions"

def initialize_data_folders():
    """Initialize data folders"""
    DATA_FOLDER.mkdir(exist_ok=True)
    SESSIONS_FOLDER.mkdir(exist_ok=True)

def initialize_faiss():
    """Initialize FAISS index for vector similarity search"""
    global faiss_index
    faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner product for cosine similarity

def get_session_folder(session_id: str) -> Path:
    """Get session-specific folder path"""
    session_folder = SESSIONS_FOLDER / session_id
    session_folder.mkdir(exist_ok=True)
    return session_folder

def get_code_embedding(code: str) -> np.ndarray:
    """Generate embedding for code using sentence transformer"""
    return embedding_model.encode([code])[0]

def add_to_faiss_index(session_id: str, code: str):
    """Add code embedding to FAISS index"""
    global faiss_index, session_ids_map
    
    embedding = get_code_embedding(code)
    embedding = embedding.reshape(1, -1)
    
    # Normalize for cosine similarity
    faiss.normalize_L2(embedding)
    
    current_index = faiss_index.ntotal
    faiss_index.add(embedding)
    session_ids_map[current_index] = session_id
def search_similar_code(query: str, k: int = 3) -> List[str]:
    """Search for similar code using FAISS"""
    global faiss_index, session_ids_map
    
    if faiss_index.ntotal == 0:
        return []
    
    query_embedding = get_code_embedding(query).reshape(1, -1)
    faiss.normalize_L2(query_embedding)
    
    scores, indices = faiss_index.search(query_embedding, min(k, faiss_index.ntotal))
    
    similar_sessions = []
    for idx in indices[0]:
        if idx in session_ids_map:
            similar_sessions.append(session_ids_map[idx])
    
    return similar_sessions