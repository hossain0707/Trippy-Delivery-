# Observability domain

Application request logs are JSON emitted to stdout by core/observability.py;
audit records are a **different data product** stored transactionally in PostgreSQL.

Planned production pipeline:
- application JSON logs -> centralized collector -> restricted searchable log store
- OpenTelemetry traces/metrics -> collector -> dashboards and SLO alerts
- audit_records -> immutable restricted export with evidence retention
- external incident paging / runbook / on-call rotation

Minimum dashboards:
- API latency (p50, p95, p99), errors, saturation
- booked parcels, missed scans, unassigned orders, SLA breaches
- grocery stockouts, spoilage, missed delivery windows
- failed payments, COD settlement drift, duplicate webhooks
- authentication failures and suspicious courier scans

Never send request bodies, phones, private addresses or payment card data into logs.
Specify retention and access roles before activating centralized logging.
