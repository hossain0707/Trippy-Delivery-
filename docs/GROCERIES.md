# TRIPPY Groceries — inventory-owned vendor

## Two top-level categories

**1. Fresh Groceries**
- Vegetables, fruits, fish, seafood, chicken, beef, mutton and other fresh items.
- Unprocessed / raw / whole: e.g., whole rohu, whole chicken, whole potatoes.
- Processed (item-specific): cleaned, scaled, gutted or cut fish;
  washed/cut vegetables; cleaned/portioned meat and poultry.
- Processing service fee, weight loss/yield rules, handling hygiene, packaging,
  shelf life and customer consent must be specified per SKU/preparation.

**2. Dry Groceries & Essentials**
- Rice, lentils/dal, flour, cooking oil, sugar, salt, spices, tea, snacks,
  packaged products, beverages, household consumables and essentials.
- These are not the "processed" side of Fresh Groceries.

TRIPPY is the main merchant/vendor, responsible for sourcing, owning inventory,
price setting, quality control, storage, substitutions, refunds and fulfillment.

## Proposed grocery delivery schedule — Bangladesh time

| Order timestamp | Provisional deadline |
| --- | --- |
| Before 13:00 | Same day by 21:00 |
| 13:00 up to but not including 21:00 | Next day by 09:00 |
| 21:00 onward | Next day by 21:00 |

The cutoff rule is implemented in Asia/Dhaka. It is not a slot booking engine:
inventory/courier/warehouse capacity, holidays, unavailable products and
remote zone restrictions must gate any real promises.

## Warehouse process (target)

Supplier purchase order -> receive stock -> weigh -> lot/batch and expiry
record -> temperature-sensitive storage -> FIFO/FEFO allocation ->
customer order placed -> reserve stock -> pick -> fresh cleaning/cutting ->
quality/weight confirmation -> pack -> route batch -> verify handover ->
delivered -> reconciliation.

Fresh items may have actual packed weight variations; settlement needs a
clear quantity-adjustment and customer approval policy. Spoilage, cold-chain,
cross-contamination and allergen management require trained staff and safe
facilities.

## Current backend constraints

- Stores product names in Bangla/English, fresh/dry category, unit, price,
  preparation fee, active flag and inventory quantity.
- Checkout checks positive quantity, duplicate SKU, appropriate preparation,
  and available stock. Row locks protect stock reservation.
- Order idempotency and limited cancellation/restocking are implemented.
- Sample seed values are synthetic local preview data, never live prices.
- Payment capture, delivery fees, taxes, substitutions, warehouse picking,
  expiration, packed-weight changes, refunds, dispatch and live SLA capacity
  are not implemented. Do not enable real customer checkout until complete.
