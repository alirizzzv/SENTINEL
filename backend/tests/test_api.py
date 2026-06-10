"""End-to-end API tests against an isolated in-memory-ish SQLite database."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient

# Use a throwaway sqlite file before importing the app (config reads env at import).
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["SENTINEL_DATABASE_URL"] = f"sqlite:///{_tmp.name}"

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

KEY = settings.demo_api_key
HEAD = {"X-API-Key": KEY}


@pytest.fixture()
def client():
    with TestClient(app) as c:  # triggers lifespan -> init_db + seed
        yield c


def _events(n=3):
    base = 1_700_000_000_000
    return [
        {
            "timestamp": base + i * 86_400_000,
            "llm": ["ChatGPT", "Claude", "Gemini"][i % 3],
            "riskLevel": ["HIGH", "SAFE", "CAUTION"][i % 3],
            "riskScore": [90, 10, 45][i % 3],
            "threatCategories": [["CLOUD_API_KEY"], [], ["EMAIL"]][i % 3],
            "threatCount": [1, 0, 1][i % 3],
            "userDecision": ["REDACTED", "ALLOWED", "SENT_ANYWAY"][i % 3],
            "processingTimeMs": 1.2,
        }
        for i in range(n)
    ]


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_sync_requires_auth(client):
    r = client.post("/api/sync", json={"events": _events(1)})
    assert r.status_code == 401


def test_sync_rejects_bad_key(client):
    r = client.post("/api/sync", json={"events": _events(1)}, headers={"X-API-Key": "nope"})
    assert r.status_code == 401


def test_sync_and_summary(client):
    r = client.post("/api/sync", json={"events": _events(6)}, headers=HEAD)
    assert r.status_code == 200
    assert r.json()["accepted"] == 6

    s = client.get("/api/analytics/summary", headers=HEAD).json()
    assert s["total"] >= 6
    assert s["threats"] >= 1
    assert "CLOUD_API_KEY" in [c["category"] for c in s["topCategories"]]


def test_sync_validation_rejects_bad_risk(client):
    bad = _events(1)
    bad[0]["riskLevel"] = "EXTREME"
    r = client.post("/api/sync", json={"events": bad}, headers=HEAD)
    assert r.status_code == 422


def test_trend_returns_points(client):
    client.post("/api/sync", json={"events": _events(4)}, headers=HEAD)
    pts = client.get("/api/analytics/trend?days=30", headers=HEAD).json()
    assert isinstance(pts, list)
    assert all("label" in p and "value" in p for p in pts)


def test_custom_patterns_crud(client):
    created = client.post(
        "/api/patterns",
        json={"name": "Project Falcon", "pattern": "FALCON-", "category": "INTERNAL", "score": 65},
        headers=HEAD,
    ).json()
    assert created["id"]

    listed = client.get("/api/patterns", headers=HEAD).json()
    assert any(p["name"] == "Project Falcon" for p in listed)

    d = client.delete(f"/api/patterns/{created['id']}", headers=HEAD)
    assert d.status_code == 204
    after = client.get("/api/patterns", headers=HEAD).json()
    assert all(p["id"] != created["id"] for p in after)
