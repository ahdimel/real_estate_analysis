import secrets
import string

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

_ID_CHARS = string.digits + string.ascii_uppercase


def generate_public_id() -> str:
    return "".join(secrets.choice(_ID_CHARS) for _ in range(8))


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(8), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="SET NULL"), nullable=True)
    property_name = Column(String, nullable=False)
    snapshot = Column(JSON, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reports")
    property = relationship("Property", back_populates="reports")
