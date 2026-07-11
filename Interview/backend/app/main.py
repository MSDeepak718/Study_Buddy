import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_tables
from app.api.documents import router as documents_router
from app.api.interviews import router as interviews_router
from app.api.dashboard import router as dashboard_router
from app.api.voice import router as voice_router
from app.services.rag_service import rag_service

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting AI Interview Platform...")
    create_tables()
    logger.info("---Database tables ready---")
    # Ensure upload directory exists
    settings.upload_path
    settings.chroma_path
    logger.info("---Storage directories ready---")
    yield
    # Clean up ChromaDB state before uvicorn reload
    rag_service.reset()
    logger.info("---Shutting down AI Interview Platform---")


app = FastAPI(
    title="AI Interview Platform",
    description="RAG-powered AI Interview Preparation System with Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(documents_router, prefix="/api/v1")
app.include_router(interviews_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(voice_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "AI Interview Platform API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
