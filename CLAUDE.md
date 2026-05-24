# REI Analyzer — CLAUDE.md

## Project Overview

Full-stack real estate investment analysis web app. Users register, save rental properties, and get a 30-year deterministic cash flow projection compared against an S&P 500 baseline.

**Live URLs**
- Frontend: https://reianalyzer.online (also https://frontend-production-45bb.up.railway.app)
- Backend: https://backend-production-8eb7.up.railway.app

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy, Pydantic v2 |
| Database | SQLite (local dev), PostgreSQL (Railway prod) |
| Auth | JWT (python-jose), bcrypt (direct — no passlib) |
| Email | Resend API |
| Scraping | curl_cffi (local dev), ScraperAPI (prod) |
| Frontend | Next.js 16 (App Router), Tailwind CSS v4, Recharts |
| Hosting | Railway (two services: backend + frontend, one PostgreSQL addon) |

---

## Repository Layout

```
REI/
├── Procfile                        # web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT  ← BACKEND only
├── railway.toml                    # BACKEND: startCommand + healthcheckPath="/health"
├── requirements.txt                # root copy of backend/requirements.txt (Railway needs it here)
├── .python-version                 # 3.13
├── .env                            # local secrets — never commit
├── backend/
│   ├── main.py                     # FastAPI app, CORS, router registration
│   ├── database.py                 # SQLAlchemy engine + session; auto-detects SQLite vs PostgreSQL
│   ├── security.py                 # create_access_token, hash_password, verify_password
│   ├── dependencies.py             # get_current_user (JWT decode → User)
│   ├── email.py                    # send_verification_email via Resend
│   ├── models/
│   │   ├── __init__.py             # exports User, Property, AppSetting, EmailVerification
│   │   ├── user.py                 # User table (id, username, email, hashed_password, is_verified)
│   │   ├── property.py             # Property table (all intake fields)
│   │   ├── email_verification.py   # Pending registrations (email unique, expires_at)
│   │   └── settings.py             # AppSetting key/value table — stores market CAGR
│   ├── schemas/
│   │   ├── __init__.py             # (empty)
│   │   ├── user.py                 # UserRegister, UserLogin, UserOut, Token, VerifyCode
│   │   ├── property.py             # PropertyCreate, PropertyUpdate, PropertyOut
│   │   └── analysis.py             # YearProjectionOut, AnalysisResultOut, ScenarioSummaryOut
│   ├── routes/
│   │   ├── auth.py                 # POST /auth/register, /auth/verify, /auth/login
│   │   ├── properties.py           # CRUD /properties — user-scoped, 10-property cap
│   │   ├── analysis.py             # GET /properties/{id}/analysis
│   │   ├── market.py               # GET /market/rate, POST /market/rate/refresh, GET /market/mortgage-rate
│   │   └── scraper.py              # POST /scraper/zillow
│   ├── analysis/
│   │   ├── rental.py               # Core engine: analyse_rental() → AnalysisResult
│   │   ├── market.py               # get_market_cagr(db): fetches ^GSPC 50yr CAGR, caches in DB
│   │   └── mortgage_rate.py        # get_mortgage_rate(db): fetches Freddie Mac 30yr rate, caches 7 days
│   ├── scraper/
│   │   └── zillow.py               # scrape_zillow(url) → form-field dict
│   └── tests/
│       ├── conftest.py             # pytest fixtures: file-based SQLite + TestClient (NOT in-memory)
│       ├── test_auth.py            # Registration, verification, login flows
│       ├── test_properties.py      # CRUD + ownership isolation
│       ├── test_analysis.py        # Analysis math unit tests + full API flow
│       └── test_market.py          # Market rate endpoint + caching behaviour
└── frontend/
    ├── railway.toml                # FRONTEND: startCommand="node_modules/.bin/next start -p $PORT"
    ├── .env.local                  # NEXT_PUBLIC_API_URL=http://localhost:8000 (local only)
    ├── lib/api.ts                  # API_BASE + apiFetch() helper (see Auth section below)
    ├── context/AuthContext.tsx     # AuthProvider + useAuth() hook
    ├── components/
    │   └── PropertyForm.tsx        # Shared intake form with Zillow scrape button + tooltips
    └── app/
        ├── layout.tsx              # Root layout — wraps everything in <AuthProvider>
        ├── page.tsx                # Landing: Sign in / Create account buttons
        ├── login/page.tsx          # Login form
        ├── register/page.tsx       # Two-step registration (form → verify code)
        ├── dashboard/page.tsx      # Property list (10 max), delete, link to analysis
        └── properties/
            ├── new/page.tsx        # New property — renders <PropertyForm>
            ├── [id]/edit/page.tsx  # Edit property — renders <PropertyForm> prefilled
            └── [id]/analysis/page.tsx  # Full analysis display + CSV/JPG export
```

> **Note:** `frontend/CLAUDE.md` contains only `@AGENTS.md` — it is a redirect, not real docs.

---

## Key Design Decisions

### Auth — Two-step email verification
- `POST /auth/register` → creates `EmailVerification` row, sends 6-digit code, returns 202
- `POST /auth/verify` → validates code, creates `User`, deletes pending row, returns JWT
- Users never touch the `users` table until code is confirmed
- 60-second cooldown per email address (prevents spam)
- 15-minute code TTL
- **100-user cap** enforced at verify time (403 if full) — `USER_CAP = 100` in `routes/auth.py`
- `passlib` was removed — use `bcrypt` directly. passlib 1.7.4 is broken with bcrypt 5.x.
- React 19: use `React.SyntheticEvent`, not `React.FormEvent` (deprecated in React 19)

### Frontend auth — localStorage + React context
JWT is stored in `localStorage` under the key `rei_token`. `AuthContext.tsx` reads it on mount, exposes `{ token, username, login, logout }` via `useAuth()`. `login()` stores the token and redirects to `/dashboard`. `logout()` clears it and redirects to `/login`.

**All authenticated API calls must go through `apiFetch`** (not bare `fetch`). Signature:
```ts
apiFetch(path: string, options?: RequestInit, token?: string): Promise<Response>
```
It sets `Content-Type: application/json` and, when `token` is provided, adds `Authorization: Bearer <token>`. Token comes from `const { token } = useAuth()`.

### Database — SQLite / PostgreSQL dual mode
`database.py` auto-detects from `DATABASE_URL`. SQLite uses `check_same_thread=False`. Railway injects `postgres://` — the code rewrites it to `postgresql://` (SQLAlchemy requirement).

**Schema management: `create_tables()` only — Alembic is NOT used.**
`alembic` appears in `requirements.txt` (installed as a dependency) but is not configured and has no migrations. Schema is created via `Base.metadata.create_all()` on app startup. For local schema changes: `rm rei.db` and restart. For production PostgreSQL schema changes: you must `ALTER TABLE` manually or connect to the Railway DB and run SQL directly — there is no migration tooling set up.

### Analysis engine
`backend/analysis/rental.py` — `analyse_rental(prop, db)` runs three scenarios (low/mid/high rent):

```
initial_investment = down_amount + closing_costs + initial_repairs
down_amount        = purchase_price × (down_payment / 100)   ← down_payment is stored as %
loan_amount        = purchase_price − down_amount
re_value           = equity + cumulative_cash_flow            ← notional net if sold today
cumulative_roi_pct = (re_value − initial_investment) / initial_investment × 100
                     (0% = breakeven, negative = behind, positive = ahead)
stock_value        = initial_investment × (1 + market_cagr) ^ year
cap_rate_mid       = NOI_y1_mid / purchase_price × 100
                     where NOI excludes mortgage but includes tax, HOA, management, maintenance, insurance
grm_mid            = purchase_price / (rent_mid × 12)
```

PMI drops off when `loan_balance ≤ 0.80 × purchase_price`.

Market CAGR = ^GSPC 50-year CAGR, fetched once from Yahoo Finance on first request and cached permanently in the `app_settings` DB table. Falls back to 8.98% if Yahoo Finance is unreachable. Never auto-refreshes — call `POST /market/refresh` to force update.

### Zillow scraper — dual mode
- **Local dev** (no `SCRAPER_API_KEY`): curl_cffi impersonates Chrome 124 TLS fingerprint directly
- **Production** (`SCRAPER_API_KEY` set): routes through ScraperAPI residential proxies
- Detection: `if SCRAPER_API_KEY:` at the top of `scraper/zillow.py`
- Zillow datacenter IPs are blocked by PerimeterX — the scraper will 403 in prod without ScraperAPI

### Email — Resend
- `FROM_ADDRESS = "noreply@reianalyzer.online"` in `backend/email.py`
- `reianalyzer.online` is fully verified in Resend — all three records green (DKIM, SPF, MX)
- See **DNS & Domain Configuration** section for record details and gotchas

### Deployment — Railway (two separate services)

| Service | Config file | Start command |
|---|---|---|
| **backend** | `./railway.toml` (root) | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **frontend** | `./frontend/railway.toml` | `node_modules/.bin/next start -p $PORT` |

Railway uses **Railpack** (not Nixpacks). The root-level `requirements.txt` must be kept in sync with `backend/requirements.txt` — Railpack only reads requirements from the project root during the install phase.

Deploy commands:
```bash
# Backend (run from repo root)
railway service backend
railway up

# Frontend (run from repo root)
railway service frontend
railway up ./frontend --path-as-root
```

**CORS**: backend reads `ALLOWED_ORIGINS` env var (comma-separated). Locally defaults to `http://localhost:3000`. In production must be set to the Railway frontend URL.

---

## Environment Variables

### Backend (`.env` locally, Railway env vars in prod)
```
SECRET_KEY=...                        # JWT signing key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
RESEND_API_KEY=re_...                 # Resend email API key
SCRAPER_API_KEY=...                   # ScraperAPI key — omit locally to use curl_cffi mode
DATABASE_URL=...                      # Injected by Railway PostgreSQL addon; absent = SQLite
ALLOWED_ORIGINS=https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online
```

### Frontend
```
# .env.local (local dev)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Railway env var (production)
NEXT_PUBLIC_API_URL=https://backend-production-8eb7.up.railway.app
```

---

## Running Locally

```bash
# Backend (from repo root)
python -m uvicorn backend.main:app --reload
# → http://localhost:8000/docs

# Frontend (from repo root)
cd frontend && npm run dev
# → http://localhost:3000

# Tests (must all pass before deploying)
pytest backend/tests/
```

---

## Test Architecture

`backend/tests/conftest.py` creates a **file-based** SQLite test DB (`test.db`) — not in-memory. Each test gets a fresh schema via the `setup_test_db` autouse fixture (creates tables before, drops after). `client` fixture overrides `get_db` with the test session.

### Shared fixtures in `conftest.py`

| Fixture | What it provides |
|---|---|
| `mock_email` (autouse) | Patches `send_verification_email` globally — no real emails fire |
| `valid_property` | Fresh copy of the standard 450k Austin property payload dict |
| `get_code(email)` | Factory: looks up the pending verification code from the test DB |
| `auth_token` | Registers + verifies alice, returns her JWT |

**`mock_email` is defined once in `conftest.py` as autouse** — do not redefine it in new test files. The one exception is `test_auth.py`, which overrides it locally to expose the mock object for call assertions.

**`valid_property` is the single source of truth for the property payload.** Never define a separate `VALID_PROPERTY` dict in a test file — when the schema changes, only `conftest.py` needs updating.

Tests that need a logged-in user declare `auth_token` as a parameter:
```python
def test_something(client, auth_token, valid_property):
    res = client.post("/properties", json=valid_property, headers={"Authorization": f"Bearer {auth_token}"})
```

Tests involving a second user create that user inline and use the `get_code` fixture to complete verification:
```python
def test_two_users(client, auth_token, get_code):
    bob = {"username": "bob", "email": "bob@example.com", "password": "password2"}
    client.post("/auth/register", json=bob)
    token_b = client.post("/auth/verify", json={"email": bob["email"], "code": get_code(bob["email"])}).json()["access_token"]
```

---

## Chart Export — JPG

The JPG export in `frontend/app/properties/[id]/analysis/page.tsx` extracts the Recharts SVG directly — it does **not** use html2canvas. html2canvas was tried and failed because Tailwind CSS v4 uses `oklch()` colors, which html2canvas cannot render.

Implementation: finds the largest SVG by pixel area inside `chartRef`, clones it with explicit `width`/`height` attributes, serializes to a Blob URL, draws onto a 2× canvas for retina quality, then triggers a download.

---

## DNS & Domain Configuration

Domain registrar: **Namecheap**. Email provider: **Resend**. Hosting: **Railway**.

### Namecheap Advanced DNS — current records

| Type | Host | Value | Notes |
|---|---|---|---|
| CNAME | `@` | `r4gwxgys.up.railway.app.` | Points root domain → Railway frontend |
| CNAME | `www` | `reianalyzer.online.` | Redirects www → root |
| TXT | `_railway-verify` | `railway-verify=4e776c122c3b5aa2f037103037fa8ff30c3a3e74a81b910c9905548b788359b5` | Railway domain ownership proof |
| TXT | `send` | *(Resend SPF value — visible in Resend dashboard)* | SPF record for outbound email |
| TXT | `resend._domainkey` | *(Resend DKIM value — visible in Resend dashboard)* | DKIM signing key |

**Mail Settings section** (separate from Advanced DNS in Namecheap UI):
- Set to **Custom MX** (not "Email Forwarding")
- MX record host: `send`, value and priority shown in Resend dashboard

> **Gotcha — SPF and MX host must be `send`, not `@`.** This creates `send.reianalyzer.online`, which is what Resend expects. Setting host to `@` creates `reianalyzer.online` instead and Resend will not verify it.

> **Gotcha — Namecheap MX records live under "Mail Settings"**, not in the main Advanced DNS record list. You must switch the Mail Settings dropdown from "Email Forwarding" to "Custom MX" before the MX record fields appear.

> **Gotcha — CNAME on `@` (root) is non-standard DNS** but Namecheap supports it. Do not add an A record or URL redirect on `@` — they will conflict with the CNAME.

### Resend domain verification (`reianalyzer.online`)

All three records must be green in the Resend dashboard before outbound email works:
- **DKIM** — TXT at `resend._domainkey.reianalyzer.online` ✅
- **SPF** — TXT at `send.reianalyzer.online` ✅
- **MX** — MX at `send.reianalyzer.online` ✅

`FROM_ADDRESS = "noreply@reianalyzer.online"` in `backend/email.py`.

### Railway custom domain

- Service: **frontend**, port **8080** (next-server)
- Custom domain added: `reianalyzer.online`
- Railway verifies ownership via the `_railway-verify` TXT record above
- `www.reianalyzer.online` is handled by the Namecheap CNAME redirect → root (Railway only allows one custom domain on the free plan)

### CORS

Backend env var `ALLOWED_ORIGINS` (set in Railway dashboard, not in code):
```
https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online
```
If you add another domain, append it comma-separated here and redeploy the backend.

---

## Pending / Next Steps

No outstanding items — domain is live, email is verified, both services deployed.

---

## Known Gotchas

- **`down_payment` is a percentage, not dollars.** Stored as `Numeric(5,2)`, represents 0–100. A 20% down payment is stored as `20.00`, not `200000.00`. The analysis engine divides by 100 to get the decimal.
- **SQLite naive datetimes**: SQLite strips timezone info on write. Use `.replace(tzinfo=timezone.utc)` when comparing a DB datetime to `datetime.now(timezone.utc)`. Do NOT use `.astimezone()` — it raises on naive datetimes.
- **Alembic is in requirements but not used.** Don't run `alembic upgrade head`. Schema is managed by `create_tables()` / `Base.metadata.create_all()` on startup.
- **Railway Source Root**: leave blank in the Railway dashboard. Setting it causes Railway to look for `frontend/frontend/` instead of `frontend/`.
- **Railway redeploys via dashboard**: dashboard-triggered redeploys have no code if the service has no connected GitHub repo. Always use `railway up` for deploys.
- **Two `railway.toml` files**: root `railway.toml` is for the backend; `frontend/railway.toml` is for the frontend. Do not merge or move them.
- **10-property cap**: `PROPERTY_LIMIT = 10` in `backend/routes/properties.py`, enforced at create time with a 400 error.
- **Market CAGR never auto-refreshes**: once stored, it stays forever. Use `POST /market/refresh` to force a Yahoo Finance refetch.
- **Production DB schema changes**: no Alembic. If the DB is uninitialised (empty), `create_tables()` builds the full current schema on first startup — no manual SQL needed. If the DB already has live data, new columns must be added via `ALTER TABLE` *before* deploying or the backend crashes. See `.claude/skills/deploy-prod/SKILL.md` for the exact procedure (uses psycopg2 via the REI venv + `DATABASE_PUBLIC_URL` from `railway variables --service Postgres`).
- **`railway run` does not inject `DATABASE_URL` locally**: the PostgreSQL addon URL is only reachable inside Railway's network. To run SQL from your laptop, get `DATABASE_PUBLIC_URL` from `railway variables --service Postgres` and connect directly — `psql` is not installed locally, so use psycopg2.
- **Check production DB state before assuming migration is needed**: `SELECT tablename FROM pg_tables WHERE schemaname='public'` — an empty result means the DB is fresh and `create_tables()` will handle everything.
