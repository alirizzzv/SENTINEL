"""Custom organization patterns (admin/enterprise): list, create, deactivate.

Lets an org add its own detection patterns — e.g. internal project codenames —
that the extension can fetch alongside the built-in dictionary.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_org
from ..database import get_db
from ..models import CustomPattern, Organization
from ..schemas import CustomPatternIn, CustomPatternOut

router = APIRouter(prefix="/api/patterns", tags=["patterns"])


@router.get("", response_model=list[CustomPatternOut])
def list_patterns(org: Organization = Depends(require_org), db: Session = Depends(get_db)):
    rows = db.query(CustomPattern).filter_by(org_id=org.id, is_active=True).all()
    return [
        CustomPatternOut(
            id=r.id, name=r.name, pattern=r.pattern, category=r.category,
            score=r.score, created_by=r.created_by, is_active=r.is_active,
        )
        for r in rows
    ]


@router.post("", response_model=CustomPatternOut, status_code=status.HTTP_201_CREATED)
def create_pattern(
    body: CustomPatternIn,
    org: Organization = Depends(require_org),
    db: Session = Depends(get_db),
):
    row = CustomPattern(
        org_id=org.id, name=body.name, pattern=body.pattern,
        category=body.category, score=body.score, created_by=body.created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CustomPatternOut(
        id=row.id, name=row.name, pattern=row.pattern, category=row.category,
        score=row.score, created_by=row.created_by, is_active=row.is_active,
    )


@router.delete("/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_pattern(
    pattern_id: str,
    org: Organization = Depends(require_org),
    db: Session = Depends(get_db),
):
    row = db.query(CustomPattern).filter_by(id=pattern_id, org_id=org.id).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pattern not found")
    row.is_active = False
    db.commit()
