from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/{session_id}")
def get_dashboard(session_id: str, db: Session = Depends(get_db)):
    try:
        return analytics_service.get_session_dashboard(db, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
