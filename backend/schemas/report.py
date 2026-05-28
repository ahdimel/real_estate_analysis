from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class ReportOut(BaseModel):
    id: int
    public_id: str
    property_id: Optional[int]
    property_name: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class ReportDetailOut(ReportOut):
    snapshot: dict[str, Any]


class ReportGenerateResponse(BaseModel):
    report: ReportDetailOut
    remaining: int
