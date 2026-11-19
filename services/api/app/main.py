from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.auth import Actor, get_actor, require_admin
from app.core.config import settings
from app.core.database import is_ready
from app.core.observability import RequestAuditMiddleware, configure_logs
from app.modules.groceries.router import router as groceries
from app.modules.parcels.router import router as parcels
from app.modules.operations.router import router as operations

configure_logs()
config = settings()
app = FastAPI(
    title="TRIPPY Delivery API",
    version="0.1.0",
    docs_url="/docs" if config.app_env != "production" else None,
)


@app.middleware("http")
async def preview_write_guard(request: Request, call_next):
    # Explicit hosted-preview mode: accept calculation requests but never mutate data.
    if config.app_env == "preview" and request.method not in ("GET", "HEAD", "OPTIONS"):
        allowed = (request.method == "POST" and request.url.path == "/api/v1/parcels/quote") or (request.method == "PUT" and (request.url.path == "/api/v1/account/profile" or request.url.path.startswith(("/api/v1/admin/products/", "/api/v1/admin/couriers/"))))
        if not allowed:
            return JSONResponse(
                status_code=503,
                content={"detail": "TRIPPY Delivery read-only preview: orders are disabled."},
            )
    response = await call_next(request)
    if request.url.path.startswith(("/api/v1/account", "/api/v1/admin", "/api/v1/parcels/")):
        response.headers["Cache-Control"] = "no-store"
    return response


app.add_middleware(RequestAuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in config.cors_origins.split(",") if s.strip()],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Dev-Actor"],
    allow_credentials=False,
)


app.include_router(parcels, prefix="/api/v1")
app.include_router(groceries, prefix="/api/v1")
app.include_router(operations, prefix="/api/v1")


@app.get("/api/v1/account", tags=["Account"])
def account(actor: Actor = Depends(get_actor)):
    return JSONResponse(
        {"name": actor.name, "email": actor.email, "is_admin": "admin" in actor.roles},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/v1/admin/session", tags=["Admin"])
def admin_session(actor: Actor = Depends(require_admin)):
    return JSONResponse(
        {"name": actor.name, "email": actor.email, "is_admin": True},
        headers={"Cache-Control": "no-store"},
    )


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
