# Market prices and shopping update — 21 November 2026

The owner requested current Bangladesh market-based selling prices and a usable shopping experience. The initial selection uses 41 matched Dhaka retail comparisons checked on 21 November 2026. This is a dated comparison, not an automated live market feed or a claim of a single national price. Branded comparators and processed products are explicitly identified in each source basis.

Source pages: [vegetables](https://chaldal.com/fresh-vegetable), [fruit](https://chaldal.com/fresh-fruit), [meat](https://chaldal.com/meat-new), [rice](https://chaldal.com/rices), [daily items](https://chaldal.com/top-items).

Prices and quantity conversions are stored in `services/api/catalog/market-prices-2026-11-21.json`. The startup importer applies them once to untouched zero-price, zero-stock products, records provenance and keeps subsequent owner price/unit edits. Changing prices creates no inventory. Piece, bundle and pack products are no longer incorrectly sold by kilograms. Unsupported product matches are left unpriced rather than guessed.

The basket accepts priced products for planning even when inventory has not yet been confirmed. Unpriced products can be saved to the shopping list; they are explicitly excluded from the priced subtotal and are never presented as free. The UI explicitly states this is not a reservation. Server checkout continues requiring approved prices, actual stock, configured delivery coverage, operational capacity and enabled payment methods. The configuration endpoint lists missing setup conditions so checkout does not silently appear broken.

Real commercial activation still needs actual available quantities (or an explicitly agreed procure-to-order business model), preparation capability, service areas/fees, courier capacity and COD or verified receiving details. Owner approval to launch is now given, but these operational facts remain missing. No stock, courier capacity or payment account is invented. No Cloud Run environment was changed to accept unfulfillable orders.
