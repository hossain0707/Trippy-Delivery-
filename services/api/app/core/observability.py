import json
import logging
import time
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname, "logger": record.name,
            "message": record.getMessage(),
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
        })


def configure_logs():
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)


class RequestAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = str(uuid4())
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logging.getLogger("http").exception("request_failed request_id=%s",
                                                request.state.request_id)
            raise
        response.headers["X-Request-ID"] = request.state.request_id
        logging.getLogger("http").info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%d",
            request.state.request_id, request.method, request.url.path,
            response.status_code, int((time.perf_counter()-started)*1000),
        )
        # Do not log payloads, authorization headers, addresses or phone numbers.
        return response
