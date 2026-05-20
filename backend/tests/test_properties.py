REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
PROPS_URL = "/properties"

USER = {"username": "alice", "email": "alice@example.com", "password": "password1"}

VALID_PROPERTY = {
    "address_street": "123 Main St",
    "address_city": "Austin",
    "address_state": "TX",
    "address_zip": "78701",
    "property_type": "single_family",
    "bedrooms": 3,
    "bathrooms": 2,
    "garage": "2",
    "year_built": 2005,
    "square_feet": 1800,
    "purchase_price": 450000.00,
    "annual_interest_rate": 6.75,
    "mortgage_term": 30,
    "down_payment": 20.00,       # percentage: 20%
    "closing_costs": 9000.00,
    "rent_lower": 2200.00,
    "rent_upper": 2500.00,
    "property_tax_annual": 7200.00,
    "hoa_annual": 0.00,
    "property_management_annual": 3000.00,
    "vacancy_days_annual": 18,
    "maintenance_annual": 2500.00,
    "insurance_annual": 1800.00,
    "rent_increase_pct": 3.0,
    "maintenance_increase_pct": 2.5,
    "appreciation_rate_pct": 4.0,
    "property_tax_increase_pct": 2.0,
}


def _register_and_login(client):
    client.post(REGISTER_URL, json=USER)
    res = client.post(LOGIN_URL, json={"username": USER["username"], "password": USER["password"]})
    return res.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- CRUD ---

def test_create_property(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token))
    assert res.status_code == 201
    data = res.json()
    assert data["address_street"] == "123 Main St"
    assert data["purchase_price"] == 450000.0
    assert data["down_payment"] == 20.0
    assert "id" in data


def test_list_properties(client):
    token = _register_and_login(client)
    client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token))
    client.post(PROPS_URL, json={**VALID_PROPERTY, "address_street": "456 Oak Ave"}, headers=auth_headers(token))
    res = client.get(PROPS_URL, headers=auth_headers(token))
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_only_returns_own_properties(client):
    token_a = _register_and_login(client)
    client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token_a))

    client.post(REGISTER_URL, json={"username": "bob", "email": "bob@example.com", "password": "password2"})
    token_b = client.post(LOGIN_URL, json={"username": "bob", "password": "password2"}).json()["access_token"]
    client.post(PROPS_URL, json={**VALID_PROPERTY, "address_street": "999 Other St"}, headers=auth_headers(token_b))

    res = client.get(PROPS_URL, headers=auth_headers(token_a))
    assert len(res.json()) == 1
    assert res.json()[0]["address_street"] == "123 Main St"


def test_get_property(client):
    token = _register_and_login(client)
    created = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    res = client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


def test_get_nonexistent_property_returns_404(client):
    token = _register_and_login(client)
    res = client.get(f"{PROPS_URL}/99999", headers=auth_headers(token))
    assert res.status_code == 404


def test_update_property(client):
    token = _register_and_login(client)
    created = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    updated = {**VALID_PROPERTY, "address_street": "999 New Rd", "purchase_price": 500000.00}
    res = client.put(f"{PROPS_URL}/{created['id']}", json=updated, headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["address_street"] == "999 New Rd"
    assert res.json()["purchase_price"] == 500000.0


def test_delete_property(client):
    token = _register_and_login(client)
    created = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token)).json()
    res = client.delete(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token))
    assert res.status_code == 204
    res = client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token))
    assert res.status_code == 404


def test_delete_nonexistent_property_returns_404(client):
    token = _register_and_login(client)
    res = client.delete(f"{PROPS_URL}/99999", headers=auth_headers(token))
    assert res.status_code == 404


# --- Auth / ownership ---

def test_unauthenticated_request_rejected(client):
    res = client.get(PROPS_URL)
    assert res.status_code in (401, 403)


def test_cannot_access_other_users_property(client):
    token_a = _register_and_login(client)
    created = client.post(PROPS_URL, json=VALID_PROPERTY, headers=auth_headers(token_a)).json()

    client.post(REGISTER_URL, json={"username": "bob", "email": "bob@example.com", "password": "password2"})
    token_b = client.post(LOGIN_URL, json={"username": "bob", "password": "password2"}).json()["access_token"]

    assert client.get(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token_b)).status_code == 404
    assert client.put(f"{PROPS_URL}/{created['id']}", json=VALID_PROPERTY, headers=auth_headers(token_b)).status_code == 404
    assert client.delete(f"{PROPS_URL}/{created['id']}", headers=auth_headers(token_b)).status_code == 404


# --- Field validation ---

def test_down_payment_over_100_rejected(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "down_payment": 101.0}, headers=auth_headers(token))
    assert res.status_code == 422


def test_down_payment_100_percent_accepted(client):
    # Cash purchase: 100% down is valid
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "down_payment": 100.0}, headers=auth_headers(token))
    assert res.status_code == 201


def test_property_limit_enforced(client):
    token = _register_and_login(client)
    for i in range(10):
        res = client.post(PROPS_URL, json={**VALID_PROPERTY, "address_street": f"{i} Main St"}, headers=auth_headers(token))
        assert res.status_code == 201
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "address_street": "11 Over St"}, headers=auth_headers(token))
    assert res.status_code == 400
    assert "limit" in res.json()["detail"].lower()


def test_invalid_rent_range(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "rent_lower": 3000.00, "rent_upper": 2000.00}, headers=auth_headers(token))
    assert res.status_code == 422


def test_equal_rent_bounds_accepted(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "rent_lower": 2500.00, "rent_upper": 2500.00}, headers=auth_headers(token))
    assert res.status_code == 201


def test_bedrooms_out_of_range_rejected(client):
    token = _register_and_login(client)
    assert client.post(PROPS_URL, json={**VALID_PROPERTY, "bedrooms": 0}, headers=auth_headers(token)).status_code == 422
    assert client.post(PROPS_URL, json={**VALID_PROPERTY, "bedrooms": 21}, headers=auth_headers(token)).status_code == 422


def test_mortgage_term_zero_rejected(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "mortgage_term": 0}, headers=auth_headers(token))
    assert res.status_code == 422


def test_invalid_property_type_rejected(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "property_type": "castle"}, headers=auth_headers(token))
    assert res.status_code == 422


def test_invalid_garage_value_rejected(client):
    token = _register_and_login(client)
    res = client.post(PROPS_URL, json={**VALID_PROPERTY, "garage": "5"}, headers=auth_headers(token))
    assert res.status_code == 422
