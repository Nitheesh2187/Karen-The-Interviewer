"""
API tests for the health endpoint.

This is the simplest test — no mocking needed.
It hits the real FastAPI app but doesn't need any external services.
"""


def test_health_returns_200(client):
    """GET /health should return 200 with status ok."""
    # ACT — make the request
    response = client.get("/health")

    # ASSERT — check the response
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
