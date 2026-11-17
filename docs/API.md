# API contract — version 0.1.0 (development)

Base prefix: /api/v1. In local mode, Swagger is at /docs.

## Current endpoints

| Method | Route | Authentication |
| --- | --- | --- |
| GET | /health/live | public |
| GET | /health/ready | public |
| POST | /api/v1/parcels/quote | public |
| POST | /api/v1/parcels | signed JWT, Idempotency-Key |
| GET | /api/v1/parcels/{tracking_code} | owner or admin JWT |
| GET | /api/v1/groceries/products | public |
| POST | /api/v1/groceries/orders | signed JWT, Idempotency-Key |
| POST | /api/v1/groceries/orders/{id}/cancel | owner or admin JWT |

JWT must verify against trusted JWKS, issuer and audience. Local/test can
opt into X-Dev-Actor, but staging and production reject that configuration.

### Example: provisional parcel quote

~~~bash
curl -X POST http://localhost:8000/api/v1/parcels/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "sender": {"name":"Example A","phone":"01700000000","address_line":"Mirpur 10, Road 1",
      "city":"Dhaka","latitude":23.82,"longitude":90.365},
    "recipient": {"name":"Example B","phone":"01800000000","address_line":"Dhanmondi Road 2",
      "city":"Dhaka","latitude":23.745,"longitude":90.375},
    "package":{"category":"general","weight_kg":1,"length_cm":25,"width_cm":20,"height_cm":10}
  }'
~~~

Response includes BDT amount, provisional flag, approximate road distance
and billable mass. This is engineering demonstration pricing only.

### Example: local-only booking

~~~bash
curl -X POST http://localhost:8000/api/v1/parcels \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: local-sample-001' \
  -H 'X-Dev-Actor: local-demo-user' \
  -d '{
    "sender":{"name":"Example A","phone":"01700000000","address_line":"Mirpur 10, Road 1",
      "city":"Dhaka","latitude":23.82,"longitude":90.365},
    "recipient":{"name":"Example B","phone":"01800000000","address_line":"Dhanmondi Road 2",
      "city":"Dhaka","latitude":23.745,"longitude":90.375},
    "package":{"category":"document","weight_kg":0.5,"length_cm":22,"width_cm":15,"height_cm":1}
  }'
~~~

Never send live personal data in demos. Reusing an idempotency key with a
different payload returns HTTP 409.

### Example: local-only grocery checkout

~~~bash
curl -X POST http://localhost:8000/api/v1/groceries/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: local-grocery-001' \
  -H 'X-Dev-Actor: local-demo-user' \
  -d '{
    "destination":{"name":"Example A","phone":"01700000000",
      "address_line":"Mirpur 10, Dhaka","city":"Dhaka"},
    "items":[
      {"sku":"FISH-ROHU","quantity":"1.500","preparation":"cut"},
      {"sku":"RICE","quantity":"2.000","preparation":"none"}
    ]
  }'
~~~

Response contains total BDT and a **provisional** delivery deadline.
Checkout reserves sample stock but does not collect payment or dispatch a
courier. Real payments must be implemented through a certified gateway.

## Common error classes

- 401 unauthenticated or invalid JWT
- 404 order not found / not owned by requester
- 409 idempotency mismatch, booking conflict, insufficient stock or invalid cancellation
- 422 invalid form input, inactive city/route, invalid preparation or unavailable SKU
- 503 DB or identity configuration unavailable

## Contract evolution

Maintain backward compatibility within v1 where possible, add schema
integration tests, and publish OpenAPI snapshots for frontend consumers.
Avoid using raw database ORM models as public APIs.
