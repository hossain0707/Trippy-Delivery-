# Cash-on-delivery checkout

The owner authorized COD order intake and fulfillment on 22 November 2026. `APP_ENV=preview` remains unchanged. The preview write guard now permits only the dedicated COD intake, quote acceptance, cancellation and owner fulfillment routes; ordinary checkout and online receipt/payment endpoints remain closed.

Migration `0005_cod_checkout` enables only `payments.cod_enabled` once, preserving all other payment configuration. The owner can close new COD intake at Admin → Payment methods; later deployments do not reset this choice. Existing accepted orders can still be fulfilled after intake closes. No infrastructure is created.

## Workflow

1. Customer reviews the server calculation and places a COD order. It persists as `placed` / `unpaid` and appears in the owner Orders tab and customer history. Idempotency prevents duplicate submissions. Stock is not invented or reserved yet; proposed times are not confirmed delivery slots.
2. If pricing is complete, the owner checks inventory and confirms. Confirmation atomically reserves available inventory. Insufficient verified inventory blocks confirmation, not order intake.
3. If a piece/bundle needs weighing or a price/delivery fee is missing, the order still reaches the owner. The amount displayed is explicitly a known estimate. Owner weighs/checks availability, enters a complete final total and a breakdown note, and sends a final quote. The customer must accept that exact current quote on the tracking page; acceptance reserves stock and confirms the order. Owner cannot bypass customer approval. Confirmed orders cannot be repriced.
4. Owner advances confirmed → preparing → packed → assigned, choosing an active identity/document-verified courier covering the destination city.
5. The assigned courier sees the recipient/address and COD amount on `/courier`, records out for delivery, then enters the exact cash collected and recipient acknowledgement to mark delivered. Delivery and `paid` commit together, with one cash-collection event. Wrong/missing cash amounts and duplicate completion are rejected. Owner may record the same operation with acknowledgement and exact cash amount.
6. Customer cancellation before preparation is idempotent and restores only actually reserved inventory. Delivered customer contact details are withheld from courier history.

## Limitations

Online providers have no verified gateway callbacks/integration in this release and remain disabled. Selecting an online preference in the profile does not charge it: this checkout explicitly uses COD. Payment preferences contain no account credentials. Successful online payment must eventually be verified server-side before a future gateway can mark paid; a browser redirect or client claim is insufficient.

Outside-Uttara distance remains an entered estimate, not automatic road routing. Owner must verify it and send a final quote if the total changes. Stock must be entered from real availability; catalog seed does not invent inventory. Physical delivery, real cash collection and real Google courier/owner identities cannot be proven by automated tests. No real customer purchase or cash receipt is generated during release verification.

## Validation

Backend tests cover persistence, owner/customer/courier isolation, stale prices, online-payment rejection in hosted-preview rules, store-weighed quotes, exact-amount acceptance, stock shortages, atomic delivery/cash collection, duplicate completion, cancellation and activation migration preservation. PostgreSQL CI additionally checks competing COD confirmations cannot oversell. Frontend tests, lint and production build run through the existing pipeline.
