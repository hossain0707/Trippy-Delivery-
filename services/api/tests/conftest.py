from test_order_integration import client as client  # noqa: PLC0414

import pytest

from app.core.rate_limit import WriteRateLimit
from app.main import app


@pytest.fixture(autouse=True)
def isolate_request_rate_limits():
    """Each test gets fresh counters while preview rate limiting remains exercised."""
    middleware = app.middleware_stack
    while middleware is not None:
        if isinstance(middleware, WriteRateLimit):
            middleware.buckets.clear()
        middleware = getattr(middleware, "app", None)
