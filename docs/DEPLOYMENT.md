# Dedicated Cloudflare + Google Cloud deployment

> Status: configuration prepared; public web/API deployment pending account access and project billing. The repository is **not** approved for accepting real orders.

## Isolation boundary

- Google Cloud project: `trippy-delivery-2026` — a new project created for this application. Never use `trippy-corporate-mobility`, NEXUS-100, Chotpot or any pre-existing project.
- Cloudflare Pages project: proposed `trippy-delivery` (create under the authorized Cloudflare account; do not reuse any Pages project).
- GitHub: `hossain0707/Trippy-Delivery-` only.
- Separate environment variables, credentials, database, logs, operational permissions and future staging/production pipelines.

## Cloudflare Pages frontend

Use Cloudflare Pages **static Next.js export**. The repository's `apps/web/next.config.ts` contains `output: "export"`.

| Field | Required value |
| --- | --- |
| GitHub repository | `hossain0707/Trippy-Delivery-` |
| Production branch for preview | `main` |
| Root directory | `apps/web` |
| Framework preset | Next.js (Static HTML Export) |
| Build command | `npm install --no-audit --no-fund && npm run build` |
| Output directory | `out` |
| Environment variable | `NEXT_PUBLIC_API_BASE_URL` = new Cloud Run API URL |

Do not use Workers to host FastAPI and do not alter an existing Cloudflare domain or deployment.

## Google Cloud Run backend

Build/deploy ONLY `services/api` from the GitHub repository.
Suggested Cloud Run service ID `trippy-delivery-api-dev`, region `asia-south1` (Mumbai).

Use Python Dockerfile: `services/api/Dockerfile`.

Environment variables:

~~~ini
APP_ENV=preview
ALLOW_DEV_AUTH=false
ACTIVE_CITIES=dhaka
CORS_ORIGINS=https://trippy-delivery.pages.dev
~~~

Set `CORS_ORIGINS` to the actual Pages hostname if different. The API middleware
blocks all real order write endpoints in `APP_ENV=preview`; only parcel
quotation calculations can be POSTed. No customer payment or booking capability
may be exposed.

**Dependency:** Cloud Run requires project billing to be enabled. As of
2026-11-17 the isolated project has no billing account attached. Do not
silently attach existing projects' billing resources or reuse their credentials.

**Database:** No dedicated production database has been provisioned yet.
The FastAPI `/health/live` endpoint can start without it, but
`/health/ready` and grocery catalog need an isolated PostgreSQL instance
and applied Alembic migrations. Configure new project-specific credentials,
managed backups, secure network and migration job before enabling those features.

## Verification checklist

1. Confirm GCP resource belongs to project `trippy-delivery-2026` and Cloudflare project is new.
2. Check deploy commit SHA matches intended GitHub `main` revision.
3. Verify Cloud Run process liveness, no real order write acceptance and public API CORS.
4. Verify the Pages app loads, parcel calculation is clearly provisional, and grocery page accurately shows catalog availability.
5. Verify failed readiness does not masquerade as functioning DB.
6. Check telemetry contains no customer phone numbers, addresses, secrets or tokens.
7. Record URLs, project IDs, region, service IDs and responsible team owners in this document.

### Production gating

This is a **read-only development preview**, not commercial delivery.
Do not switch `APP_ENV` to production or enable payment/checkout until the
`docs/PRODUCTION_READINESS.md` checklist is complete and signed off.
