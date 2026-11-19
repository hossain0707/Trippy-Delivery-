# TRIPPY Delivery commerce operations

## Release posture

This is a preview release, not an approved commercial launch. `APP_ENV=preview`, `LIVE_ORDERS_ENABLED=false` and `PILOT_APPROVED=false` keep customer order writes and fulfillment closed. Automated payment gateways are not implemented or enabled. Changing database settings alone cannot open ordering, and `preview` stays closed even if both environment flags are accidentally set.

The designated Google owner is `najmul.eee1996@gmail.com`. Google signatures, audience, issuer, expiration and verified email are checked on the backend. All owner routes have the owner dependency. Session credentials stay in memory; a browser reload may require Google reauthentication. Client-side visibility is not an authorization boundary.

## Owner operating sequence

1. Sign in at `/admin`. Use **Product content** for English/Bengali descriptions, department, image, packaging, seasonal notes, quantity increments and per-product preparation options. Enable only preparation the operation can actually provide. Configure the fee per ordered unit and expected yield; customers are charged on ordered weight, with final prepared weight explicitly estimated.
2. In **products**, choose an SKU, set actual price and stock, and mark **Actual selling price approved by owner** only after business verification. `Active` controls catalog visibility; stock and price approval independently control purchase availability. Never treat catalog content as verified inventory.
3. Review image accuracy and usage rights. The import reuses existing repository photographs where available and leaves other images empty. It does not assert ownership or a license for existing assets. Replace or clear any unverified photo before launch. Use repository-relative `/products/...` or `/preparation/...` paths. An image upload/media hosting service is not included.
4. Under **Payment methods**, enter genuine receiving details and instructions. Verify the destination independently before checking **verified** and **enabled**. Placeholder and all-zero receiving accounts cannot be enabled. COD does not require an advance transfer.
5. Under **Delivery zones & support**, add each Dhaka area, actual delivery fee, realistic per-slot order capacity, and verified preparation/courier capacity. Enter support contacts and English/Bengali announcements. Create offers with an explicit code, percent and minimum item spend; no offers are enabled by default.
6. Under **Partner review**, check identity and required documents through a verified private process. The application endpoint never approves a courier. Record the review result and service cities, then mark eligible approved partners active. No public identity-document upload is offered.
7. After separate owner go-live approval, use **Order fulfillment** to review each submitted order. Verify actual transfer receipts before confirming prepaid orders. Confirm COD collection only after delivery. Use a receipt reference and the exact order total; amount mismatches and repeated confirmations are rejected.

## Fulfillment and payment

The fulfillment flow is submitted (`placed`, displayed as pending review) → confirmed → preparing → packed → assigned → out for delivery → delivered. Rejection and failure require a reason. Rejection restores reserved stock; a paid rejected, cancelled or failed order becomes `refund_required`. This flag does not execute or claim a refund. Refund handling requires an authorized operator's real-world action and a documented reconciliation process.

Payment is separate: COD starts `unpaid`; bKash, Nagad, Rocket and bank transfers start `pending_verification`. Entering a reference never marks an order paid. Owner receipt confirmation records an audit event. Simulated confirmation is accepted only in `APP_ENV=test` and yields `test_paid`, never a real payment state.

Inventory locks are taken in deterministic SKU order. Order writes, lines, stock changes and audit events commit together. Keys are scoped to the customer and request digest, so repeated submissions reuse the original order and changed payloads are rejected. Recheck stock and slot availability when placing an order; a review is not a reservation.

## Bangladesh schedule

| Submission in Asia/Dhaka | Target deadline, subject to operational capacity |
| --- | --- |
| Before 13:00 | Same day 21:00 |
| 13:00 through before 21:00 | Next day 09:00 |
| 21:00 onward | Next day 21:00 |

Configured area coverage, preparation readiness, courier readiness and capacity must all be confirmed. Slot admission is serialized through a locked pilot settings row in PostgreSQL. Address comparisons for capacity are case-insensitive. Do not promise a slot merely because a static cutoff calculation exists.

Parcel quotations use dimensions, weight, map coordinates and approximate road distance. They do not use live road routing, traffic or GPS. Same-city 24h and intercity 3–5 days are targets, not guaranteed promises. Existing active-city configuration continues to restrict booking coverage. Owner assignment and eligible assigned couriers can record events; unrelated and unapproved couriers cannot update shipments.

## Catalog import

The versioned source is `services/api/catalog/bd-groceries-v1.json` (111 SKUs). Import with:

```bash
cd services/api
PYTHONPATH=. python scripts/import_catalog.py
```

The importer inserts missing SKUs, preserves existing rows and owner edits, and never fabricates approved prices or stock. Every seed has zero price, zero stock and `price_approved=false`. Fresh preparation options start with whole/raw enabled and processed choices disabled until configured. Descriptions, variants, units and photos remain owner-editable. A zero price is displayed as awaiting approval, never a free selling price.

## Deployment and rollback

The existing GitHub Actions workflow runs backend tests, frontend tests, lint and build. The existing Cloud Build trigger deploys the backend image on `main`; the existing Cloudflare Pages integration builds the frontend. No new service, project or paid storage is required.

Container startup acquires a PostgreSQL transaction advisory lock, applies reviewed Alembic migrations, runs the schema-drift check, and imports missing catalog entries inside the same database transaction before starting the HTTP server. Migration failure prevents the new revision becoming ready. Existing deployed instances continue to use the old schema-compatible image while the new additive migration is applied. The migration adds product metadata, payment/order fields, courier review metadata, settings and commerce events; it does not remove old operational tables or records.

`GET /health/ready` reports the schema revision; `GET /health/live` reports the Cloud Run revision and environment. Keep the existing Secret Manager database reference, Google client, owner email and CORS origins. Never put credentials in source or frontend variables.

For a code rollback, route traffic to the last verified Cloud Run revision and redeploy the previous Cloudflare Pages build. Keep the additive database migration. Do not downgrade or drop payment/order columns after they contain data. Investigate migration failures without printing the database URL. A schema rollback requires a separate, reviewed recovery decision.

Before a pilot, verify the existing Neon account's backup retention and restoration capability and perform an isolated restore drill. This release does not claim that backups or a restore drill were verified, and it does not provision a new paid backup service.

## QA and limits

Run `pytest -q services/api/tests` after installing `services/api[dev]`. Two PostgreSQL concurrency tests are optional and skip unless `TRIPPY_TEST_DATABASE_URL` is supplied. They create uniquely named temporary `trippy_qa_...` schemas in an existing test database and remove only those schemas. Run them with `APP_ENV=test`; never point isolated test overrides at operational tables.

For a controlled browser environment, build with `NEXT_PUBLIC_API_BASE_URL='' NEXT_PUBLIC_INTERNAL_QA=true`, then run `PYTHONPATH=services/api python scripts/serve_isolated_qa.py --port 4173`. This separate QA process uses a temporary SQLite database, explicit fake identities and controlled stock/receiving details. It is outside the deployed Docker context. Never set `NEXT_PUBLIC_INTERNAL_QA` in Cloudflare. Rebuild normally before release. The deployed API has no fake identity override and still verifies real Google tokens.

The in-process write limiter is bounded and provides best-effort per-instance protection, not a distributed abuse-prevention service. Configure and test suitable platform-level controls before a larger launch. Operational reporting currently provides live counts and event history rather than a financial reconciliation ledger.
