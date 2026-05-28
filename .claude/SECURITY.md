# Security Findings — REI Analyzer

Analysis performed 2026-05-28. Findings are from a user/bad-actor perspective (authenticated and unauthenticated).
Status column is updated as issues are resolved.

---

## Critical

### C1 — SSRF via Zillow scraper endpoint
**File:** `backend/routes/scraper.py:12`, `backend/scraper/zillow.py:47`
**Status:** ✅ Fixed

`POST /scraper/zillow` accepts an arbitrary `url` string and fetches it with zero validation.
Any authenticated user can point this at internal targets:
- `http://169.254.169.254/latest/meta-data/` — cloud instance metadata
- `http://postgres.railway.internal:5432/` — Railway internal DB
- `http://localhost:8000/` — loopback / self-referential
- Any RFC-1918 address on Railway's private network

**Fix:** Validate the URL is a `https://www.zillow.com/` or `https://zillow.com/` URL before fetching.

---

### C2 — PRNG used for verification code generation
**File:** `backend/routes/auth.py:27`
**Status:** ✅ Fixed

```python
def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))
```

`random` is Python's Mersenne Twister — not a CSPRNG. Observing enough outputs allows
state reconstruction, making future codes predictable.

**Fix:** Use `secrets.choice(string.digits)` instead.

---

### C3 — Verification code brute-forceable (no rate limit on `/auth/verify`)
**File:** `backend/routes/auth.py:68`
**Status:** ✅ Fixed

6-digit code space = 1,000,000 possibilities, 15-minute TTL, zero attempt counter or throttle.
An attacker who knows a target's email can enumerate all codes within the window and obtain
a JWT for the victim's account without ever receiving the email.

**Fix:** Add slowapi rate limiting (e.g. 10 req/min per IP) to `POST /auth/verify`.
Also add limits to `POST /auth/login` and `POST /auth/register` as defense-in-depth.

---

## High

### H1 — No rate limiting on `/auth/login` — credential brute force
**File:** `backend/routes/auth.py:166`
**Status:** ✅ Fixed (addressed alongside C3)

No lockout, CAPTCHA, or throttle. Attacker can try unlimited passwords against any known username.
Combined with username enumeration (M1), targeting a specific account is trivial.

---

### H2 — Race condition on credit gate (TOCTOU)
**File:** `backend/routes/reports.py:39-45`
**Status:** 🔴 Open

Read → check → write is not atomic under PostgreSQL. Concurrent POST requests can both pass
the `count >= limit` check before either commits, allowing a user to exceed their plan limit.
SQLite serializes writes so this only affects production.

**Fix:** Use `SELECT ... FOR UPDATE` or a DB-level unique constraint + retry to serialize the check.

---

### H3 — Password reset does not invalidate existing JWTs
**File:** `backend/routes/auth.py:153`, `backend/security.py:23`
**Status:** 🔴 Open

After a password reset, all previously issued tokens remain valid until their 30-minute TTL.
An attacker with a stolen token retains access for up to 30 minutes post-reset.

**Fix:** Add a `token_version` (int) column to `users`. Increment on password change.
Encode version in JWT payload; `get_current_user` rejects tokens with a stale version.

---

### H4 — `/auth/refresh` allows indefinite extension of stolen tokens
**File:** `backend/routes/auth.py:160`
**Status:** 🔴 Open

Any valid, non-expired token can be refreshed for a new 30-minute token with no additional
proof. A stolen token can be kept alive forever until the operator rotates `SECRET_KEY`.

**Fix:** Implement refresh token rotation — issue an opaque refresh token (stored in DB,
`HttpOnly` cookie) alongside the short-lived access token. Invalidate refresh tokens on
password change or explicit logout.

---

### H5 — No rate limiting on `/scraper/zillow` — ScraperAPI cost amplification
**File:** `backend/routes/scraper.py`
**Status:** ✅ Fixed (addressed alongside C3)

An authenticated user can hammer the scraper with unique Zillow URLs, running up the
operator's ScraperAPI bill. No per-user or global throttle.

---

## Medium

### M1 — Username and email enumeration at registration
**File:** `backend/routes/auth.py:33-36`
**Status:** 🔴 Open

Distinct error messages (`"Username already taken"` vs `"Email already registered"`) let an
attacker enumerate valid usernames and registered emails.

**Fix:** Return a single generic message: `"Username or email already in use."` for both cases.

---

### M2 — JWT stored in `localStorage` — full XSS exposure
**File:** `frontend/context/AuthContext.tsx:31`
**Status:** 🔴 Open (known design decision)

`localStorage` is readable by any JavaScript on the page. A single XSS vector exfiltrates
tokens for all logged-in users. `HttpOnly` cookies are the standard mitigation.

---

### M3 — Internal error messages leak to clients
**File:** `backend/routes/scraper.py:19`
**Status:** 🔴 Open

```python
raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")
```

Raw exception strings are returned, potentially exposing internal paths, library versions,
or network topology.

**Fix:** Log the full exception server-side; return a generic message to the client.

---

### M4 — Empty `SECRET_KEY` produces forgeable JWTs in local dev
**File:** `backend/security.py:10`
**Status:** 🔴 Open

`SECRET_KEY = os.getenv("SECRET_KEY", "")` defaults to empty string. The startup check only
fires when `RAILWAY_ENVIRONMENT` is set, so local dev with a missing `.env` runs with an
empty signing key — anyone can forge tokens for any user ID.

**Fix:** Add `SECRET_KEY` to the startup guard unconditionally (not gated on `RAILWAY_ENVIRONMENT`).
Or assert `len(SECRET_KEY) >= 32` at startup.

---

### M5 — `source_url` and `property_tax_url` lack URL validation (XSS-adjacent)
**File:** `backend/schemas/property.py:10`
**Status:** 🔴 Open

Both are `Optional[str]` with no format check. A `javascript:` URI would execute as XSS if
rendered as an `href` without sanitization.

**Fix:** Validate with `pydantic.AnyHttpUrl` or an `http/https` scheme check.

---

## Low / Informational

### L1 — `/market/rate` and `/market/mortgage-rate` unauthenticated
**File:** `backend/routes/market.py`
**Status:** 🔴 Open (low priority)

These endpoints are publicly accessible and can be polled to probe DB liveness.

---

### L2 — OpenAPI docs publicly accessible in production
**Status:** 🔴 Open

FastAPI's Swagger UI (`/docs`) and OpenAPI schema (`/openapi.json`) are enabled in production
with no authentication gate.

**Fix:** Add `docs_url=None, redoc_url=None, openapi_url=None` to `FastAPI()` in production,
or gate via an env flag.

---

### L3 — Username has no length or character constraints
**File:** `backend/schemas/user.py:5`
**Status:** 🔴 Open

`username: str` — no `max_length`, no character allowlist. Could cause rendering issues
or DB index bloat with very long inputs.

**Fix:** `username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")`

---

### L4 — ScraperAPI key passed as a URL query parameter
**File:** `backend/scraper/zillow.py:55-58`
**Status:** 🔴 Open

The API key appears in the request URL and will be captured by proxy logs, Railway request
logs, and ScraperAPI's own access logs.

**Fix:** Pass as `Authorization: Bearer` header or `X-API-Key` header instead.

---

### L5 — Freddie Mac CSV parsing is fragile; stale fallback rate not disclosed
**File:** `backend/analysis/mortgage_rate.py:44`
**Status:** 🔴 Open

CSV column parsing (`last.split(",")[1]`) is brittle. On failure, a hardcoded 6.51% rate
is silently used and presented as current data — potentially misleading investment decisions.

**Fix:** Surface a `data_source` / `is_stale` flag in the API response so the frontend can
warn the user when fallback data is in use.

---

## Resolved

| ID | Finding | Fixed in |
|----|---------|----------|
| C1 | SSRF via scraper URL | 2026-05-28 |
| C2 | PRNG for verification codes | 2026-05-28 |
| C3 | Verify code brute-force | 2026-05-28 |
| H1 | Login brute force | 2026-05-28 |
| H5 | Scraper cost amplification | 2026-05-28 |
