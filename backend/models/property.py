from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # House information
    mls_id = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    address_street = Column(String, nullable=False)
    address_city = Column(String, nullable=False)
    address_state = Column(String, nullable=False)
    address_zip = Column(String, nullable=False)
    property_type = Column(String, nullable=False)
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(Integer, nullable=False)
    garage = Column(String, nullable=False)
    year_built = Column(Integer, nullable=False)
    square_feet = Column(Integer, nullable=False)

    # Acquisition
    purchase_price = Column(Numeric(11, 2), nullable=False)
    annual_interest_rate = Column(Numeric(5, 2), nullable=False)
    mortgage_term = Column(Integer, nullable=False)
    down_payment = Column(Numeric(5, 2), nullable=False)
    closing_costs = Column(Numeric(11, 2), nullable=False)
    pmi_monthly = Column(Numeric(7, 2), nullable=True)

    # Property management
    rent_lower = Column(Numeric(9, 2), nullable=False)
    rent_upper = Column(Numeric(9, 2), nullable=False)
    property_tax_annual = Column(Numeric(10, 2), nullable=False)
    property_tax_url = Column(String, nullable=True)
    hoa_annual = Column(Numeric(9, 2), nullable=False)
    property_management_annual = Column(Numeric(9, 2), nullable=False)
    vacancy_days_annual = Column(Integer, nullable=False)
    maintenance_annual = Column(Numeric(9, 2), nullable=False)
    insurance_annual = Column(Numeric(9, 2), nullable=False)

    # Year-over-year adjustments
    rent_increase_pct = Column(Numeric(5, 1), nullable=False)
    maintenance_increase_pct = Column(Numeric(5, 1), nullable=False)
    appreciation_rate_pct = Column(Numeric(5, 1), nullable=False)
    property_tax_increase_pct = Column(Numeric(5, 1), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="properties")
