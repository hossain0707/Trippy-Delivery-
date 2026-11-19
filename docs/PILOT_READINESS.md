# Dhaka pilot GO / NO-GO

**Recommendation: NO-GO for real customer ordering until the owner completes and approves the following gates.** The preview and catalog may be published while these gates remain open.

| Gate | Required evidence |
| --- | --- |
| Actual catalog and stock | Owner-approved prices, accurate inventory, units, variants and preparation capacity for each purchasable SKU |
| Image rights and accuracy | Review all reused images; supply missing photographs and retain licenses/ownership evidence |
| Delivery operation | Verified areas, fees, service targets, preparation capacity and approved active couriers |
| Receiving accounts | Independently verified bKash/Nagad/Rocket or bank details; COD cash reconciliation procedure |
| Customer support | Published verified support contacts and cancellation/refund handling procedure |
| Security | Owner-only privileged access, customer/courier isolation, expiry and failure tests passing |
| Database | Additive migration and schema check successful; PostgreSQL concurrency tests executed against isolated schemas |
| Recovery | Existing backup retention verified and an isolated restore drill completed |
| Browser QA | Nonempty checkout, payments, tracking, owner and courier workflows at mobile, tablet and desktop widths |
| Final approval | Owner reviews evidence and explicitly approves Dhaka go-live |

Activation requires a separate change to a non-preview environment plus `LIVE_ORDERS_ENABLED=true` and `PILOT_APPROVED=true`, retaining verified payment and delivery settings. Do not activate on the strength of automated tests alone. Automated gateway payments remain disabled.

Missing media, real inventory, actual receiving details, operational capacity and owner approval are genuine external dependencies, not fabricated business data. A software release is not proof that commercial operations are ready.
