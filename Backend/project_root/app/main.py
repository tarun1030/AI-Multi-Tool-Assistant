# FastAPI application entry point
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import api_router
from app.core.config import settings
from app.services.storage import load_all_sessions, start_auto_save, cleanup_on_exit
from app.core.code_notes import initialize_data_folders, initialize_faiss
from app.services.code_notes import load_session_data, save_session_data


import atexit

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    """Load sessions on startup and start auto-save"""
    load_all_sessions()
    start_auto_save()
    initialize_data_folders()
    initialize_faiss()
    load_session_data()
    print(f"Server started with {len(settings.chat_sessions)} active sessions")

@app.on_event("shutdown")
async def shutdown_event():
    """Save sessions on shutdown"""
    cleanup_on_exit()
    save_session_data()

atexit.register(cleanup_on_exit)