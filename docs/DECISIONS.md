# Architecture decisions

### ADR-001 — Modular monolith, explicit business boundaries
Decision: a single API deployment initially, with parcel, groceries, courier,
location, audit and core modules separated. Independent deployments can evolve
from contracts once actual scaling requires them.

### ADR-002 — PostgreSQL as transactional source
Decision: transactional order state, stock reservation and audit all commit
in one PostgreSQL transaction. Alembic controls schema changes.

### ADR-003 — Separate business delivery rules
Decision: parcels use route/mass/size and partner matching. Groceries use
first-party inventory, fresh preparation and capacity-verified time slots.
Never mix these pricing or dispatch rules.

### ADR-004 — Nationwide schema, Dhaka operating launch
Decision: national geography may exist in data but only activated regions and
routes can accept bookings. Future city coverage must be operations-approved.

### ADR-005 — Flexible legally compliant couriers
Decision: verified delivery persons choose suitable legal transportation.
No TRIPPY-owned fleet requirement; approval and credential verification still apply.

### ADR-006 — Safe publication standards
Decision: README distinguishes implemented primitives from future operations;
local auth, estimated fares and provisional deadlines must not be marketed as
verified production service.

### ADR-007 — No default GitHub Actions
Decision: provide clear manual tests and review gates now. The team may select
CI/CD later without mixing cloud deployment configuration into domain modules.
