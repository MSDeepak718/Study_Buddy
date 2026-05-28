import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.models.document import UploadedDocument, DocumentStatus
from app.models.user import User, UserRole
from app.schemas.document import DocumentUploadResponse, DocumentListResponse, DocumentInfo
from app.services.document_service import document_service
from app.utils.parsing import get_supported_extensions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])
settings = get_settings()


def get_or_create_admin(db: Session) -> User:
    """Get or create default admin user for development."""
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if not admin:
        admin = User(name="Admin", email="admin@interview.ai", role=UserRole.ADMIN)
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload and process a document (PDF, DOCX, or TXT)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in get_supported_extensions():
        raise HTTPException(400, f"Unsupported file type: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max: {settings.MAX_FILE_SIZE_MB}MB")

    admin = get_or_create_admin(db)
    file_path, content_hash = document_service.save_uploaded_file(content, file.filename or "document")

    # Check for duplicate
    existing = db.query(UploadedDocument).filter(UploadedDocument.content_hash == content_hash).first()
    if existing:
        Path(file_path).unlink(missing_ok=True)
        return DocumentUploadResponse(id=existing.id, filename=existing.filename, status=existing.status.value, message="Document already uploaded")

    doc = UploadedDocument(uploaded_by=admin.id, filename=file.filename or "document", file_path=file_path, content_hash=content_hash, status=DocumentStatus.PROCESSING)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        chunk_count = document_service.process_document(db, doc.id, file_path, file.filename or "document")
        return DocumentUploadResponse(id=doc.id, filename=doc.filename, status="ready", message=f"Processed successfully. {chunk_count} chunks created.")
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(500, f"Document processing failed: {str(e)}")


@router.get("", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents."""
    docs = document_service.list_documents(db)
    return DocumentListResponse(
        documents=[DocumentInfo(id=d.id, filename=d.filename, chunk_count=d.chunk_count, status=d.status.value, created_at=d.created_at) for d in docs],
        total=len(docs),
    )


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document and its vector embeddings."""
    if document_service.delete_document(db, document_id):
        return {"message": "Document deleted"}
    raise HTTPException(404, "Document not found")
