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

## Start

Run from the repo root `/Users/ahdimel/Documents/vscode/REI`.

**If the DB schema changed** (new columns added, columns removed), delete the local SQLite DB first:
```bash
rm -f /Users/ahdimel/Documents/vscode/REI/rei.db
```
The schema recreates automatically on backend startup via `create_tables()`.

**Backend:**
```bash
/Users/ahdimel/Documents/vscode/REI/venv/bin/python -m uvicorn backend.main:app --reload --port 8000 > /tmp/rei-backend.log 2>&1 &
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
