---
description: Start, monitor, and stop the REI Analyzer local development environment (backend + frontend)
---

# Run REI Analyzer Locally

## Critical: Python environment

The shell may inherit a different project's venv (e.g. visual_dna). Always use the REI-specific venv explicitly:

```
/Users/ahdimel/Documents/vscode/REI/venv/bin/python
/Users/ahdimel/Documents/vscode/REI/venv/bin/uvicorn
```

Never rely on `python`, `python3`, or `uvicorn` from PATH — they will point to the wrong environment.

## Critical: `.env` requirements

The backend refuses to start if either required env var is missing or `SECRET_KEY` is under 32 characters.
Your `.env` (at the repo root) must have:
```
SECRET_KEY=<at least 32 characters>
RESEND_API_KEY=re_...
```
Generate a compliant key if you don't have one:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
If the backend log shows `RuntimeError: SECRET_KEY must be at least 32 characters`, this is why.

## Start

Run from the repo root `/Users/ahdimel/Documents/vscode/REI`.

**If the DB schema changed** (new Alembic migration added, or starting fresh), delete the local SQLite DB and let the migration recreate it:
```bash
rm -f /Users/ahdimel/Documents/vscode/REI/rei.db
```
The migration will recreate it on the next backend start — no manual SQL needed.

**Backend** (runs migration first, then starts the server):
```bash
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -m alembic upgrade head && /Users/ahdimel/Documents/vscode/REI/venv/bin/python -m uvicorn backend.main:app --reload --port 8000 > /tmp/rei-backend.log 2>&1 &
```

**Wait for backend, then check health:**
```bash
sleep 4 && curl -s http://localhost:8000/health
```
Expected response: `{"status":"ok"}`. If it fails, check `/tmp/rei-backend.log`.

**Frontend:**
```bash
cd /Users/ahdimel/Documents/vscode/REI/frontend && npm run dev > /tmp/rei-frontend.log 2>&1 &
```

**Wait for frontend:**
```bash
sleep 6 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```
Expected: `200`.

## URLs

- Frontend: http://localhost:3000
- Backend API docs (Swagger): http://localhost:8000/docs
- Backend health: http://localhost:8000/health

## Monitor

```bash
# Live backend log
tail -f /tmp/rei-backend.log

# Live frontend log
tail -f /tmp/rei-frontend.log

# Check what's running on both ports
lsof -i:8000,3000
```

## Stop

```bash
lsof -ti:8000,3000 | xargs kill -9 2>/dev/null
```

This kills both processes. Confirm with `lsof -i:8000,3000` — should return nothing.
