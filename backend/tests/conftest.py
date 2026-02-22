"""
Shared fixtures for all tests.

Fixtures are reusable setup code. Any test function can request a fixture
by adding it as a parameter — pytest injects it automatically.
"""

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def client():
    """Synchronous test client for simple HTTP tests (health check, etc.)."""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Async test client for testing async endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
