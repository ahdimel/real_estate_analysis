from dataclasses import dataclass
from typing import Optional


@dataclass
class YearProjection:
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
    re_value: float            # total equity + cumulative cash flow (net proceeds if sold today)
    cumulative_roi_pct: float  # (re_value - initial_investment) / initial_investment × 100
    stock_value: float         # same initial capital compounded at S&P 500 CAGR


@dataclass
class ScenarioSummary:
    monthly_cash_flow_y1: float
    annual_cash_flow_y1: float
    coc_return: float
    break_even_year: Optional[int]


@dataclass
class AnalysisResult:
    property_id: int
    initial_investment: float
    loan_amount: float
    monthly_mortgage: float
    cap_rate_mid: float
    grm_mid: float
    market_cagr_pct: float
    market_label: str
    summary_low: ScenarioSummary
    summary_mid: ScenarioSummary
    summary_high: ScenarioSummary
    projections_low: list[YearProjection]
    projections_mid: list[YearProjection]
    projections_high: list[YearProjection]


def monthly_mortgage_payment(loan_amount: float, annual_rate_pct: float, term_years: int) -> float:
    """Standard fixed-rate amortization formula."""
    r = annual_rate_pct / 100 / 12
    n = term_years * 12
    if r == 0:
        return loan_amount / n if n > 0 else 0.0
    return loan_amount * (r * (1 + r) ** n) / ((1 + r) ** n - 1)


def remaining_loan_balance(loan_amount: float, annual_rate_pct: float, term_years: int, years_paid: int) -> float:
    """Remaining principal after years_paid full years of payments."""
    r = annual_rate_pct / 100 / 12
    n = term_years * 12
    k = years_paid * 12
    if k >= n:
        return 0.0
    if r == 0:
        return max(0.0, loan_amount - (loan_amount / n) * k)
    return loan_amount * ((1 + r) ** n - (1 + r) ** k) / ((1 + r) ** n - 1)


def _project_scenario(
    starting_monthly_rent: float,
    loan_amount: float,
    monthly_mortgage: float,
    purchase_price: float,
    annual_interest_rate: float,
    mortgage_term: int,
    property_tax_annual: float,
    hoa_annual: float,
    property_management_annual: float,
    vacancy_days_annual: int,
    maintenance_annual: float,
    insurance_annual: float,
    pmi_monthly: float,
    rent_increase_pct: float,
    maintenance_increase_pct: float,
    insurance_increase_pct: float,
    appreciation_rate_pct: float,
    property_tax_increase_pct: float,
    initial_investment: float,
    initial_equity: float,
    market_cagr: float,
    horizon_years: int = 30,
) -> list[YearProjection]:
    projections: list[YearProjection] = []
    cumulative_cash_flow = 0.0
    annual_mortgage = monthly_mortgage * 12

    for year in range(1, horizon_years + 1):
        g = year - 1  # growth multiplier: year 1 uses starting values

        gross_rent = starting_monthly_rent * 12 * (1 + rent_increase_pct / 100) ** g
        effective_rent = gross_rent * (1 - vacancy_days_annual / 365)
        property_tax = property_tax_annual * (1 + property_tax_increase_pct / 100) ** g
        maintenance = maintenance_annual * (1 + maintenance_increase_pct / 100) ** g
        hoa = hoa_annual
        management = property_management_annual
        insurance = insurance_annual * (1 + insurance_increase_pct / 100) ** g
        loan_balance = remaining_loan_balance(loan_amount, annual_interest_rate, mortgage_term, year)
        # PMI drops off once principal paydown brings LTV below 80% of original purchase price
        pmi = pmi_monthly * 12 if loan_balance > 0.80 * purchase_price else 0.0

        total_expenses = annual_mortgage + property_tax + hoa + management + maintenance + insurance + pmi
        net_cash_flow = effective_rent - total_expenses
        cumulative_cash_flow += net_cash_flow

        property_value = purchase_price * (1 + appreciation_rate_pct / 100) ** year
        equity = property_value - loan_balance
        equity_gain = equity - initial_equity

        # Total net proceeds if sold today: full equity position + all cash flows received
        re_value = equity + cumulative_cash_flow
        # Gain as % of initial outlay: 0% = breakeven, negative = behind, positive = ahead
        cumulative_roi_pct = (re_value - initial_investment) / initial_investment * 100 if initial_investment > 0 else 0.0
        # Total stock portfolio value: same initial capital compounded at S&P 500 CAGR
        stock_value = initial_investment * (1 + market_cagr) ** year

        projections.append(YearProjection(
            year=year,
            gross_rent=round(gross_rent, 2),
            effective_rent=round(effective_rent, 2),
            mortgage_payment=round(annual_mortgage, 2),
            property_tax=round(property_tax, 2),
            hoa=round(hoa, 2),
            management=round(management, 2),
            maintenance=round(maintenance, 2),
            insurance=round(insurance, 2),
            pmi=round(pmi, 2),
            total_expenses=round(total_expenses, 2),
            net_cash_flow=round(net_cash_flow, 2),
            cumulative_cash_flow=round(cumulative_cash_flow, 2),
            property_value=round(property_value, 2),
            loan_balance=round(loan_balance, 2),
            equity=round(equity, 2),
            equity_gain=round(equity_gain, 2),
            re_value=round(re_value, 2),
            cumulative_roi_pct=round(cumulative_roi_pct, 2),
            stock_value=round(stock_value, 2),
        ))

    return projections


def _scenario_summary(projections: list[YearProjection], initial_investment: float) -> ScenarioSummary:
    y1 = projections[0]
    coc = y1.net_cash_flow / initial_investment * 100 if initial_investment > 0 else 0.0
    break_even = next((p.year for p in projections if p.cumulative_cash_flow >= 0), None)
    return ScenarioSummary(
        monthly_cash_flow_y1=round(y1.net_cash_flow / 12, 2),
        annual_cash_flow_y1=round(y1.net_cash_flow, 2),
        coc_return=round(coc, 2),
        break_even_year=break_even,
    )


def analyse_rental(
    prop,
    db,
    _test_market: tuple[float, str] | None = None,
) -> AnalysisResult:
    """
    _test_market: pass a (cagr_decimal, label) tuple in tests to skip DB/network.
    """
    from backend.analysis.market import get_market_cagr

    purchase_price = float(prop.purchase_price)
    down_pct = float(prop.down_payment)
    annual_rate = float(prop.annual_interest_rate)
    term = int(prop.mortgage_term)

    down_amount = purchase_price * down_pct / 100
    loan_amount = purchase_price - down_amount
    initial_equity = down_amount
    initial_investment = down_amount + float(prop.closing_costs) + float(prop.initial_repairs or 0)

    monthly_mortgage = monthly_mortgage_payment(loan_amount, annual_rate, term)

    rent_low = float(prop.rent_lower)
    rent_high = float(prop.rent_upper)
    rent_mid = (rent_low + rent_high) / 2

    market_cagr, market_label = _test_market if _test_market else get_market_cagr(db)

    common = dict(
        loan_amount=loan_amount,
        monthly_mortgage=monthly_mortgage,
        purchase_price=purchase_price,
        annual_interest_rate=annual_rate,
        mortgage_term=term,
        property_tax_annual=float(prop.property_tax_annual),
        hoa_annual=float(prop.hoa_annual or 0),
        property_management_annual=float(prop.property_management_annual),
        vacancy_days_annual=int(prop.vacancy_days_annual),
        maintenance_annual=float(prop.maintenance_annual),
        insurance_annual=float(prop.insurance_annual),
        pmi_monthly=float(prop.pmi_monthly or 0),
        rent_increase_pct=float(prop.rent_increase_pct),
        maintenance_increase_pct=float(prop.maintenance_increase_pct),
        insurance_increase_pct=float(prop.insurance_increase_pct),
        appreciation_rate_pct=float(prop.appreciation_rate_pct),
        property_tax_increase_pct=float(prop.property_tax_increase_pct),
        initial_investment=initial_investment,
        initial_equity=initial_equity,
        market_cagr=market_cagr,
    )

    proj_low = _project_scenario(starting_monthly_rent=rent_low, **common)
    proj_mid = _project_scenario(starting_monthly_rent=rent_mid, **common)
    proj_high = _project_scenario(starting_monthly_rent=rent_high, **common)

    # Cap rate and GRM use midpoint rent at year 1 (no growth yet)
    y1_mid = proj_mid[0]
    noi_mid = (y1_mid.effective_rent - y1_mid.property_tax - y1_mid.hoa
               - y1_mid.management - y1_mid.maintenance - y1_mid.insurance)
    cap_rate_mid = noi_mid / purchase_price * 100 if purchase_price > 0 else 0.0
    grm_mid = purchase_price / (rent_mid * 12) if rent_mid > 0 else 0.0

    return AnalysisResult(
        property_id=prop.id,
        initial_investment=round(initial_investment, 2),
        loan_amount=round(loan_amount, 2),
        monthly_mortgage=round(monthly_mortgage, 2),
        cap_rate_mid=round(cap_rate_mid, 2),
        grm_mid=round(grm_mid, 2),
        market_cagr_pct=round(market_cagr * 100, 2),
        market_label=market_label,
        summary_low=_scenario_summary(proj_low, initial_investment),
        summary_mid=_scenario_summary(proj_mid, initial_investment),
        summary_high=_scenario_summary(proj_high, initial_investment),
        projections_low=proj_low,
        projections_mid=proj_mid,
        projections_high=proj_high,
    )
