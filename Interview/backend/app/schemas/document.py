from pydantic import BaseModel
from datetime import datetime


class DocumentInfo(BaseModel):
    id: str
    filename: str
    chunk_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    status: str
    message: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo]
    total: int
