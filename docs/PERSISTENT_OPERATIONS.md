# Persistent preview operations

Customer identity comes from a signed, audience-checked Google ID token with a verified email. Profiles use the Google subject as their immutable key; customers cannot submit identity or role fields. Tokens remain in React memory and are cleared on sign-out. A reload requires Google sign-in again; profile and order records remain in PostgreSQL. Google ID tokens expire and require sign-in again.

Owner administration requires the configured verified Google email. `GOOGLE_ADMIN_SUBJECT` optionally pins the same account's immutable Google subject. Token-supplied admin roles are ignored. Every `/api/v1/admin` route has the owner dependency, including list, catalog, courier and status operations.

## Database change

Apply `alembic upgrade head` with the existing backend database secret before releasing the new image. Migration `0002_customer_profiles` adds `customer_profiles` and nullable `parcels.courier_id`; it preserves existing tables and records. Do not rerun initial setup or replace infrastructure. Run `alembic check` after applying it. Existing `0001_initial` remains the migration parent.

## API and pages

- `/account`: persistent profile, language preference, owner-filtered grocery and parcel history, real parcel tracking.
- `/admin`: database counts, products, order records, parcels, courier registration/approval, audit records. Collection APIs provide bounded 100-row pages using `offset`.
- `PUT /api/v1/admin/products/{sku}` persists bilingual names, category, units, prices, preparation fees, inventory and availability. Fresh preparation supports whole, cleaned, cut-only and cut; dry goods reject preparation fees.
- `PUT /api/v1/admin/couriers/{id}` records approval and the approving owner; courier identity cannot be changed.
- Assignment validates an approved courier. Parcel and grocery status updates enforce transitions with row locks; parcel events and grocery status audits commit with the records.
- Grocery storefront loads the backend inventory; a failed request displays an error instead of sample inventory.

## Preview restrictions

Keep `APP_ENV=preview` and `ALLOW_DEV_AUTH=false`. The middleware allows quote calculations and authenticated profile, catalog and courier edits. Order placement, cancellation, assignment and fulfillment status writes remain blocked. No payment endpoint is enabled. Dashboard operational flags remain false. Status workflows are tested in the isolated test environment, never by dispatching live orders.

## Verification and release

Run `pytest -q services/api/tests`, frontend `npm ci --ignore-scripts`, `npm run lint`, and `npm run build`. The checked-in GitHub Actions workflow repeats backend tests and frontend checks. Existing Cloud Build handles backend deployment on `main`; existing Cloudflare Pages handles the static frontend. Both must retain their existing Google client configuration. No new paid services are required.

Local API regression tests use SQLite and signed test Google tokens. They verify persistence across request sessions and identity isolation, not real Google browser sign-in or PostgreSQL contention. Two-account Google login, authenticated responsive views, and cross-deployment persistence need live verification. The catalog requires owner-supplied inventory and prices; this change does not silently import sample products. Traffic-aware dispatch and road routing remain outside this release.
