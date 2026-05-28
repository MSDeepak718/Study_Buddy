import hashlib
import logging
import shutil
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.document import UploadedDocument, DocumentStatus
from app.utils.parsing import parse_document
from app.utils.chunking import create_chunks
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)
settings = get_settings()


class DocumentService:
    """Service for document lifecycle management."""

    def save_uploaded_file(self, file_content: bytes, filename: str) -> tuple[str, str]:
        """
        Save uploaded file to disk and return (file_path, content_hash).
        """
        # Generate unique filename to avoid collisions
        file_id = str(uuid.uuid4())
        extension = Path(filename).suffix
        safe_filename = f"{file_id}{extension}"
        file_path = settings.upload_path / safe_filename

        with open(file_path, "wb") as f:
            f.write(file_content)

        # Compute content hash for deduplication
        content_hash = hashlib.sha256(file_content).hexdigest()

        logger.info(f"Saved uploaded file: {filename} -> {safe_filename}")
        return str(file_path), content_hash

    def process_document(
        self, db: Session, document_id: str, file_path: str, filename: str
    ) -> int:
        """
        Full RAG ingestion pipeline:
        1. Parse document → text
        2. Chunk text → overlapping chunks
        3. Generate embeddings → vectors
        4. Store in ChromaDB → searchable

        Args:
            db: Database session
            document_id: ID of the document record
            file_path: Path to the uploaded file
            filename: Original filename

        Returns:
            Number of chunks created
        """
        try:
            # Step 1: Parse
            logger.info(f"Parsing document: {filename}")
            text = parse_document(file_path)

            if not text.strip():
                raise ValueError(f"No text extracted from {filename}")

            # Step 2: Chunk
            logger.info(f"Chunking document: {filename}")
            chunks = create_chunks(
                text=text,
                chunk_size=1000,
                chunk_overlap=200,
                document_id=document_id,
                filename=filename,
            )

            # Step 3 & 4: Embed and store in ChromaDB
            logger.info(f"Embedding and storing {len(chunks)} chunks for: {filename}")
            rag_service.add_documents(chunks)

            # Update document record
            doc = db.query(UploadedDocument).filter(UploadedDocument.id == document_id).first()
            if doc:
                doc.chunk_count = len(chunks)
                doc.status = DocumentStatus.READY
                db.commit()

            logger.info(f"Successfully processed document: {filename} ({len(chunks)} chunks)")
            return len(chunks)

        except Exception as e:
            logger.error(f"Failed to process document {filename}: {e}")
            # Mark document as failed
            doc = db.query(UploadedDocument).filter(UploadedDocument.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                db.commit()
            raise

    def list_documents(self, db: Session) -> list[UploadedDocument]:
        """List all uploaded documents."""
        return db.query(UploadedDocument).order_by(UploadedDocument.created_at.desc()).all()

    def get_document(self, db: Session, document_id: str) -> UploadedDocument | None:
        """Get a single document by ID."""
        return db.query(UploadedDocument).filter(UploadedDocument.id == document_id).first()

    def delete_document(self, db: Session, document_id: str) -> bool:
        """Delete a document and its chunks from ChromaDB."""
        doc = self.get_document(db, document_id)
        if not doc:
            return False

        # Remove from ChromaDB
        rag_service.delete_by_document_id(document_id)

        # Remove file from disk
        try:
            Path(doc.file_path).unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Failed to delete file {doc.file_path}: {e}")

        # Remove from database
        db.delete(doc)
        db.commit()
        return True


# Singleton
document_service = DocumentService()
