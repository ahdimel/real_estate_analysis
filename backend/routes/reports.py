from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models.property import Property
from backend.models.report import Report, generate_public_id
from backend.models.user import User
from backend.analysis.rental import analyse_rental
from backend.schemas.analysis import AnalysisResponseOut
from backend.schemas.property import PropertyOut
from backend.schemas.report import ReportDetailOut, ReportGenerateResponse, ReportOut

REPORT_LIMIT = 10

router = APIRouter(tags=["reports"])


def _count_reports(db: Session, user_id: int) -> int:
    return db.query(Report).filter(Report.user_id == user_id).count()


@router.post("/properties/{property_id}/report", response_model=ReportGenerateResponse)
def generate_report(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = _count_reports(db, current_user.id)
    if count >= REPORT_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Lifetime report limit of {REPORT_LIMIT} reached.",
        )

    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.user_id == current_user.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    property_name = f"{prop.address_street}, {prop.address_city}"
    prop_data = PropertyOut.model_validate(prop).model_dump(mode="json")
    result = analyse_rental(prop)
    analysis_data = AnalysisResponseOut(**asdict(result)).model_dump(mode="json")

    # Guarantee uniqueness in the unlikely event of a collision
    for _ in range(10):
        candidate = generate_public_id()
        if not db.query(Report).filter(Report.public_id == candidate).first():
            public_id = candidate
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique report ID.")

    report = Report(
        public_id=public_id,
        user_id=current_user.id,
        property_id=property_id,
        property_name=property_name,
        snapshot={"property": prop_data, "analysis": analysis_data},
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportGenerateResponse(
        report=ReportDetailOut.model_validate(report),
        remaining=REPORT_LIMIT - count - 1,
    )


@router.get("/reports", response_model=list[ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Report)
        .filter(Report.user_id == current_user.id)
        .order_by(Report.generated_at.desc())
        .all()
    )


@router.get("/properties/{property_id}/reports", response_model=list[ReportOut])
def list_property_reports(
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

    return (
        db.query(Report)
        .filter(Report.user_id == current_user.id, Report.property_id == property_id)
        .order_by(Report.generated_at.desc())
        .all()
    )


@router.get("/reports/count", response_model=dict)
def get_report_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = _count_reports(db, current_user.id)
    return {"used": count, "limit": REPORT_LIMIT, "remaining": REPORT_LIMIT - count}


@router.get("/reports/{public_id}", response_model=ReportDetailOut)
def get_report(
    public_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.public_id == public_id,
        Report.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
