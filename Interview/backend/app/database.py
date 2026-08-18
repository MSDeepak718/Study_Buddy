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

    # Auto-migrate: add hashed_password column to users
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='hashed_password'"
            ))
            if not res.fetchone():
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN hashed_password VARCHAR(255);"
                ))
                conn.commit()
    except Exception:
        pass

    # Auto-migrate: update Postgres enum 'interviewmode' to include new values
    try:
        with engine.connect() as conn:
            for enum_val in ['dsa', 'system_design', 'full_flow']:
                try:
                    conn.execute(text(f"ALTER TYPE interviewmode ADD VALUE IF NOT EXISTS '{enum_val}';"))
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        print(f"Enum update error: {e}")

    # Auto-migrate: add invite_code and dsa_problems to interview_configurations
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_configurations' AND column_name='invite_code'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE interview_configurations ADD COLUMN invite_code VARCHAR(64);"))
                conn.commit()

            res2 = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_configurations' AND column_name='dsa_problems'"
            ))
            if not res2.fetchone():
                conn.execute(text("ALTER TABLE interview_configurations ADD COLUMN dsa_problems JSON;"))
                conn.commit()
    except Exception as e:
        print(f"Migration error for config columns: {e}")

    # Auto-migrate: add current_stage, attempt_count, max_attempts, is_disqualified to interview_sessions
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_sessions' AND column_name='current_stage'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN current_stage VARCHAR(50) DEFAULT 'one_on_one';"))
                conn.commit()

            res_att = conn.execute(text(
                "SELECT column_name "
                "FROM information_schema.columns "
                "WHERE table_name='interview_sessions' AND column_name='attempt_count'"
            ))
            if not res_att.fetchone():
                conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN attempt_count INTEGER DEFAULT 1;"))
                conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN max_attempts INTEGER DEFAULT 2;"))
                conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN is_disqualified BOOLEAN DEFAULT FALSE;"))
                conn.commit()

            # Ensure both 'failed' and 'FAILED' values exist in sessionstatus PostgreSQL enum
            try:
                conn.execute(text("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'FAILED';"))
                conn.execute(text("ALTER TYPE sessionstatus ADD VALUE IF NOT EXISTS 'failed';"))
                conn.commit()
            except Exception:
                pass
    except Exception as e:
        print(f"Migration error for session columns: {e}")

    # Seed Admin User
    try:
        from app.models.user import User, UserRole
        from app.utils.security import hash_password
        db = SessionLocal()
        try:
            admin_emails = ["admin@123", "admin@123.com"]
            for email_str in admin_emails:
                admin_user = db.query(User).filter(User.email == email_str).first()
                if not admin_user:
                    admin_user = User(
                        name="Platform Admin",
                        email=email_str,
                        hashed_password=hash_password("DeepakBhuvi"),
                        role=UserRole.ADMIN,
                    )
                    db.add(admin_user)
                else:
                    admin_user.hashed_password = hash_password("DeepakBhuvi")
                    admin_user.role = UserRole.ADMIN
            db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"Error seeding admin user: {e}")
