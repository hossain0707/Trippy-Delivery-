# Security policy

This repository is a development foundation, not a live payment or courier system.

## Reporting vulnerabilities

Use the repository's **private GitHub Security Advisory** reporting channel, if enabled by the repository administrator. Do not publish live vulnerabilities, real identity documents, secrets, or customer records in public issues.

## Supported environments

Production releases: **none yet**. The first supported production release will be declared only after the documented launch gates are satisfied.

## Nonnegotiable controls

- Keep local X-Dev-Actor bypass disabled in staging and production; configuration blocks it.
- Verify JWT issuer, audience, expiry and signing key from trusted JWKS before authorizing.
- Use least-privilege database credentials and a dedicated migration identity in hosted deployments.
- Use TLS, key rotation, private networking, data retention and encrypted backups.
- Never log addresses, phone numbers, inventory supplier details, tokens or payment credentials.
- Avoid caching sensitive responses in shared caches.
- Deliveries require verified custody and recipient proof before real parcels are accepted.
- Payments/COD require signed webhook verification, reconciliation, refund policy and dispute handling before go-live.
- Audit export and append-only/tamper-evident storage are a prelaunch requirement, beyond the in-DB event log implemented now.

See docs/SECURITY_AUDIT.md and docs/PRODUCTION_READINESS.md.
