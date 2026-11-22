# Customer account, tracking and verified purchasing

This release implements the approved My Account, order history and stock-aware admin concepts without modifying storefront cards or preparation selectors. No sample records, prices or stock are seeded.

## Customer experience

- Account overview groups the saved profile, default address and delivery/preparation preferences. Profile edits use the existing verified-Google-scoped API and explicitly save reusable details; checkout continues auto-filling them.
- My orders separates active orders, completed/cancelled history and optional preview archives. Search and pagination run on the server and are restricted to the signed-in subject. Internal request hashes and idempotency keys are omitted.
- Order tracking displays progress, preparation/item information, a price breakdown, final-price approval, cancellation before preparation and separate COD payment information.
- Tracking refreshes every 15 seconds; lists refresh every 20 seconds. Focus and visibility changes trigger rechecks. Hidden views pause polling, stopped views cannot receive stale updates and network failures show retry messages. This is polling, not a promise of push notifications, SMS or email.

## Admin purchasing workflow

Existing stocked orders can still be confirmed by reserving actual available inventory. The order drawer now shows required quantity, verified available quantity, shortfall and whether the order already holds a reservation. Insufficient inventory disables direct stock confirmation and explains the reason.

For groceries acquired after receiving an order:

1. Owner accepts the order with **Confirm & mark awaiting purchase**, without creating stock or claiming the goods are available. The customer sees **Confirmed · awaiting purchase**. An unsettled final quote must be accepted by the customer first.
2. Owner records actual newly received quantities for every ordered item, a receipt note and explicit verification. Existing inventory plus received quantities must cover all order lines. A zero receipt is allowed for items supplied entirely from existing verified stock.
3. Receipt recording locks the order and products, adds received quantities, reserves the order quantities and changes status to **Purchased** in one transaction. Identical retries do not add stock again. Conflicting requests cannot bypass status checks.
4. Owner starts preparation, then packing, verified courier assignment and delivery. Exact COD cash collection remains atomic with delivery completion.
5. Cancellation before preparation returns only inventory actually reserved. Cancellation while awaiting purchase cannot invent stock.

If an accepted final quote has insufficient stock, customer approval now records acceptance and moves the order to awaiting purchase. Customers no longer have to retry price approval after the store buys inventory. Inactive products still block acceptance.

## Inventory and authorization

The inline stock-count action requires the actual count, verification and note. It compares the submitted previous count under a database lock; stale counts are rejected instead of overwriting concurrent reservations. All availability, count, receipt and fulfillment APIs enforce the designated owner role. No database schema changes or infrastructure are required. `APP_ENV=preview` and disabled online-payment integration are preserved.

## Validation

Tests cover procurement authorization, insufficient/unverified receipts, atomic stock changes, repeat receipt submission, stale stock counts, cancellation, customer-scoped order history and polling cancellation/stale responses. PostgreSQL CI tests concurrent duplicate receipt submissions. No real purchases, stock edits or customer-order transitions are performed during release verification.

## TRIPPY team grocery delivery

Packed grocery orders can move directly to out for delivery through owner-only controls. Courier selection is not required. Existing assigned orders remain compatible. Parcel assignment stays separate. Completing a COD delivery still requires the exact cash amount and recipient acknowledgement; payment stays unpaid until then.
