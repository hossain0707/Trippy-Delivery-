# Owner workspace

`/admin` now presents one green-and-ivory operations workspace. The former raw-record preview is no longer mounted. Customer storefront cards, imagery, preparation options and checkout behavior are unchanged.

## Sections

- Overview: database-derived order counts, fixed COD balances, recent orders and last-seven-day order volumes in Bangladesh time. Preview archives and unknown final quotes are excluded from live balances. No illustrative business records, ratings, profit values or growth percentages are injected.
- Orders: server-side search, status filtering and 20-record pagination. Preview archive is opt-in. Detail drawer shows items, address, preparation notes, cost breakdown and event history. COD quote approval, stock confirmation, courier assignment and exact cash/delivery controls use existing protected APIs. Only applicable actions are offered; the backend remains authoritative.
- Products: searchable/category-filtered inventory and price table, thumbnails from the existing product photo renderer, add/edit product form and owner price approval. Photography and preparation controls remain available in an expandable panel. Edits preserve existing product details.
- Parcels: searchable tracking list, pickup/recipient details, package dimensions, history and existing request-dispatch controls. Legacy launch-gated parcels are identified rather than exposing nonworking fulfillment controls.
- Couriers: existing private identity/document review and activation controls, with saved customer names where available rather than raw identity subjects.
- Customers: masked contacts in the list, saved profile/address/preferences and recent orders in an owner-only detail drawer. No fabricated customer creation bypasses verified Google identity.
- Settings: existing COD/payment configuration, preparation tariffs, delivery policies and support settings. Online payment integration remains disabled in hosted preview.
- Activity: readable commerce event timeline without actor identifiers, internal hashes or JSON dumps.

## Protection and verification

All `/admin/workspace/*` routes depend on `require_admin`. Customer access is rejected; customer/contact detail retrieval requires owner authorization. Existing database infrastructure and migrations are unchanged. Server-side pagination caps each list at 20 records and validates bounds; search has bounded input. Dialogs support Escape, keyboard focus containment and focus restoration. Tables scroll within their cards on small displays.

Core navigation, summaries and selected controls support English/Bengali; advanced existing settings retain English field labels. No authentication credentials or payment secrets enter the views. Browser sign-in is still via the verified Google owner account. Database-backed mutations continue using existing server validation and audit events.

Tests cover owner-only access, pagination and archive filtering, private-field omission, masked customer list contacts, live overview calculations, no synthetic empty-state data and Bengali product search. The existing COD and persistence suite continues to validate state changes and cash collection.
