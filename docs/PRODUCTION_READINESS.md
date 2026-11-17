# Production readiness gate — NOT PASSED

This file is deliberately explicit so team members and future operators cannot
mistake an engineering scaffold for an authorized live delivery business.

## Implemented foundation

- [x] Domain-separated backend and frontend structure
- [x] PostgreSQL models and initial Alembic migration
- [x] JWT validation with issuer/audience/JWKS checks
- [x] Local-only opt-in developer identity for testing
- [x] Parcel provisional quote and idempotent booking, owner-only tracking
- [x] Grocery fresh/dry catalog, processing validation, stock reservation/cancel
- [x] Bangladesh-local grocery cutoff calculations and unit tests
- [x] Transactional audit model and structured request logs
- [x] Health probes and local Docker Compose preview
- [x] Contributor guide, review checklist and architecture documents

## BLOCKERS — before any real customer ordering

### Compliance and agreements
- [ ] Verify company/trade registrations and courier-specific Bangladesh permits.
- [ ] Food handling, hygiene, storage, labeling and any required approvals.
- [ ] Courier contracts, insurance/parcel liability, terms, privacy notice, complaints.
- [ ] Prohibited items, vulnerable customers and cash-handling procedures.

### Platform security
- [ ] Configure real identity provider and verify production login UI end to end.
- [ ] Secure role administration, staff MFA, partner onboarding/KYC/approval.
- [ ] PII encryption/access limits, retention/purge and privacy impact review.
- [ ] Rate limiting, DDoS/WAF, security testing, dependency scanning, secret management.
- [ ] Tamper-evident custody logs, immutable audit export and incident response.

### Parcel operations
- [ ] Real road routing, live traffic, availability feeds and verified dispatch matching.
- [ ] Price versioning, service zones, weight/size verification, cutoff/holiday policies.
- [ ] Pickup scan, hub custody, last-mile OTP/proof, returns and compensation.
- [ ] Intercity carrier and village networks with physically verified routes.

### Grocery operations
- [ ] Procurement/supplier contracts and real supplier pricing.
- [ ] Warehouse stock receiving, lot/expiry, fresh handling, FEFO and QC.
- [ ] Preparation workflow, weight-adjustment policy, substitutions and refund logic.
- [ ] Delivery slot capacity, cutoffs, dispatch, holiday exceptions, temperature safety.
- [ ] Customer cart/checkout frontend and notifications.

### Financial and infrastructure
- [ ] Payment gateway integrations, signed webhook verification, refunds, COD settlements.
- [ ] Financial ledger, fraud checks, reconciliation, taxes and invoices.
- [ ] Separate staging/production, managed DB/PITR, DR and restore drills.
- [ ] Distributed tracing, central logs, monitoring, alerting and SLO dashboards.
- [ ] Locked dependencies, reproducible builds, QA/UAT, stress and load testing.
- [ ] Production domain/TLS, mobile app validation, accessibility and Bangla QA.
- [ ] On-call rotation, runbooks, incident drill and rollback sign-off.

## Acceptance decision

Release requires signed approval by business operations, security, platform,
backend, QA and legal/compliance owners. A GitHub merge alone is NOT approval.

Until all customer-critical items pass, keep real order intake and live
payments disabled. See OPERATIONS.md and ROADMAP.md.
