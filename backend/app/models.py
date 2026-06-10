"""SQLAlchemy ORM models — the enterprise-side schema.

Mirrors the local IndexedDB event shape but scoped to an organization. Stores
ONLY anonymized metadata (no prompt content), exactly like the client.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.types import TypeDecorator

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class JSONList(TypeDecorator):
    """Portable string[] column: PostgreSQL has ARRAY/JSONB, SQLite does not, so
    we store a delimited string and present it as a Python list either way."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if not value:
            return ""
        return "|".join(value)

    def process_result_value(self, value, dialect):
        return [v for v in value.split("|") if v] if value else []


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    api_key_hash = Column(String(64), unique=True, nullable=False, index=True)
    plan = Column(String(20), default="trial")  # trial | standard | enterprise
    max_users = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)


class SyncEvent(Base):
    __tablename__ = "sync_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    timestamp = Column(Integer, nullable=False)  # Unix ms from the client
    llm = Column(String(50))
    risk_level = Column(String(10))
    risk_score = Column(SmallInteger)
    threat_categories = Column(JSONList)
    threat_count = Column(SmallInteger, default=0)
    user_decision = Column(String(20))
    processing_time_ms = Column(Numeric(8, 3))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        # Every dashboard query filters by org first; timestamp DESC for recents.
        Index("idx_sync_events_org_timestamp", "org_id", "timestamp"),
        Index("idx_sync_events_org_risk", "org_id", "risk_level"),
        Index("idx_sync_events_org_llm", "org_id", "llm"),
    )


class CustomPattern(Base):
    __tablename__ = "custom_patterns"

    id = Column(String(36), primary_key=True, default=_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    pattern = Column(Text, nullable=False)  # regex or keyword
    category = Column(String(50))
    score = Column(SmallInteger, default=50)
    created_by = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
