import logging
from typing import Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


def create_chunks(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    document_id: str = "",
    filename: str = "",
) -> list[dict]:
    """
    Split text into overlapping chunks with metadata.

    Args:
        text: The full document text
        chunk_size: Target size for each chunk (in characters)
        chunk_overlap: Number of overlapping characters between chunks
        document_id: ID of the source document
        filename: Original filename for metadata

    Returns:
        List of dicts with 'text' and 'metadata' keys
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
        is_separator_regex=False,
    )

    documents = splitter.create_documents(
        texts=[text],
        metadatas=[{
            "document_id": document_id,
            "filename": filename,
            "source": filename,
        }],
    )

    chunks = []
    for idx, doc in enumerate(documents):
        chunks.append({
            "text": doc.page_content,
            "metadata": {
                **doc.metadata,
                "chunk_index": idx,
                "chunk_id": f"{document_id}_chunk_{idx}",
            },
        })

    logger.info(
        f"Created {len(chunks)} chunks from '{filename}' "
        f"(chunk_size={chunk_size}, overlap={chunk_overlap})"
    )
    return chunks
