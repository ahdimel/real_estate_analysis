from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models.property import Property
from backend.models.user import User
from backend.analysis.rental import analyse_rental
from backend.schemas.analysis import AnalysisResponseOut

router = APIRouter(prefix="/properties", tags=["analysis"])


@router.get("/{property_id}/analysis", response_model=AnalysisResponseOut)
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

    result = analyse_rental(prop, db)
    return AnalysisResponseOut(**asdict(result))
