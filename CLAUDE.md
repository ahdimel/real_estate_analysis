# REIA — CLAUDE.md

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
│   │   ├── __init__.py             # exports User, Property, AppSetting, EmailVerification, PasswordReset
│   │   ├── user.py                 # User table (id, username, email, hashed_password, is_verified)
│   │   ├── property.py             # Property table (all intake fields)
│   │   ├── email_verification.py   # Pending registrations (email unique, expires_at)
│   │   ├── password_reset.py       # Password reset tokens (token, email, expires_at — 1hr TTL)
│   │   └── settings.py             # AppSetting key/value table — caches mortgage rate
│   ├── schemas/
│   │   ├── __init__.py             # (empty)
│   │   ├── user.py                 # UserRegister, UserLogin, UserOut, Token, VerifyCode
│   │   ├── property.py             # PropertyCreate, PropertyUpdate, PropertyOut
│   │   └── analysis.py             # YearProjectionOut, AnalysisResultOut, ScenarioSummaryOut
│   ├── routes/
│   │   ├── auth.py                 # POST /auth/register, /auth/verify, /auth/login,
│   │   │                           #   /auth/forgot-password, /auth/reset-password, /auth/refresh
│   │   ├── properties.py           # CRUD /properties — user-scoped, 10-property cap
│   │   ├── analysis.py             # GET /properties/{id}/analysis → latest snapshot (ReportDetailOut) or 404
│   │   ├── reports.py              # POST /properties/{id}/analysis (costs 1 credit), GET/list /reports/*
│   │   ├── market.py               # GET /market/rate, GET /market/mortgage-rate
│   │   └── scraper.py              # POST /scraper/zillow
│   ├── analysis/
│   │   ├── rental.py               # Core engine: analyse_rental() → AnalysisResult
│   │   ├── market.py               # get_market_cagr(): returns hardcoded 8.5% S&P 500 50-yr avg
│   │   └── mortgage_rate.py        # get_mortgage_rate(db): fetches Freddie Mac 30yr rate, caches 7 days
│   ├── scraper/
│   │   └── zillow.py               # scrape_zillow(url) → form-field dict
│   ├── tests/
│   │   ├── conftest.py             # pytest fixtures: file-based SQLite + TestClient (NOT in-memory)
│   │   ├── test_auth.py            # Registration, verification, login flows; username constraint tests
│   │   ├── test_properties.py      # CRUD + ownership isolation + URL scheme validation tests
│   │   ├── test_analysis.py        # Analysis math unit tests + full API flow
│   │   ├── test_market.py          # Market rate endpoint
│   │   ├── test_reports.py         # Analysis credit spend, listing, re-download, CREDIT_LIMIT enforcement
│   │   └── test_scraper.py         # ScraperAPI header regression (L4)
│   └── schemas/
│       ├── report.py               # ReportOut, ReportDetailOut, ReportGenerateResponse
└── frontend/
    ├── railway.toml                # FRONTEND: startCommand="node_modules/.bin/next start -p $PORT"
    ├── package.json                # version field is the canonical app version (currently 0.2.0)
    ├── .env.local                  # NEXT_PUBLIC_API_URL=http://localhost:8000 (local only)
    ├── lib/api.ts                  # API_BASE + apiFetch() helper (see Auth section below)
    ├── context/AuthContext.tsx     # AuthProvider + useAuth() hook
    ├── components/
    │   ├── Footer.tsx              # Shared footer: Terms, Donate, version — rendered in layout
    │   └── PropertyForm.tsx        # Shared intake form with Zillow scrape button + tooltips
    ├── components/
    │   ├── Footer.tsx              # Shared footer: Terms, Donate, version — rendered in layout
    │   ├── PropertyForm.tsx        # Shared intake form with Zillow scrape button + tooltips
    │   └── ReportPDF.tsx           # @react-pdf/renderer document — 5-page PDF template
    └── app/
        ├── layout.tsx              # Root layout — wraps everything in <AuthProvider> + <Footer>
        ├── page.tsx                # Landing: Sign in / Create account buttons
        ├── login/page.tsx          # Login form (includes Forgot password? link)
        ├── register/page.tsx       # Two-step registration (form → verify code)
        ├── dashboard/page.tsx      # Analysis History panel + property list (10 max), delete, link to analysis
        ├── terms/page.tsx          # Terms & Conditions
        ├── donate/page.tsx         # Donation page — Ko-fi link (cash); Bitcoin TBD
        ├── forgot-password/page.tsx # Email entry form — triggers reset email
        ├── reset-password/page.tsx  # Token-based new password form (?token= from email link)
        └── properties/
            ├── new/page.tsx        # New property — renders <PropertyForm>
            ├── [id]/edit/page.tsx  # Edit property — renders <PropertyForm> prefilled
            └── [id]/analysis/page.tsx  # Loads latest snapshot; Run Analysis (credit); free PDF download; CSV/JPG export
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
- **500-user cap** enforced at verify time (403 if full) — `USER_CAP = 500` in `routes/auth.py`
- `passlib` was removed — use `bcrypt` directly. passlib 1.7.4 is broken with bcrypt 5.x.
- React 19: use `React.SyntheticEvent`, not `React.FormEvent` (deprecated in React 19)
- Duplicate-username and duplicate-email at registration return the **same** error message (`"Username or email already in use."`) — do not add distinct messages; that would reintroduce M1 enumeration.
- `username` is validated with `Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")` in `schemas/user.py`.
- `source_url` and `property_tax_url` are validated to require `http` or `https` scheme — `javascript:` URIs are rejected at the Pydantic layer.

### Auth — Forgot password flow
- `POST /auth/forgot-password` — takes `email`, always returns 202 (never reveals whether email is registered)
- If the email exists, generates a `secrets.token_urlsafe(32)` token, stores it in `password_resets` table with 1hr TTL, sends reset email via Resend with link `{FRONTEND_URL}/reset-password?token=<token>`
- Reset email includes the user's **username** in case they forgot that too
- `POST /auth/reset-password` — takes `token` + `new_password`, validates TTL, updates `hashed_password`, increments `token_version`, deletes the token row
- Incrementing `token_version` immediately invalidates all previously issued JWTs for that user (H3 fix)
- One pending reset per email (old row replaced on repeat requests)
- Frontend: `forgot-password/page.tsx` → email form; `reset-password/page.tsx` → reads `?token=` from URL, redirects to `/login` on success

### Frontend auth — localStorage + React context
JWT is stored in `localStorage` under the key `rei_token`. `AuthContext.tsx` reads it on mount, exposes `{ token, username, login, logout }` via `useAuth()`. `login()` stores the token and redirects to `/dashboard`. `logout()` fires a best-effort `POST /auth/logout` (increments `token_version` server-side to invalidate all tokens), then clears localStorage and redirects to `/login` regardless of network outcome.

**All authenticated API calls must go through `apiFetch`** (not bare `fetch`). Signature:
```ts
apiFetch(path: string, options?: RequestInit, token?: string): Promise<Response>
```
It sets `Content-Type: application/json` and, when `token` is provided, adds `Authorization: Bearer <token>`. Token comes from `const { token } = useAuth()`.

### Database — SQLite / PostgreSQL dual mode
`database.py` auto-detects from `DATABASE_URL`. SQLite uses `check_same_thread=False`. Railway injects `postgres://` — the code rewrites it to `postgresql://` (SQLAlchemy requirement).

**Schema management: Alembic migrations.**
`alembic/` is fully configured. `alembic/env.py` reads `DATABASE_URL` from the environment and uses `render_as_batch=True` so SQLite can handle `ALTER TABLE` via table recreation.

- **Procfile / `railway.toml`**: run `alembic upgrade head` before uvicorn starts. Migrations apply automatically on every deploy.
- **Adding a column**: `alembic revision --autogenerate -m "describe_change"`, review the generated file in `alembic/versions/`, commit, deploy. Never hand-write `ALTER TABLE` SQL.
- **Local schema reset**: `rm rei.db` — the next backend start runs `alembic upgrade head` and recreates the DB from scratch.
- **`Base.metadata.create_all()`** is used only in the test suite (`conftest.py`). The production app never calls it directly.
- **First production deploy after Alembic was added**: the existing DB must be stamped with `alembic stamp head` before deploying. See `.claude/skills/deploy-prod/SKILL.md` for the exact procedure.

### Analysis engine
`backend/analysis/rental.py` — `analyse_rental(prop)` runs three scenarios (low/mid/high rent):

```
initial_investment = down_amount + closing_costs + initial_repairs
down_amount        = purchase_price × (down_payment / 100)   ← down_payment is stored as %
loan_amount        = purchase_price − down_amount
re_value           = equity + cumulative_cash_flow            ← notional net if sold today
cumulative_roi_pct = (re_value − initial_investment) / initial_investment × 100
                     (0% = breakeven, negative = behind, positive = ahead)
stock_value        = initial_investment × (1 + market_cagr) ^ year
cap_rate_mid       = NOI_y1_mid / purchase_price × 100  ← still returned by API but intentionally not displayed in the UI
                     where NOI excludes mortgage but includes tax, HOA, management, maintenance, insurance
grm_mid            = purchase_price / (rent_mid × 12)   ← still returned by API but intentionally not displayed in the UI
```

PMI drops off when `loan_balance ≤ 0.80 × purchase_price`.

Market CAGR = `prop.market_cagr_pct` (user-supplied, stored on the `properties` table). Default is 8.5%, the S&P 500 50-year historical price return average. The constant `MARKET_CAGR` in `backend/analysis/market.py` is no longer used for the projection — `analyse_rental()` reads `float(prop.market_cagr_pct) / 100` directly. `get_market_cagr()` is retained only as the source of `market_label` in the API response.

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
DATABASE_URL=...                      # Must be set explicitly in Railway backend service (NOT auto-injected)
                                      # Use internal URL: postgresql://postgres:<pw>@postgres.railway.internal:5432/railway
                                      # Absent locally = SQLite fallback (fine); absent in prod = RuntimeError at startup
ALLOWED_ORIGINS=https://frontend-production-45bb.up.railway.app,https://reianalyzer.online,https://www.reianalyzer.online
FRONTEND_URL=https://reianalyzer.online  # Base URL for password reset links in emails; defaults to http://localhost:3000
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
# Backend — run migration first, then start server (from repo root)
# Use the REI venv explicitly; never rely on PATH python/uvicorn
/path/to/venv/bin/python -m alembic upgrade head
/path/to/venv/bin/python -m uvicorn backend.main:app --reload
# → http://localhost:8000/docs

# Frontend (from repo root)
cd frontend && npm run dev
# → http://localhost:3000

# Tests (must all pass before deploying)
pytest backend/tests/
```

> See `.claude/skills/run-local/SKILL.md` for the exact venv paths and background-process commands.

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

`captureChartToDataUrl(chartEl, forPrint?)` — finds the largest SVG by pixel area inside `chartRef`, clones it with explicit `width`/`height` attributes, serializes to a Blob URL, draws onto a 2× canvas for retina quality, then triggers a download.

**`forPrint` flag** — when `true` (used by PDF generation), `remapSvgForPrint()` walks the cloned SVG and replaces dark zinc/muted hex values with their light equivalents (`PRINT_COLOR_MAP`) before serializing, and fills the canvas white. This produces a chart image suited for a white-background PDF. When `false` (used by "Export JPG"), the canvas fills `#27272a` and colors are left unchanged, preserving the dark-themed appearance.

---

## Analysis Credits & PDF Export

### Credit model
**Each credit buys one analysis run.** Credits are lifetime (no monthly reset). Enforced at `POST /properties/{id}/analysis` time (429 if exceeded). Counted as `SELECT COUNT(*) FROM reports WHERE user_id = ?`.

Spending a credit runs the analysis engine server-side, stores a snapshot of the inputs + results, and returns them to the client. PDF generation is a free, on-demand, client-side action against any stored snapshot — it never costs a credit.

This model was chosen because the analysis (computation + insight) is the scarce resource, not the document format. Future pricing tiers will grant more credits rather than more PDF downloads.

### Tiered plans (monetization-ready)
`users.plan` (String, `server_default="free"`) determines each user's credit limit. The lookup lives in `PLAN_LIMITS` in `backend/routes/reports.py`:

```python
PLAN_LIMITS = {"free": 10, "pro": 50, "max": 1000}
```

`_credit_limit(plan)` resolves the limit; all three credit-check spots in `reports.py` call it against `current_user.plan`. To upgrade a user, set `user.plan = "pro"` or `"max"` — the gate responds immediately. A Stripe webhook is the expected integration point; no other code needs to change.

### Data model
```
reports (id [int PK], public_id [char(8) UNIQUE], user_id [FK→users],
         property_id [FK→properties, SET NULL on delete],
         property_name [denormalized string],
         snapshot [JSON], generated_at)
```

The DB table is still named `reports`; the concept is now "analysis runs". `snapshot` stores `{property: PropertyOut, analysis: AnalysisResponseOut}` at run time — the client cannot tamper with what is stored.

`public_id` — 8 characters from `0-9A-Z` (base-36). Generated with `secrets.choice` in a retry loop with a `UNIQUE` DB constraint as the safety net. With a 500-user cap and 10 credits/user the ID space (36⁸ ≈ 2.8T) is effectively collision-free.

`property_id` is set to NULL when a property is deleted (`ondelete="SET NULL"`). `property_name` is denormalized so the row (and its PDF re-download) survive property deletion.

### Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/properties/{id}/analysis` | Run analysis — costs 1 credit; returns `{report: ReportDetailOut, remaining: int}` |
| `GET` | `/properties/{id}/analysis` | Returns the most recent snapshot (`ReportDetailOut`); 404 if none exists yet |
| `GET` | `/properties/{id}/reports` | All analysis runs for this property (no snapshot) |
| `GET` | `/reports` | All analysis runs for the current user (no snapshot) |
| `GET` | `/reports/count` | `{used, limit, remaining}` |
| `GET` | `/reports/{public_id}` | Full snapshot by public_id (used for PDF re-downloads) |

All endpoints are user-scoped — a user can only access their own data.

### Analysis page flow
1. On load: `GET /properties/{id}/analysis` — if 404, shows empty state with "Run Analysis" prompt; if 200, displays results from snapshot.
2. Inputs-changed banner: if `purchase_price`, `annual_interest_rate`, `rent_lower`, or `rent_upper` differ between `snapshot.property` and the current property, a warning is shown with the old results still visible.
3. "Run Analysis — 1 credit" button calls `POST /properties/{id}/analysis`, updates the display immediately from the response.
4. "↓ Download PDF" button is free, appears once an analysis exists, generates the PDF client-side.
5. "Analysis History" list shows all past runs; each row has a free "↓ PDF" re-download button.

### Client-side PDF (`@react-pdf/renderer`)
PDF is assembled entirely in the browser — nothing is stored on the server. `@react-pdf/renderer` v4 is dynamically imported (`import("@react-pdf/renderer")`) to avoid Next.js SSR errors. The `pdf(doc).toBlob()` result is downloaded via a temporary object URL.

**PDF structure (5 pages):**
- Page 1 (portrait): report header, all property inputs (including Alt. Investment CAGR), key metrics (initial investment, loan, mortgage), scenario comparison table
- Page 2 (landscape): 30-year projection chart captured as JPEG via SVG→canvas with print color remapping (white background)
- Pages 3–5 (landscape): full 20-column 30-year projection tables for Low Rent / Medium Rent / High Rent scenarios

**PDF color scheme:** printer-friendly white background throughout. `C` palette in `ReportPDF.tsx` uses white/light-grey surfaces and near-black text. Semantic colors (green/red/amber/purple) are darkened slightly from the screen palette for readability on white paper.

**Chart capture for PDF:** calls `captureChartToDataUrl(chartRef.current, true)` — the `forPrint=true` flag remaps dark SVG colors to light equivalents via `PRINT_COLOR_MAP` before drawing to canvas. Re-downloads from the dashboard pass `chartImageUrl: ""` — the chart slot renders empty; chart is only captured on the analysis page where it is rendered.

**Projection table columns (20):** Yr, Gross Rent, Eff. Rent, Mortg., Taxes, HOA, Mgmt, Maint., Insur., PMI, Tot. Exp., Net CF, Cum. CF, Prop. Val, Loan Bal., Equity, Eq. Gain, RE Value, ROI %, Alt. Inv. (X%). Column flex weights are tuned for landscape A4 at 6pt font — do not change them without testing the PDF render.

**Re-download:** fetches the stored snapshot from `GET /reports/{public_id}`, then regenerates the PDF client-side. The table data always reflects the parameters at run time.

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

## Security

See `.claude/SECURITY.md` for the full list of security findings (18 items, prioritised by severity).
**15 of 18 resolved.** 3 remain open:

| ID | Finding | Priority |
|---|---|---|
| M2 | JWT stored in `localStorage` — full XSS exposure (known design decision) | Medium |
| L1 | `/market/rate` and `/market/mortgage-rate` unauthenticated | Low |
| L5 | Freddie Mac fallback rate not disclosed to client | Low |

---

## Pending / Next Steps

### PDF polish (visual / layout)
The PDF template in `frontend/components/ReportPDF.tsx` has a few remaining refinement items:

- **Chart re-download quality**: when re-downloading from the dashboard (no active chart in DOM), page 2 (chart) is skipped entirely (`chartImageUrl === ""` guard in `ReportPDF.tsx`). **This is a known limitation** — re-downloaded PDFs are 4 pages instead of 5 and have no chart. The proper fix is to cache the chart data URL in the report snapshot at run time, so re-downloads can include the original chart.
- **Custom font**: currently uses Helvetica (built-in). Registering Inter or a similar sans-serif via `Font.register()` would improve visual fidelity.
- ~~**MLS ID / source URL**: include in the property details section if present on the snapshot.~~ ✓ MLS ID is now shown in the Property Details section of the PDF (conditionally, when non-null/non-empty).
- **PDF generation loading state**: currently the button text changes to "Generating…". A full-page overlay or progress indicator would be more informative for slow connections.

### Standardize on PostgreSQL locally (when scaling up)
Currently SQLite is used locally and PostgreSQL in production. This was the right call while prototyping rapidly, but as the app grows it's worth standardizing on Postgres everywhere via Docker Compose — migrations and type behavior would then be validated locally against the same engine that runs in production. Not urgent while the schema stays simple, but worth doing before any complex queries or migrations are introduced.



---

## Known Gotchas

- **`market_cagr_pct` is a user-editable field, not a hardcoded constant.** Stored as `Numeric(5,2)` on the `properties` table (`server_default="8.5"`). The analysis engine reads it directly — do not use the `MARKET_CAGR` constant from `backend/analysis/market.py` for projections. `get_market_cagr()` is kept only to supply `market_label` in the API response.
- **`down_payment` is a percentage, not dollars.** Stored as `Numeric(5,2)`, represents 0–100. A 20% down payment is stored as `20.00`, not `200000.00`. The analysis engine divides by 100 to get the decimal.
- **SQLite naive datetimes**: SQLite strips timezone info on write. Use `.replace(tzinfo=timezone.utc)` when comparing a DB datetime to `datetime.now(timezone.utc)`. Do NOT use `.astimezone()` — it raises on naive datetimes.
- **Railway Source Root**: leave blank in the Railway dashboard. Setting it causes Railway to look for `frontend/frontend/` instead of `frontend/`.
- **Railway redeploys via dashboard**: dashboard-triggered redeploys have no code if the service has no connected GitHub repo. Always use `railway up` for deploys.
- **Two `railway.toml` files**: root `railway.toml` is for the backend; `frontend/railway.toml` is for the frontend. Do not merge or move them.
- **10-property cap**: `PROPERTY_LIMIT = 10` in `backend/routes/properties.py`, enforced at create time with a 400 error.
- **JWT refresh**: `POST /auth/refresh` issues a new 30-min token for any valid non-expired token. Frontend pages use `fetchWithAuth` (from `AuthContext`) instead of `apiFetch` directly — it automatically retries on 401 after a refresh attempt, then calls `logout()` if the refresh also fails.
- **`token_version` invalidates JWTs immediately**: `users.token_version` (int, default 0) is embedded as a `"ver"` claim in every JWT. `get_current_user` rejects any token whose `ver` differs from the current DB value. Two events increment `token_version`: (1) `POST /auth/reset-password` — password change, (2) `POST /auth/logout` — explicit logout. After either event, all previously issued tokens for that user are dead instantly, including any held by an attacker.
- **`POST /auth/logout` is a server-side operation**: it increments `token_version` in the DB, not just clears the client cookie. Do not remove or skip this call — without it, tokens stay valid until their 30-minute TTL even after the user has "logged out" on the client.
- **`SELECT FOR UPDATE` on the credit gate**: `POST /properties/{id}/analysis` locks the user row with `SELECT ... FOR UPDATE` before counting reports (PostgreSQL only — skipped on SQLite). This prevents two concurrent requests from both passing the plan-limit check. Do not remove this lock or move the count check before it.
- **`mortgage_term` is an enum, not a free integer**: valid values are `{10, 15, 20, 30}`. The backend rejects any other value with 422. The form renders a dropdown, not a free-text field.
- **`annual_interest_rate` must be > 0**: `ge=0.01` on the Pydantic schema. A 0% rate would produce divide-by-zero in mortgage calculations.
- **Adding a new NOT NULL column without a default**: add it as nullable first, backfill values, then tighten to NOT NULL in a second migration. Doing it in one step will fail on any table that already has rows.
- **`railway run` does not inject `DATABASE_URL` locally**: the PostgreSQL addon URL is only reachable inside Railway's network. To run Alembic or psycopg2 against production from your laptop, get `DATABASE_PUBLIC_URL` from `railway variables --service Postgres` and pass it as `DATABASE_URL=<value> alembic ...`.
- **Required env vars at startup**: `SECRET_KEY` and `RESEND_API_KEY` must be set. The app raises `RuntimeError` on startup if either is missing — this is intentional. Set them in `.env` locally and in Railway environment variables for production.
- **`SECRET_KEY` must be at least 32 characters**: the lifespan guard now asserts `len(SECRET_KEY) >= 32`. Generate a compliant key with: `python -c "import secrets; print(secrets.token_hex(32))"`.
- **OpenAPI docs (`/docs`, `/redoc`, `/openapi.json`) are disabled in production**: they return 404 when `RAILWAY_ENVIRONMENT` is set. They are still served locally for development. This is intentional (L2 fix).
- **Username constraints**: `username` must be 3–32 characters, pattern `[a-zA-Z0-9_-]`. Alphanumeric plus dash and underscore only. Enforced by Pydantic at registration (422 on violation).
- **`DATABASE_URL` must be set in the Railway backend service**: the PostgreSQL addon variables live in the Postgres service and are NOT automatically injected into the backend service. Without it, the backend silently falls back to ephemeral SQLite and all data is wiped on every deploy. If `RAILWAY_ENVIRONMENT` is set and `DATABASE_URL` is absent, the app now raises `RuntimeError` at startup. Use the internal URL: `postgresql://postgres:<password>@postgres.railway.internal:5432/railway`.
- **Health check verifies schema**: `GET /health` runs `SELECT 1 FROM users LIMIT 1`. A 503 means either the DB is unreachable or the schema is missing (e.g. migrations never ran). This catches a misconfigured DB before Railway routes any traffic to the service.
- **`alembic stamp` stamps version only — it does not create tables**: running `alembic stamp head` on an empty DB records the version without executing any migration SQL. If you stamp and then deploy, Alembic will skip all stamped migrations and only run newer ones, leaving the core tables uncreated. Only stamp a DB that already has the correct schema in place.
