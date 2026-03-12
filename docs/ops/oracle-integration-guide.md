# Oracle WMS/SCM Naming Convention Guide

## Overview

NIT SCS V2 follows Oracle EBS/Fusion naming conventions for all background jobs, queues, and infrastructure components. This ensures compatibility with enterprise integration patterns and familiar naming for teams experienced with Oracle WMS, SCM, and EAM modules.

## Module Prefix Reference

| Prefix | Oracle Module | NIT SCS Domain | Queue | Description |
|--------|--------------|----------------|-------|-------------|
| `SCM_` | Supply Chain Management | inbound, outbound, compliance | WMS_QUEUE | SLA, reconciliation, workflow |
| `INV_` | Inventory | inventory | INV_QUEUE | Stock management, cycle counts, ABC, expiry |
| `WMS_` | Warehouse Management | warehouse-ops | WMS_QUEUE | Zones, slotting, put-away, staging |
| `EAM_` | Enterprise Asset Management | equipment | WMS_QUEUE | Depreciation, AMC, vehicles |
| `ONT_` | Order & Notification Transport | notifications, system | NOTIF_QUEUE | Email, push, alerts |
| `HR_` | Human Resources | auth | AUD_QUEUE | Tokens, security, visitors |

## Naming Convention

### Jobs: `{MODULE}_{ENTITY}_{ACTION}`

Examples:
- `SCM_SLA_BREACH_CHECK` — Supply Chain: SLA entity, breach check action
- `INV_ABC_CLASSIFICATION` — Inventory: ABC entity, classification action
- `EAM_ASSET_DEPRECIATION` — Asset Management: asset entity, depreciation action
- `ONT_EMAIL_RETRY` — Notifications: email entity, retry action

### Queues: Oracle WMS Module Alignment

| Queue | Oracle Module | Purpose |
|-------|--------------|---------|
| `WMS_QUEUE` | WMS | Core WMS operations, SLA, reconciliation, assets |
| `RCV_QUEUE` | RCV | Receiving — GRN, ASN, putaway |
| `INV_QUEUE` | INV | Inventory management |
| `SHIP_QUEUE` | WSH | Shipping execution |
| `CUST_QUEUE` | CUST | Customs clearance |
| `ASN_QUEUE` | ASN | Advanced shipping notices |
| `GRN_QUEUE` | GRN | Goods receipt notes |
| `PICK_QUEUE` | PICK | Picking, wave planning |
| `PUT_QUEUE` | PUT | Putaway, slotting |
| `AUD_QUEUE` | AUD | Audit & compliance |
| `NOTIF_QUEUE` | NOTIF | Notifications, email, alerts |
| `DEAD_LETTER_QUEUE` | — | Failed jobs (cross-module) |

### Rules

1. Always use UPPER_SNAKE_CASE
2. Prefix MUST match the Oracle module the job belongs to
3. Entity name should be singular (e.g., `ASSET` not `ASSETS`)
4. Action should be a verb or verb phrase (e.g., `CHECK`, `RETRY`, `CLASSIFICATION`)
5. Priority follows Oracle Concurrent Program conventions (1 = highest, 99 = lowest)

## Job-to-Legacy Name Mapping

Every Oracle-named job maps to a legacy handler name for backward compatibility:

| Oracle Job Name | Legacy Handler | Queue |
|----------------|----------------|-------|
| `SCM_SLA_BREACH_CHECK` | `sla_breach` | WMS_QUEUE |
| `SCM_SLA_WARNING_CHECK` | `sla_warning` | WMS_QUEUE |
| `SCM_DAILY_RECONCILIATION` | `daily_reconciliation` | WMS_QUEUE |
| `SCM_SCHEDULED_REPORTS` | `scheduled_reports` | WMS_QUEUE |
| `SCM_SCHEDULED_RULES` | `scheduled_rules` | WMS_QUEUE |
| `INV_ABC_CLASSIFICATION` | `abc_classification` | INV_QUEUE |
| `INV_LOW_STOCK_ALERT` | `low_stock` | INV_QUEUE |
| `INV_EXPIRED_LOT_CHECK` | `expired_lots` | INV_QUEUE |
| `INV_CYCLE_COUNT_AUTO` | `cycle_count_auto` | INV_QUEUE |
| `INV_GATE_PASS_EXPIRY` | `gate_pass_expiry` | INV_QUEUE |
| `INV_ANOMALY_DETECTION` | `anomaly_detection` | INV_QUEUE |
| `INV_REORDER_UPDATE` | `reorder_update` | INV_QUEUE |
| `INV_EXPIRY_ALERT` | `expiry_alerts` | INV_QUEUE |
| `INV_EXPIRY_QUARANTINE` | `expiry_quarantine` | INV_QUEUE |
| `HR_TOKEN_CLEANUP` | `token_cleanup` | AUD_QUEUE |
| `HR_SECURITY_MONITOR` | `security_monitor` | AUD_QUEUE |
| `HR_VISITOR_OVERSTAY` | `visitor_overstay` | AUD_QUEUE |
| `EAM_ASSET_DEPRECIATION` | `asset_depreciation` | WMS_QUEUE |
| `EAM_AMC_EXPIRY` | `amc_expiry` | WMS_QUEUE |
| `EAM_VEHICLE_MAINTENANCE` | `vehicle_maintenance` | WMS_QUEUE |
| `ONT_EMAIL_RETRY` | `email_retry` | NOTIF_QUEUE |
| `ONT_EQUIPMENT_RETURN` | `sow_equipment_return` | NOTIF_QUEUE |
| `ONT_SHIPMENT_DELAYS` | `sow_shipment_delays` | NOTIF_QUEUE |
| `ONT_CYCLE_COUNT_ALERT` | `sow_cycle_count` | NOTIF_QUEUE |
| `ONT_RATE_CARD_EXPIRY` | `sow_rate_card_expiry` | NOTIF_QUEUE |
| `ONT_VEHICLE_MAINT_ALERT` | `sow_vehicle_maint` | NOTIF_QUEUE |
| `ONT_NCR_DEADLINE` | `sow_ncr_deadline` | NOTIF_QUEUE |
| `ONT_CONTRACT_RENEWAL` | `sow_contract_renewal` | NOTIF_QUEUE |
| `ONT_OVERDUE_TOOLS` | `sow_overdue_tools` | NOTIF_QUEUE |

## Adding New Jobs

1. Choose the correct Oracle module prefix
2. Add the name to `JOB_NAMES` in `infrastructure/queue/job-definitions.ts`
3. Add the legacy mapping to `JOB_LEGACY_MAP`
4. Add the full definition to `JOB_DEFINITIONS` array
5. Register the handler in the appropriate domain job file (`domains/{domain}/jobs/`)
6. The scheduler will auto-register the new job on next restart

## Oracle Priority Mapping

| NIT Priority | Oracle Equivalent | Usage |
|-------------|-------------------|-------|
| 1 | Immediate/Emergency | SLA breach, email retry |
| 2-3 | High/Normal | Stock alerts, security, reconciliation |
| 4-5 | Standard | Maintenance checks, scheduled reports |
| 6-8 | Low/Deferred | Weekly calculations (ABC, depreciation) |
