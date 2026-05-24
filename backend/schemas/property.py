from decimal import Decimal
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator


class PropertyCreate(BaseModel):
    # House information
    mls_id: Optional[str] = None
    source_url: Optional[str] = None
    address_street: str
    address_city: str
    address_state: str
    address_zip: str
    property_type: Literal["single_family", "multi_family", "condo", "townhouse"]
    bedrooms: Optional[int] = Field(default=None, ge=1, le=20)
    bathrooms: Optional[int] = Field(default=None, ge=1, le=20)
    garage: Optional[Literal["none", "1", "2", "3", "4", "carport"]] = None
    square_feet: Optional[int] = Field(default=None, ge=1, le=99999)

    # Acquisition
    purchase_price: Decimal = Field(ge=Decimal("0.01"), le=Decimal("9999999.99"))
    annual_interest_rate: Decimal = Field(ge=Decimal("0.01"), le=Decimal("25.00"))
    mortgage_term: Literal[10, 15, 20, 30]
    down_payment: Decimal = Field(ge=Decimal("0.00"), le=Decimal("100.00"))
    closing_costs: Decimal = Field(ge=Decimal("0.00"), le=Decimal("9999999.99"))
    initial_repairs: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("999999.99"))
    pmi_monthly: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("9999.99"))

    # Property management
    rent_lower: Decimal = Field(ge=Decimal("0.00"), le=Decimal("99999.99"))
    rent_upper: Decimal = Field(ge=Decimal("0.00"), le=Decimal("99999.99"))
    property_tax_annual: Decimal = Field(ge=Decimal("0.00"), le=Decimal("999999.99"))
    property_tax_url: Optional[str] = None
    hoa_annual: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("99999.99"))
    property_management_annual: Decimal = Field(ge=Decimal("0.00"), le=Decimal("99999.99"))
    vacancy_days_annual: int = Field(ge=0, le=364)
    maintenance_annual: Decimal = Field(ge=Decimal("0.00"), le=Decimal("99999.99"))
    insurance_annual: Decimal = Field(ge=Decimal("0.00"), le=Decimal("99999.99"))

    # Year-over-year adjustments
    rent_increase_pct: Decimal = Field(ge=Decimal("0.0"), le=Decimal("100.0"))
    maintenance_increase_pct: Decimal = Field(ge=Decimal("0.0"), le=Decimal("100.0"))
    appreciation_rate_pct: Decimal = Field(ge=Decimal("0.0"), le=Decimal("100.0"))
    property_tax_increase_pct: Decimal = Field(ge=Decimal("0.0"), le=Decimal("100.0"))
    insurance_increase_pct: Decimal = Field(ge=Decimal("0.0"), le=Decimal("100.0"))

    @model_validator(mode="after")
    def validate_cross_fields(self):
        if self.rent_upper < self.rent_lower:
            raise ValueError("rent_upper must be greater than or equal to rent_lower")
        return self


class PropertyOut(BaseModel):
    id: int
    mls_id: Optional[str]
    source_url: Optional[str]
    address_street: str
    address_city: str
    address_state: str
    address_zip: str
    property_type: str
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    garage: Optional[str]
    square_feet: Optional[int]
    purchase_price: float
    annual_interest_rate: float
    mortgage_term: int
    down_payment: float
    closing_costs: float
    initial_repairs: Optional[float]
    pmi_monthly: Optional[float]
    rent_lower: float
    rent_upper: float
    property_tax_annual: float
    property_tax_url: Optional[str]
    hoa_annual: Optional[float]
    property_management_annual: float
    vacancy_days_annual: int
    maintenance_annual: float
    insurance_annual: float
    rent_increase_pct: float
    maintenance_increase_pct: float
    appreciation_rate_pct: float
    property_tax_increase_pct: float
    insurance_increase_pct: float
    created_at: datetime

    model_config = {"from_attributes": True}
