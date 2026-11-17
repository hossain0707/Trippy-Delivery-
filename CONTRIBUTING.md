# Contributing to TRIPPY Delivery

Thank you for working on the platform. **Preserving clear ownership boundaries** is a stronger priority than squeezing all features into one module.

## Branches and workflow

1. Create a branch from the latest main: feat/parcel-pricing, feat/grocery-slots, fix/audit-event, docs/architecture.
2. Keep a PR scoped to one subsystem or cross-module contract. For any database change, include a migration and rollback plan.
3. Run relevant tests and builds locally. No GitHub Actions are enabled by default.
4. Open a PR using the provided checklist. Request a reviewer from the affected subsystem.
5. Use squash merge after review. Do not force-push shared branches.
6. Never commit production secrets, real Bangladeshi customer data, bearer tokens, or private courier documents.

## Team responsibilities

| Area | Source of truth | Review expectation |
| --- | --- | --- |
| Web UI | apps/web/app, apps/web/features | Web lead |
| Parcel API | services/api/app/modules/parcels | Parcel lead |
| Grocery API | services/api/app/modules/groceries | Grocery/fulfillment lead |
| Partner operations | services/api/app/modules/couriers | Operations + security |
| DB schema | services/api/alembic/versions | Backend + data reviewer |
| Auth, security | services/api/app/core/auth.py, SECURITY.md | Security reviewer |
| Audit/observability | modules/audit, core/observability.py, infra/observability | Backend + operations |
| Cloud/deployment | infra/ and deployment configs | Platform lead |
| OpenAPI/contracts | docs/API.md | All affected consumers |

Do not import another domain's ORM model just to update its data. Instead, create a public domain service or an event contract; document ownership changes in an architecture decision.

## Definition of done

- No endpoint relies on demo traffic, demo auth, or fake payment logic in a production release.
- Domain tests, input validation, and negative authorization cases pass.
- Document API request/response changes and add versioned migrations.
- For order/stock changes, test idempotency and concurrent checkout behavior.
- For parcel tracking changes, test custody permissions, duplicate scans and delivery proof.
- For user data changes, update privacy/retention notes and logging exclusions.
- Review operational impact: alerts, rollback, key rotation and backup compatibility.
- Screenshots for frontend changes, with both desktop and mobile widths.
- At least one independent reviewer approves.

## Local commands

~~~bash
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed_local
docker compose exec api python -m pytest -q
~~~

To run tests in the container, the development extras must be installed (the release image intentionally omits them). Preferred developer command:

~~~bash
cd services/api && pip install -e ".[dev]" && pytest -q && ruff check .
cd ../../apps/web && npm install && npm run typecheck && npm run build
~~~

## Commit messages

Use descriptive Conventional Commits: feat(parcels): ..., fix(groceries): ..., docs: ..., chore(infra): ....

## Review rules

PR description must contain: context, touched modules, schema changes, test evidence, security impact, rollback steps and release-gate implications.

This repository does not currently grant production deployment rights simply because code was merged. Deployment requires the documented release approval checklist.
