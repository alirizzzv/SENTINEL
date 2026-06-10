"""GET /api/analytics/* — org-scoped aggregates for the admin dashboard."""
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_org
from ..database import get_db
from ..models import Organization, SyncEvent
from ..schemas import CategoryCount, Summary, TrendPoint

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=Summary)
def summary(org: Organization = Depends(require_org), db: Session = Depends(get_db)):
    events = db.query(SyncEvent).filter_by(org_id=org.id).all()
    total = len(events)
    threats = [e for e in events if (e.threat_count or 0) > 0]
    redacted = sum(1 for e in events if e.user_decision == "REDACTED")

    by_risk = Counter(e.risk_level for e in events)
    by_llm = Counter(e.llm for e in events)
    cats = Counter()
    for e in events:
        cats.update(e.threat_categories or [])

    return Summary(
        total=total,
        threats=len(threats),
        redactionRate=round(redacted / len(threats) * 100) if threats else 0,
        byRisk=dict(by_risk),
        byLlm=dict(by_llm),
        topCategories=[CategoryCount(category=c, count=n) for c, n in cats.most_common(8)],
    )


@router.get("/trend", response_model=list[TrendPoint])
def trend(
    days: int = Query(default=30, ge=1, le=180),
    org: Organization = Depends(require_org),
    db: Session = Depends(get_db),
):
    events = db.query(SyncEvent).filter_by(org_id=org.id).all()
    buckets = {}  # day -> [sum, n]
    for e in events:
        day = datetime.fromtimestamp(e.timestamp / 1000, tz=timezone.utc).strftime("%m-%d")
        s, n = buckets.get(day, (0, 0))
        buckets[day] = (s + (e.risk_score or 0), n + 1)
    points = [
        TrendPoint(label=day, value=round(s / n) if n else 0)
        for day, (s, n) in sorted(buckets.items())
    ]
    return points[-days:]
