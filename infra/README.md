# Infrastructure ownership

The root docker-compose.yml is strictly a **local development convenience**.
It is not hardened for hosting and intentionally binds services to loopback.

Deployment decisions for staging and production remain open. Proposed modules:
- network, DNS, TLS and WAF
- managed PostgreSQL with PITR and restore drills
- API workload, web workload, asynchronous workers, job retries and outbox
- secret management, RBAC, egress restrictions, backup
- metrics, tracing, centralized logs, immutable audit export
- isolated development/staging/production resources

Do not deploy the local Compose file to the public internet. The project does
not include GitHub Actions; automation can be chosen by the team separately.
