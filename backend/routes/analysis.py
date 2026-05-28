from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models.property import Property
from backend.models.report import Report
from backend.models.user import User
from backend.schemas.report import ReportDetailOut

router = APIRouter(prefix="/properties", tags=["analysis"])


@router.get("/{property_id}/analysis", response_model=ReportDetailOut)
def get_analysis(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == current_user.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    report = (
        db.query(Report)
        .filter(Report.user_id == current_user.id, Report.property_id == property_id)
        .order_by(Report.generated_at.desc(), Report.id.desc())
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="No analysis found. Run an analysis to get started.")

    return report
