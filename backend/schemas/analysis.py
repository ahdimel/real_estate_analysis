from pydantic import BaseModel
from typing import Optional


class YearProjectionOut(BaseModel):
    year: int
    gross_rent: float
    effective_rent: float
    mortgage_payment: float
    property_tax: float
    hoa: float
    management: float
    maintenance: float
    insurance: float
    pmi: float
    total_expenses: float
    net_cash_flow: float
    cumulative_cash_flow: float
    property_value: float
    loan_balance: float
    equity: float
    equity_gain: float
    re_value: float
    cumulative_roi_pct: float
    stock_value: float


class ScenarioSummaryOut(BaseModel):
    monthly_cash_flow_y1: float
    annual_cash_flow_y1: float
    coc_return: float
    break_even_year: Optional[int]


class AnalysisResponseOut(BaseModel):
    property_id: int
    initial_investment: float
    loan_amount: float
    monthly_mortgage: float
    cap_rate_mid: float
    grm_mid: float
    voo_cagr_pct: float
    voo_label: str
    summary_low: ScenarioSummaryOut
    summary_mid: ScenarioSummaryOut
    summary_high: ScenarioSummaryOut
    projections_low: list[YearProjectionOut]
    projections_mid: list[YearProjectionOut]
    projections_high: list[YearProjectionOut]
