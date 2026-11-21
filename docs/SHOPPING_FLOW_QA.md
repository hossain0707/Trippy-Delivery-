# Original shopping flow QA — 21 November 2026

The baseline is commit `9149d42`, before the rejected storefront and request/quote changes. The original CSS layout (with real-photo background URLs), page sections, rotating banner, grocery navigation, basket heading and checkout form are restored. Photo paths, search and functional calculator fixes are applied within that structure.

Browser QA used the isolated local database and explicit test-only identities. Searching `aloo` found potatoes, selecting cut and cleaned and quantity 2 produced a basket amount of BDT108: BDT58 ingredients plus BDT50 preparation. Checkout added the isolated BDT60 delivery tariff, displayed BDT168, saved preview order `TRP-38615514B96D` and cleared the basket. These service fees are controlled test values, not published TRIPPY tariffs.

Ten additional backend cases cover decimal calculation, promotions, preview persistence, scoped/idempotent submission, stale-price rejection, missing prices and rates, quantity/preparation validation, owner-only tariff edits and per-product tariff precedence. Existing regression and PostgreSQL concurrency cases remain in CI. Frontend search, profile and basket unit tests remain enabled.

The production artifact excludes internal QA controls. Payments, inventory reservation and dispatch remain disabled for preview checkouts. The owner subsequently set cleaning BDT10/kg, cutting only BDT15/kg and cleaning plus cutting BDT20/kg, with transparent food-safe wrapping. Delivery is BDT30 within Uttara plus BDT5/km outside Uttara. Rates and the base area are owner-editable. Outside-area preview calculations use an explicitly entered distance, not automatic road routing. Duck and red amaranth photos remain omitted because the reviewed matches were unsuitable. Fresh real-account Google sign-in and mobile/tablet viewport inspection remain unverified in this release.

Browser checks with the owner-approved tariffs also verified 2 kg potatoes with cutting only: BDT58 items + BDT30 preparation + BDT30 Uttara delivery = BDT118. Changing the area to Dhanmondi and explicitly entering 12 km uses BDT90 delivery (30 + 5×12).
