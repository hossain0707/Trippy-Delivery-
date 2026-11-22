# Checkout and saved customer details

The owner approved the three-column basket, delivery and summary layout on 22 November 2026. Narrow screens use Basket → Delivery → Review. The approved storefront preparation selectors, photo switching, generated-image labels and packaging previews are unchanged.

Customer defaults remain scoped to the verified Google subject in the existing `customer_profiles` table. Migration `0004_checkout_defaults` adds one non-null JSON column with an empty-object default and preserves older records. No infrastructure is recreated. Profile defaults include address, area, city, postal code, delivery instructions, preparation instructions and a preferred payment method. Name, phone and language remain in their existing profile fields.

`GET /api/v1/account/profile` returns defaults. `PUT /api/v1/account/profile` explicitly saves them. Older clients that omit the new field retain saved defaults. Identity and roles cannot be submitted. Unknown nested fields, payment credentials and oversized values are rejected. Payment preference is an enum only; PINs, passwords, OTPs and transaction references are not profile fields.

Checkout reads the profile after Google verification. It fills untouched fields, preserves edits if a request returns late, and refreshes untouched values when the window regains focus. There are two choices: use changes for this order only (the default), or save them to the profile. Saving is available independently of order review; choosing to save also persists defaults when reviewing. A failed profile load blocks profile writes until retry succeeds, preventing accidental erasure of unknown defaults. Account/profile edits are reflected at the next checkout on any device after authentication.

Promotions, transaction references and manually entered per-order distance are not reused as profile defaults. Quote responses are discarded if the basket or destination changes while a request is outstanding. Final totals come from the backend, and the current UI can create preview orders only. Missing preparation weights link back to the appropriate expanded basket item.

Validation covers profile persistence and customer isolation, legacy updates, sensitive-field rejection, additive migration of populated profiles, PostgreSQL session persistence, payload allowlisting and late-load/edited-field behavior. The full catalog preview coverage tests remain in place.

Deployment must retain `APP_ENV=preview`; live payments and real fulfillment remain disabled. Actual Google-account save/reload verification requires an authenticated browser session; isolated automated tests do not replace that account-level check.

## Verified release checks

131 backend tests and 27 frontend tests passed in CI, including PostgreSQL and migrations. A real existing customer Google session verified profile-to-checkout autofill, preservation of profile defaults after one-order edits, saving from checkout, and persistence after signing out and signing back in. Temporary QA values were restored to the original profile field values. No order or payment was created. Desktop three-column geometry and all mobile steps were checked at 337 CSS pixels with no horizontal overflow. Review request errors are shown in the delivery step on narrow screens as well as the summary.
