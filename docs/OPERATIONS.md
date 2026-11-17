# Operations runbook — development foundation

## Local startup

1. Docker Compose up: Postgres → API → Web.
2. Run alembic upgrade head in API container.
3. Optionally load local catalog with python -m scripts.seed_local.
4. Check health/live and health/ready, Web frontend, API docs and a quote.

No current configuration is approved for public production exposure.

## Operational roles

| Owner | Responsibility |
| --- | --- |
| Product | Pricing rules, service areas, SLAs, prohibited items, refund policy |
| Parcel Ops | Courier onboarding, routing, scans, loss/damage handling |
| Grocery Ops | Supplier procurement, QC, packing, spoilage, delivery slots |
| Backend | API, auth, transactions, domain state and migrations |
| Frontend | Customer and operator interfaces, accessibility and translations |
| Data | Schema, indexing, backup/restore and retention |
| Platform/SRE | TLS, secrets, deploy, metrics, logs, alerting and on-call |
| Security | Identity checks, incident handling, audit and privacy review |

## Incident response template

1. Classify impact: life/safety, personal data, payments, lost parcels,
   spoiled food, order outage or deadline breach.
2. Contain: disable affected route/checkout/partner or roll back release.
3. Record incident identifier and exact UTC/Bangladesh timestamps.
4. Preserve relevant audit/trace evidence with restrictive access.
5. Notify customers/partners/regulators as legally required.
6. Restore service from a tested plan; reconcile every affected order.
7. Complete root cause analysis and preventive action.

## Initial SLO targets (proposals, not measured)

- API availability: target 99.9% only after a resilient hosting design.
- Parcel on-time: target ≥95% by operating service zone.
- Grocery on-time: target ≥95% of accepted, capacity-verified slots.
- Financial reconciliation: no unexplained daily payment/COD balances.
- Tracking handover reconciliation: 100% of physical handovers scanned.

## Backups and migrations

Use hosted PITR, restore drills, tested rollback, expand/contract migrations,
separate admin/migration/app credentials, encrypted storage and fixed retention
policies before launch. Do not rely on local Docker volumes as backups.

## Smoke checks for every release

- Auth acceptance/rejection and owner isolation.
- Parcel quote, idempotent booking, tracking visibility.
- Grocery stocked/stockout checkout, cancellation/restock and cutoff boundaries.
- Audit row consistency, log correlation ID, metric/alert operation.
- Migration forward compatibility and backup restoration rehearsal.
- Courier and payment flows once those modules are implemented.
