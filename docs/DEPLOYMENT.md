# Dedicated Cloudflare + Google Cloud deployment

> The read-only development API is live. Cloudflare Pages provisioning requires repository access for the installed GitHub app. A separate hosted PostgreSQL database is pending.

| Resource | Preview status |
| --- | --- |
| Cloud Run service | [trippy-delivery-api-dev](https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app) in `asia-south1` |
| API documentation | [OpenAPI UI](https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app/docs) |
| Health | [Liveness](https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app/health/live) returns 200. [Readiness](https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app/health/ready) returns 503 until PostgreSQL is attached. |
| Cloudflare Pages | `trippy-delivery` is the requested project name. Verify the issued hostname before updating CORS. |
| Hosted database | Dedicated instance pending. The existing Supabase Free projects are allocated to Corporate Mobility. |

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

Billing is enabled for `trippy-delivery-2026`. Configure request-based billing, 1 vCPU, 512 MiB, 0–1 instances, concurrency 10, a 30-second timeout, and startup CPU boost off. Cloud Run and Artifact Registry free allowances are shared across the billing account. The `TRIPPY Delivery preview` budget tracks this project only. It sends alerts at 50% and 100% of a ₩1,000 monthly budget and when forecast spending reaches 100%. The alerts do not cap spending.

### Dedicated preview database

Use a separate PostgreSQL instance and restrict runtime access to the tables the preview requires. Use an operator-only migration credential for versioned Alembic migrations and store the runtime `DATABASE_URL` in project-scoped Secret Manager. Require TLS, prefer certificate verification where supported, and validate `alembic current` and `/health/ready` before importing synthetic grocery inventory. The local seed script deliberately accepts only local/test environments. Until PostgreSQL is connected, health/liveness and parcel quotes remain available while the grocery catalog is unavailable.

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
[production readiness checklist](PRODUCTION_READINESS.md) is complete and signed off.
