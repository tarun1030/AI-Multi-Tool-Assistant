from pathlib import Path
import faiss
from sentence_transformers import SentenceTransformer

# Try to import PDF and DOCX libraries with fallbacks
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("PyPDF2 not installed. PDF support disabled.")

try:
    import docx
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False
    print("python-docx not installed. DOCX support disabled.")

# Initialize sentence transformer model
embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Data storage directories
DATA_DIR = Path("rag_data")
SESSIONS_DIR = DATA_DIR / "sessions"
DOCUMENTS_DIR = DATA_DIR / "documents"
VECTORS_DIR = DATA_DIR / "vectors"

# Create directories if they don't exist
for dir_path in [DATA_DIR, SESSIONS_DIR, DOCUMENTS_DIR, VECTORS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Configuration constants
DEFAULT_CHUNK_SIZE = 500
DEFAULT_OVERLAP = 50
DEFAULT_K_SIMILAR = 3
OLLAMA_MODEL = 'gemma3:4b'