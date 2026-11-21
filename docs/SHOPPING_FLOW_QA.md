# Shopping flow and real-photo QA

Customer flow: find groceries by English, Bengali or common Roman Bangla terms → choose whole/cleaned/cut/custom preparation → change quantities or preparation in basket → authenticate with verified Google identity → enter delivery details and preparation instructions → review the priced-item estimate → submit without payment → open tracking and history.

Owner flow: review the saved request and instructions → provide a final inclusive quote → wait for customer acceptance → prepare → pack → assign an approved active identity/document-verified courier serving the city → record actual delivery progress. The owner cannot bypass customer quote acceptance. Cancellation does not increase stock for request-only orders. Existing paid checkout and receipt confirmation remain closed in preview.

Parcel flow: enter real sender/recipient details and package measurements → obtain an indicative quote → submit a no-payment pickup request → track the saved request. Coverage and pickup are confirmed by an owner before verified courier assignment; an estimate is not a guaranteed route or service slot.

Search tests include potato/alu/aloo/আলু, common spelling mistakes and multi-keyword clean/cut requests. Photo selection excludes AI images, diagrams, flowers used instead of edible products and unrelated cooked dishes. Real photographs are locally served with source, creator and license attribution at `/photo-credits`; they are representative ingredient/product photographs, not claims about actual TRIPPY inventory or a particular supplied brand.

All operational records use the existing database. No invented stock, couriers, payment accounts, successful transfers or automatic dispatch is seeded. Gateway payments remain disabled.

Release validation: 98 local backend tests pass; two PostgreSQL concurrency tests run in CI. Fifteen frontend tests pass. The isolated browser completed Roman Bangla search (aloo), cut preparation selection, a BDT 58 item estimate, no-payment request submission, basket clearing and persisted tracking with cutting instructions. No real customer order, payment or dispatch was simulated on the live database. There are 109 product photographs and two banner photographs with attribution; duck and red amaranth pictures are omitted because the reviewed matches did not depict the intended product accurately. Mobile/tablet viewport QA remains unverified in this browser environment.
