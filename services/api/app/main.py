from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import is_ready
from app.core.observability import RequestAuditMiddleware, configure_logs
from app.modules.groceries.router import router as groceries
from app.modules.parcels.router import router as parcels

configure_logs()
config = settings()
app = FastAPI(
    title="TRIPPY Delivery API",
    version="0.1.0",
    docs_url="/docs" if config.app_env != "production" else None,
)
app.add_middleware(RequestAuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in config.cors_origins.split(",") if s.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Dev-Actor"],
    allow_credentials=False,
)


@app.middleware("http")
async def preview_write_guard(request: Request, call_next):
    # Explicit hosted-preview mode: accept calculation requests but never mutate data.
    if config.app_env == "preview" and request.method not in ("GET", "HEAD", "OPTIONS"):
        if not (request.method == "POST" and request.url.path == "/api/v1/parcels/quote"):
            return JSONResponse(
                status_code=503,
                content={"detail": "TRIPPY Delivery read-only preview: orders are disabled."},
            )
    return await call_next(request)


app.include_router(parcels, prefix="/api/v1")
app.include_router(groceries, prefix="/api/v1")


@app.get("/health/live", tags=["Health"])
def live():
    return {"status": "ok", "environment": config.app_env}


@app.get("/health/ready", tags=["Health"])
def ready():
    try:
        is_ready()
    except Exception as error:
        raise HTTPException(503, "Database unavailable") from error
    return {"status": "ready"}
