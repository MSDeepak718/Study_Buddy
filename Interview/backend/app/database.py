from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings


settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    echo=False, 
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True, 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """
    Dependency injection for database sessions.
    Ensures session is properly closed after each request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables from registered models. Used for development."""
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_sessions' AND column_name='recommendations'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN recommendations JSON;"))
                conn.commit()
    except Exception:
        pass

    # Auto-migrate: add interview_mode column
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_configurations' AND column_name='interview_mode'"
            ))
            if not res.fetchone():
                conn.execute(text(
                    "ALTER TABLE interview_configurations "
                    "ADD COLUMN interview_mode VARCHAR(10) DEFAULT 'chat' NOT NULL;"
                ))
                conn.commit()
    except Exception:
        pass
