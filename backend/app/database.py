"""Database engine, session factory, and schema bootstrap."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and (optionally) seed a demo organization."""
    from . import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)

    if settings.seed_demo_org:
        from .auth import hash_key
        from .models import Organization

        db = SessionLocal()
        try:
            key_hash = hash_key(settings.demo_api_key)
            existing = db.query(Organization).filter_by(api_key_hash=key_hash).first()
            if not existing:
                db.add(Organization(name="Demo Org", api_key_hash=key_hash, plan="trial", max_users=25))
                db.commit()
        finally:
            db.close()
