# Security, audit and logs

## Three distinct concerns

1. **Authentication and authorization** — core/auth.py verifies signed JWT
   and derives principal. Admin status must only be issued by the trusted
   identity issuer. A future internal roles database is recommended.
2. **Business audit** — modules/audit/models.py writes actor, action, entity,
   request ID and minimally necessary metadata in the same transaction as
   an order or parcel mutation.
3. **Operational logs** — core/observability.py emits JSON stdout entries
   with method, path, status, duration and generated request ID. It does not
   record payloads, request headers, phones or addresses.

Do not confuse request logs with legally defensible parcel custody records;
the latter require cryptographically verifiable events and complete scan
evidence beyond the current scaffold.

## Sensitive data inventory

- Parcel sender and recipient name, phone, precise address/coordinates.
- Grocery recipient name, phone and physical delivery address.
- Courier identity/approval evidence (pending implementation).
- Payment reference, payout details, COD liabilities (pending implementation).
- Fresh groceries preferences and order history.

Data protection plan must include clear notices, retention policy, approved
processor contracts, purpose limitation, access review, incident response,
encrypted backups, separate roles and data subject request workflows.

## Threat cases

- Fake couriers / false delivery claims and OTP phishing.
- Fraudulent location information and fake scans.
- Cross-customer order reads and invalid admin privileges.
- Overselling due to simultaneous checkout or cancellation race.
- Replayed purchase, payment and webhook events.
- Sensitive data leakage from crash traces, dashboards or vendors.
- Suspicious edits to pricing, bank payout destinations or courier status.

## Before launch

- Configure a trusted identity provider and backend role mapping.
- Strict admin approval process for couriers.
- Encrypt sensitive data, restrict read access, use short-lived credentials.
- Implement tamper-evident/append-only audit export with retention rules.
- Deploy WAF/rate limits, distributed tracing, metrics, alerting, SAST,
  dependency/secret scanning and incident runbooks.
- Back up and prove restore with least-privileged DB users.
- External security review and privacy/legal sign-off.
