from collections import OrderedDict, deque
from time import monotonic

from fastapi.responses import JSONResponse

from app.core.config import settings


class WriteRateLimit:
    """Best-effort per-instance limiter; use provider-level controls for distributed enforcement."""

    def __init__(self, app):
        self.app = app
        self.buckets = OrderedDict()

    async def __call__(self, scope, receive, send):
        if (
            settings().app_env not in ("test", "local")
            and scope["type"] == "http"
            and scope["method"] not in ("GET", "HEAD", "OPTIONS")
        ):
            key = (scope.get("client") or ("unknown",))[0]
            now = monotonic()
            bucket = self.buckets.setdefault(key, deque())
            self.buckets.move_to_end(key)
            while bucket and bucket[0] < now - 60:
                bucket.popleft()
            if len(bucket) >= 90:
                await JSONResponse(
                    {"detail": "Too many requests; try again shortly."},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )(scope, receive, send)
                return
            bucket.append(now)
            if len(self.buckets) > 10000:
                self.buckets.popitem(last=False)
        await self.app(scope, receive, send)
