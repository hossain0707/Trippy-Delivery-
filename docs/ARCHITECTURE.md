# Architecture and module contracts

## Architectural direction

**Modular monolith first; deployable services later.** Independent code ownership
and stable APIs matter more than premature networking between microservices.
API, web, data changes, audit, logging and operational concerns are separate.

~~~mermaid
flowchart TB
    subgraph Interfaces
        W["Next.js Customer Web"]
        MA["Future Merchant Portal"]
        RA["Future Courier App"]
        OA["Future Operations Console"]
    end
    W --> GW["FastAPI HTTP Layer"]
    MA -.-> GW
    RA -.-> GW
    OA -.-> GW
    GW --> IAM["JWT Principal / RBAC"]
    GW --> PAR["Parcel Domain"]
    GW --> GRO["Grocery Domain"]
    GW --> LOC["Coverage Domain"]
    PAR --> AUD["Transactional Audit"]
    GRO --> AUD
    PAR --> DB[("Postgres")]
    GRO --> DB
    AUD --> DB
    GW --> LOG["JSON Request Log"]
    PAR -. "Future route/traffic contract" .-> MAP["Map Provider"]
    GRO -. "Future slot-capacity contract" .-> FUL["Fulfillment / Dispatch"]
    PAR -. "Future verified assignment" .-> COU["Courier Approval & Dispatch"]
~~~

## Domain ownership table

| Module | Owns | Must not own |
| --- | --- | --- |
| parcels | quotes, booking, tracking, handover rules, parcel status | grocery stock or payment ledger |
| groceries | first-party SKUs, fresh preparation, inventory, slots, grocery order lifecycle | parcel pricing or courier approvals |
| couriers | partner identity and approval status; future availability | customer payments and order pricing |
| locations | location codes, serviceability, active routes and ETA contracts | an order's state |
| audit | append-only business evidence, actor and request correlation | mutable parcel/grocery data |
| core | auth verification, config, DB connection, logging | category-specific business rules |
| web/features/parcels | parcel UI/UX and client models | direct DB access |
| web/features/groceries | grocery UI/UX and client models | direct DB access |
| infrastructure | deployments, secrets, collection, monitoring | customer application logic |

### Import rules

- Domain modules depend on core interfaces; avoid importing one domain's ORM
  tables inside another domain's write path.
- Cross-domain workflows belong in an orchestration/application layer with
  explicit contracts and transactional design.
- Background work should use durable outbox events; never assume a successful
  HTTP request implies downstream notifications were sent.
- Read-side projections may aggregate data but cannot mutate domain owners' state.
- Share only stable types/contracts, not a global utilities dumping ground.

## Parcel lifecycle (target)

~~~mermaid
stateDiagram-v2
    [*] --> Booked
    Booked --> Assigned: verified courier accepts
    Assigned --> PickedUp: barcode scan
    PickedUp --> InTransit: custody transfer
    InTransit --> OutForDelivery
    OutForDelivery --> Delivered: recipient OTP + evidence
    Booked --> Cancelled
    Assigned --> Failed: exception/timeout
    InTransit --> Exception: lost/damaged/delayed
~~~

Only the initial **created** event is in the current code. Later transition
handlers must enforce actor roles, ordering, idempotency and scan provenance.

## Grocery lifecycle (target)

~~~mermaid
stateDiagram-v2
    [*] --> Placed
    Placed --> Reserved: stock reserved at checkout
    Reserved --> Picking
    Picking --> Processing: fresh cleaning/cutting if selected
    Processing --> QualityCheck
    QualityCheck --> Packed
    Packed --> Dispatched
    Dispatched --> Delivered: proof of delivery
    Placed --> Cancelled: restock
~~~

The current transaction combines placing the order with inventory reservation;
it does not execute real picking, inspection, payment or scheduled dispatch.

## Database and consistency

- Versioned PostgreSQL schema maintained by Alembic.
- Stock rows are locked on checkout with deterministic SKU ordering.
- Every booking or order has a customer-scoped idempotency key + request hash.
- Domain mutation and audit insert are committed in the same DB transaction.
- Foreign keys and uniqueness constraints protect core integrity.
- Later: durable outbox, job queues, reconciliation, warehouse bins, per-zone
  slot capacity, price history, partner agreements, inventory lots and expiry.

## Deployment separation

Development, staging and production must use separate credentials, DBs,
domains, environments, storage and access permissions. Deployment is blocked
until release criteria and legal/commercial operations are approved.

## Extension points

- Mapping provider: road travel-time matrix, traffic feed, cache, pricing version.
- Dispatch: eligible verified partner matching, accept/timeout/reassignment, capacity.
- Payments: local gateway adapters and signed webhook processing.
- Grocery fulfillment: warehouse tasks, processing variants, freshness rules.
- Nationwide coverage: Bangladesh geo hierarchy, active intercity line-haul links,
  route/cutoff configuration and village collection points.
- Observability: OpenTelemetry metrics/traces and immutable audit export.

See ROADMAP.md and PRODUCTION_READINESS.md for implementation sequencing.
