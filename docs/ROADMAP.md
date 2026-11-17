# Development and rollout roadmap

This is a delivery sequence and acceptance checklist, not a promised date.

## Stage 0 — Current repository foundation

- Modular FastAPI API and Next.js web preview.
- Parcel estimates/bookings/tracking and grocery inventory/order primitives.
- Versioned DB schema, audit/log separation and local Docker environment.
- Basic boundary tests and development documentation.

Exit: API/DB and UI boot in a clean environment; passing unit tests and
verified migrations. Live-customer acceptance remains disabled.

## Stage 1 — Dhaka parcel pilot

- Finalize Bangladeshi courier licences, contracts and restrictions.
- Service-zone activation, real geocoding/distance/traffic and signed tariffs.
- Delivery-partner KYC/verification, scheduling, availability, matching.
- Scan-based parcel custody state machine, OTP and proof-of-delivery.
- Claims/returns, support, on-time dashboards, fraud review.
- Pilot with controlled merchants and test shipments; test SLA targets.

## Stage 2 — Dhaka TRIPPY Groceries

- First-party supplier procurement, warehouse workflows and QC.
- Fresh processing (whole/raw, cleaned and cut), packaging and cold handling.
- Dry grocery inventory, stock lots, substitutions and units of measure.
- Capacity-backed before-1-PM/1-to-9-PM/after-9-PM cutoff dispatch.
- Real cart, checkout and payment; order tracking, notifications and refunds.
- Merchant inventory price checks, service areas, wastage and incident metrics.

## Stage 3 — Dhaka scale

- Throughput/stress, privacy/security review and 24-hour delivery reliability.
- Multi-hub zoning, supply chain batch optimization and partner capacity.
- Operations console, fraud controls, performance-based payout and COD.
- Data retention and signed daily financial reconciliation.

## Stage 4 — Nationwide parcel expansion

- Activate verified city-to-city routes, district hubs and contracted line-haul.
- Upazila and village partner/pickup point coverage by verified availability.
- Explicit route SLAs, schedule exceptions and return logistics.
- Keep unsupported districts/routes disabled in checkout.

## Stage 5 — Mature platform

- Courier and merchant mobile apps, analytics/forecasting, route optimization,
  recommendation engine, multilingual accessibility, B2B APIs and accounting.
- Scalable worker/queue/event-outbox services only when operationally justified.

Each stage needs a named business/engineering owner, acceptance tests and
operational sign-off before entering the next stage.
