"""POST /api/sync — ingest metadata-only events from the extension."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_org
from ..database import get_db
from ..models import Organization, SyncEvent
from ..schemas import SyncRequest, SyncResponse

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync", response_model=SyncResponse)
def sync(
    body: SyncRequest,
    org: Organization = Depends(require_org),
    db: Session = Depends(get_db),
):
    for e in body.events:
        db.add(
            SyncEvent(
                org_id=org.id,
                timestamp=e.timestamp,
                llm=e.llm,
                risk_level=e.riskLevel,
                risk_score=e.riskScore,
                threat_categories=e.threatCategories,
                threat_count=e.threatCount,
                user_decision=e.userDecision,
                processing_time_ms=e.processingTimeMs,
            )
        )
    db.commit()
    return SyncResponse(accepted=len(body.events), org=org.name)
