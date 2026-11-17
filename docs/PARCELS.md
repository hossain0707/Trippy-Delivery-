# Parcel domain — requirements and rollout

## Business scope

Primary use: documents, consumer packages, gifts and merchant parcels.
Restaurant delivery is not the primary product. Prohibited items and
hazardous/regulated categories must be excluded based on approved policy.

Approved couriers may travel by motorcycle, bicycle, on foot, car, van or
contracted transport **provided legal requirements, parcel safety and service
quality are met**. TRIPPY does not need to own a fleet to operate this model.
Staff vet partner IDs, lawful transport credentials (when applicable), training,
complaints and performance before activation.

## Quoting — intended commercial formula

Input dimensions in centimeters; weight in kilograms; destination geographic
coordinates plus validated address; declared item type; delivery priority.

1. Determine an actually active pickup/destination service route.
2. Obtain road distance and traffic ETA from an authorized route provider.
3. Calculate billable mass = max(actual kg, L×W×H / commercial volumetric divisor).
4. Apply category and dimensional handling rules.
5. Apply route base fare + distance band + billable weight + optional protection,
   service-level and congestion surcharges.
6. Apply tax and commercial pricing version. Return a quote ID, validity deadline
   and transparent breakdown; commit the server-side quote to the booking.
7. Allocate only to legally vetted eligible delivery partners with proper capacity.

**Currently implemented:** a fixed engineering tariff using an approximate
aerial-distance-derived route. It does NOT use live traffic, real courier
availability or verified road geometry. Public-facing binding tariffs require
an approved provider and commercial pricing rules.

## Nationwide routing

- Dhaka launch: first active pickup/drop zones (must be enabled by operations).
- Intercity: origin hub -> contracted trunk line -> destination hub -> verified last-mile partner.
- Rural: district -> upazila -> union collection point -> village last mile.
- Coverage statuses: planned, testing, active, suspended. Users cannot book
  merely because the location exists in the national address reference.
- Standard targets: ≤24 hours eligible same-city shipments; 3–5 days on
  supported intercity routes. Publish cutoffs, exclusions and compensation.

## Custody and anti-fraud

- A unique barcode/QR per parcel; scan on pickup, cross-dock, hub departure,
  receiving hub, last-mile assignment and delivery.
- Scan events require time, verified actor, authorized location, previous
  state, recipient evidence, and signed or auditable event ID.
- OTP confirmation must never be accepted from the same courier without
  recipient verification; design against OTP leakage and fake GPS.
- Exceptions: no answer, refused, bad address, prohibited contents,
  high-value damage, loss, stolen courier account, return-to-sender.
- Compensations, declared value, package safety and prohibited items require
  published terms before customer launch.

## Launch gate

Build and verify route provider, dispatch state machine, partner onboarding
and review, scan/OTP flow, monitoring/alerts, claims and returns. None are
fully implemented by the initial scaffold.
