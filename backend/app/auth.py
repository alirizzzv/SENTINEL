"""API-key authentication.

Clients send `X-API-Key`; we store only its SHA-256 hash, never the key itself.
The dependency resolves the calling organization or raises 401.
"""
import hashlib

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Organization


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def require_org(
    x_api_key: str = Header(default="", alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Organization:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key header")
    org = db.query(Organization).filter_by(api_key_hash=hash_key(x_api_key)).first()
    if not org:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    return org
