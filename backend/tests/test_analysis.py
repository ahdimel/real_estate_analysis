from backend.analysis.rental import monthly_mortgage_payment, remaining_loan_balance, analyse_rental

# --- Unit tests for math functions ---

def test_monthly_mortgage_known_value():
    # $360,000 loan, 6.75% annual, 30 years → $2,334.95
    payment = monthly_mortgage_payment(360_000, 6.75, 30)
    assert abs(payment - 2334.95) < 0.10


def test_monthly_mortgage_zero_rate():
    payment = monthly_mortgage_payment(120_000, 0.0, 10)
    assert abs(payment - 1000.0) < 0.01


def test_remaining_balance_at_term_end():
    balance = remaining_loan_balance(200_000, 5.0, 30, 30)
    assert balance == 0.0


def test_remaining_balance_at_zero_years():
    balance = remaining_loan_balance(200_000, 5.0, 30, 0)
    assert abs(balance - 200_000) < 0.01


def test_remaining_balance_decreases_over_time():
    balances = [remaining_loan_balance(300_000, 7.0, 30, y) for y in range(1, 31)]
    assert all(balances[i] > balances[i + 1] for i in range(len(balances) - 1))


def test_remaining_balance_zero_rate():
    balance = remaining_loan_balance(120_000, 0.0, 10, 5)
    assert abs(balance - 60_000) < 0.01


# --- Integration tests using a fake property object ---

class FakeProp:
    id = 1
    purchase_price = 450_000
    down_payment = 20          # 20%
    annual_interest_rate = 6.75
    mortgage_term = 30
    closing_costs = 9_000
    pmi_monthly = None
    rent_lower = 2_200
    rent_upper = 2_500
    property_tax_annual = 7_200
    hoa_annual = 0
    property_management_annual = 3_000
    vacancy_days_annual = 18
    maintenance_annual = 2_500
    insurance_annual = 1_800
    rent_increase_pct = 3.0
    maintenance_increase_pct = 2.5
    appreciation_rate_pct = 4.0
    property_tax_increase_pct = 2.0


def test_analyse_rental_returns_30_years():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert len(result.projections_low) == 30
    assert len(result.projections_mid) == 30
    assert len(result.projections_high) == 30


def test_initial_investment_calculation():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    expected = 450_000 * 0.20 + 9_000  # $90,000 + $9,000
    assert abs(result.initial_investment - expected) < 0.01


def test_loan_amount_calculation():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert abs(result.loan_amount - 360_000) < 0.01


def test_monthly_mortgage_in_result():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert abs(result.monthly_mortgage - 2334.95) < 0.10


def test_high_rent_always_better_than_low():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert result.summary_high.annual_cash_flow_y1 > result.summary_low.annual_cash_flow_y1
    assert result.summary_high.coc_return > result.summary_low.coc_return


def test_mid_scenario_between_low_and_high():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert result.summary_low.annual_cash_flow_y1 < result.summary_mid.annual_cash_flow_y1 < result.summary_high.annual_cash_flow_y1


def test_equity_increases_over_time():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    equities = [p.equity for p in result.projections_mid]
    assert all(equities[i] < equities[i + 1] for i in range(len(equities) - 1))


def test_loan_balance_decreases_over_time():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    balances = [p.loan_balance for p in result.projections_mid]
    assert all(balances[i] > balances[i + 1] for i in range(len(balances) - 1))


def test_loan_balance_reaches_zero_at_year_30():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert result.projections_mid[-1].loan_balance < 1.0


def test_re_value_and_roi_increase_over_time():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    values = [p.re_value for p in result.projections_mid]
    rois = [p.cumulative_roi_pct for p in result.projections_mid]
    assert values[-1] > values[0]
    assert rois[-1] > rois[0]


def test_stock_value_increases_over_time():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    stock_vals = [p.stock_value for p in result.projections_mid]
    assert all(stock_vals[i] < stock_vals[i + 1] for i in range(len(stock_vals) - 1))


def test_grm_is_reasonable():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    # GRM = purchase_price / annual_rent_mid = 450000 / (2350*12) ≈ 15.96
    assert 10 < result.grm_mid < 25


def test_cap_rate_is_positive():
    result = analyse_rental(FakeProp(), db=None, _test_voo=(0.105, "test"))
    assert result.cap_rate_mid > 0


# --- API endpoint tests ---

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
PROPS_URL = "/properties"
USER = {"username": "alice", "email": "alice@example.com", "password": "password1"}

VALID_PROPERTY = {
    "address_street": "123 Main St", "address_city": "Austin",
    "address_state": "TX", "address_zip": "78701",
    "property_type": "single_family", "bedrooms": 3, "bathrooms": 2,
    "garage": "2", "year_built": 2005, "square_feet": 1800,
    "purchase_price": 450000.00, "annual_interest_rate": 6.75,
    "mortgage_term": 30, "down_payment": 20.00, "closing_costs": 9000.00,
    "rent_lower": 2200.00, "rent_upper": 2500.00,
    "property_tax_annual": 7200.00, "hoa_annual": 0.00,
    "property_management_annual": 3000.00, "vacancy_days_annual": 18,
    "maintenance_annual": 2500.00, "insurance_annual": 1800.00,
    "rent_increase_pct": 3.0, "maintenance_increase_pct": 2.5,
    "appreciation_rate_pct": 4.0, "property_tax_increase_pct": 2.0,
}


def _login(client):
    client.post(REGISTER_URL, json=USER)
    return client.post(LOGIN_URL, json={"username": "alice", "password": "password1"}).json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_analysis_endpoint_returns_200(client):
    token = _login(client)
    prop = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    res = client.get(f"{PROPS_URL}/{prop['id']}/analysis", headers=auth_headers(token))
    assert res.status_code == 200


def test_analysis_response_structure(client):
    token = _login(client)
    prop = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    data = client.get(f"{PROPS_URL}/{prop['id']}/analysis", headers=auth_headers(token)).json()
    assert "summary_low" in data
    assert "summary_mid" in data
    assert "summary_high" in data
    assert len(data["projections_mid"]) == 30


def test_analysis_unauthenticated_rejected(client):
    token = _login(client)
    prop = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    res = client.get(f"{PROPS_URL}/{prop['id']}/analysis")
    assert res.status_code in (401, 403)


def test_analysis_other_users_property_rejected(client):
    token_a = _login(client)
    prop = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token_a)).json()

    client.post(REGISTER_URL, json={"username": "bob", "email": "bob@example.com", "password": "password2"})
    token_b = client.post(LOGIN_URL, json={"username": "bob", "password": "password2"}).json()["access_token"]
    res = client.get(f"{PROPS_URL}/{prop['id']}/analysis", headers=auth_headers(token_b))
    assert res.status_code == 404
