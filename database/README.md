# Database ownership

PostgreSQL is the transactional source of truth. ORM models live with their owning
domain in services/api/app/modules. **Alembic migrations are the only supported
schema change mechanism** and live in services/api/alembic/versions.

Key tables:
- parcels, parcel_events — parcel domain
- products, grocery_orders, grocery_order_lines — groceries
- delivery_partners — approved partner lifecycle (onboarding not yet implemented)
- audit_records — audit domain

Migration protocol:
1. Change the owning model, add an explicit versioned migration.
2. Review constraints, indexes and backward compatibility.
3. Test upgrade on a fresh DB and against an existing seeded DB.
4. Back up before release. Use expand/migrate/contract for breaking changes.
5. Do not run metadata.create_all in production.

Needed before live use: PII minimization/encryption, retention/purge jobs, partitioning
and immutable audit export, soft deletes where necessary, backup/restore verification,
standby failover, replication/connection pool sizing, and permissions by service identity.
