import logging
from typing import Optional

import chromadb
from sentence_transformers import SentenceTransformer

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RAGService:
    """Service for RAG operations: embedding, storage, and retrieval."""

    def __init__(self):
        self._client: Optional[chromadb.PersistentClient] = None
        self._collection = None
        self._embedding_model: Optional[SentenceTransformer] = None

    @property
    def embedding_model(self) -> SentenceTransformer:
        """Lazy-load embedding model to avoid startup cost."""
        if self._embedding_model is None:
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            self._embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("Embedding model loaded successfully")
        return self._embedding_model

    @property
    def client(self) -> chromadb.PersistentClient:
        """Lazy-load ChromaDB client with hot-reload resilience."""
        if self._client is None:
            import chromadb.api.shared_system_client
            # Clear stale cache entries left from previous uvicorn reloads
            chromadb.api.shared_system_client.SharedSystemClient.clear_system_cache()
            try:
                self._client = chromadb.PersistentClient(
                    path=str(settings.chroma_path)
                )
            except (KeyError, AttributeError) as e:
                # Corrupted cache from hot-reload — clear and retry once
                logger.warning(f"ChromaDB cache corrupted ({e}), clearing and retrying...")
                chromadb.api.shared_system_client.SharedSystemClient.clear_system_cache()
                self._client = chromadb.PersistentClient(
                    path=str(settings.chroma_path)
                )
            logger.info(f"ChromaDB client initialized at: {settings.chroma_path}")
        return self._client

    @property
    def collection(self):
        """Get or create the ChromaDB collection."""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},  # Use cosine similarity
            )
            logger.info(f"ChromaDB collection '{settings.CHROMA_COLLECTION_NAME}' ready")
        return self._collection

    def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        embeddings = self.embedding_model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    def add_documents(self, chunks: list[dict]) -> None:
        """
        Add document chunks to ChromaDB with embeddings.

        Args:
            chunks: List of dicts with 'text' and 'metadata' keys
        """
        if not chunks:
            return

        texts = [chunk["text"] for chunk in chunks]
        metadatas = [chunk["metadata"] for chunk in chunks]
        ids = [chunk["metadata"]["chunk_id"] for chunk in chunks]

        # Generate embeddings
        embeddings = self._generate_embeddings(texts)

        # Upsert into ChromaDB
        self.collection.upsert(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

        logger.info(f"Added {len(chunks)} chunks to ChromaDB")

    def retrieve(
        self,
        query: str,
        n_results: int = 5,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        """
        Retrieve relevant chunks for a query.

        Args:
            query: The search query (e.g., topic or question)
            n_results: Number of results to return
            document_ids: Optional filter by specific document IDs

        Returns:
            List of dicts with 'text', 'metadata', and 'distance' keys
        """
        # Generate query embedding
        query_embedding = self._generate_embeddings([query])[0]

        # Build where filter if document_ids specified
        where_filter = None
        if document_ids:
            where_filter = {"document_id": {"$in": document_ids}}

        # Query ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        # Format results
        retrieved = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                retrieved.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": dist,
                })

        logger.info(f"Retrieved {len(retrieved)} chunks for query: '{query[:50]}...'")
        return retrieved

    def delete_by_document_id(self, document_id: str) -> None:
        """Delete all chunks for a specific document."""
        try:
            # Get all chunk IDs for this document
            results = self.collection.get(
                where={"document_id": document_id},
                include=[],
            )
            if results["ids"]:
                self.collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for document {document_id}")
        except Exception as e:
            logger.warning(f"Error deleting chunks for document {document_id}: {e}")

    def get_collection_stats(self) -> dict:
        """Get collection statistics."""
        return {
            "total_chunks": self.collection.count(),
            "collection_name": settings.CHROMA_COLLECTION_NAME,
        }

    def reset(self) -> None:
        """Reset internal state. Call during app shutdown to prevent hot-reload crashes."""
        import chromadb.api.shared_system_client
        self._collection = None
        self._client = None
        try:
            chromadb.api.shared_system_client.SharedSystemClient.clear_system_cache()
        except Exception:
            pass
        logger.info("RAGService reset complete")


# Singleton
rag_service = RAGService()
