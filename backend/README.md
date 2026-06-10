# SENTINEL Enterprise Backend (optional)

A small FastAPI service that receives **anonymized, metadata-only** scan events
from extensions within an organization and serves team-level analytics. It never
sees prompt content. **Off by default** — the extension is fully functional
without it.

## Run locally (zero setup — SQLite)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API docs (Swagger): http://localhost:8000/docs
- A demo organization is seeded automatically with API key `demo-key-sentinel`.

## Use Postgres (production)

```bash
export SENTINEL_DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/sentinel"
uvicorn app.main:app
```

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/health` | – | liveness |
| POST | `/api/sync` | `X-API-Key` | ingest metadata-only events |
| GET  | `/api/analytics/summary` | `X-API-Key` | org totals, by-risk, by-LLM, top categories |
| GET  | `/api/analytics/trend?days=30` | `X-API-Key` | daily average risk score |
| GET/POST/DELETE | `/api/patterns` | `X-API-Key` | org custom patterns |

```bash
curl -X POST localhost:8000/api/sync \
  -H 'X-API-Key: demo-key-sentinel' -H 'Content-Type: application/json' \
  -d '{"events":[{"timestamp":1700000000000,"llm":"ChatGPT","riskLevel":"HIGH","riskScore":90,"threatCategories":["CLOUD_API_KEY"],"threatCount":1,"userDecision":"REDACTED","processingTimeMs":1.1}]}'
```

## Tests

```bash
cd backend && source venv/bin/activate && pytest -q
```

## Design notes

- **API keys are never stored** — only their SHA-256 hash (`app/auth.py`).
- Every query is **org-scoped**; composite indexes `(org_id, timestamp)`,
  `(org_id, risk_level)`, `(org_id, llm)` mean one org never scans another's rows.
- `threat_categories` uses a portable column type so the same code runs on SQLite
  (dev) and Postgres (prod) without schema changes.
- To scale: shard `sync_events` by `org_id`, add a read replica for analytics,
  and consider TimescaleDB for the time-series trend data.
