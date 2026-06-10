"""Pydantic request/response models — the API contract & validation layer."""
from typing import List, Optional

from pydantic import BaseModel, Field


class EventIn(BaseModel):
    """One metadata-only scan event uploaded by the extension."""

    timestamp: int
    llm: str
    riskLevel: str = Field(pattern="^(SAFE|CAUTION|HIGH)$")
    riskScore: int = Field(ge=0, le=100)
    threatCategories: List[str] = []
    threatCount: int = 0
    userDecision: str
    processingTimeMs: float = 0


class SyncRequest(BaseModel):
    events: List[EventIn] = Field(..., max_length=1000)


class SyncResponse(BaseModel):
    accepted: int
    org: str


class CategoryCount(BaseModel):
    category: str
    count: int


class Summary(BaseModel):
    total: int
    threats: int
    redactionRate: int
    byRisk: dict
    byLlm: dict
    topCategories: List[CategoryCount]


class TrendPoint(BaseModel):
    label: str
    value: int


class CustomPatternIn(BaseModel):
    name: str
    pattern: str
    category: str
    score: int = Field(default=50, ge=0, le=100)
    created_by: Optional[str] = None


class CustomPatternOut(CustomPatternIn):
    id: str
    is_active: bool
