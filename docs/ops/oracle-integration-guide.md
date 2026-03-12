# Oracle WMS/SCM Naming Convention Guide

## Overview

NIT SCS V2 follows Oracle EBS/Fusion naming conventions for all background jobs, queues, and infrastructure components. This ensures compatibility with enterprise integration patterns and familiar naming for teams experienced with Oracle WMS, SCM, and EAM modules.

## Module Prefix Reference

| Prefix | Oracle Module | NIT SCS Domain | Description |
|--------|--------------|----------------|-------------|
| `INV_` | Inventory | inventory | Stock management, cycle counts, ABC, expiry |
| `WMS_` | Warehouse Management | warehouse-ops | Zones, slotting, put-away, staging |
| `SCM_` | Supply Chain Management | inbound, outbound, compliance | SLA, reconciliation, workflow |
| `EAM_` | Enterprise Asset Management | equipment | Depreciation, AMC, vehicles |
| `ONT_` | Order & Notification Transport | notifications, system | Email, push, alerts |
| `HR_` | Human Resources | auth | Tokens, security, visitors |

## Naming Convention

### Jobs: `{MODULE}_{ENTITY}_{ACTION}`

Examples:
- `SCM_SLA_BREACH_CHECK` — Supply Chain: SLA entity, breach check action
- `INV_ABC_CLASSIFICATION` — Inventory: ABC entity, classification action
- `EAM_ASSET_DEPRECIATION` — Asset Management: asset entity, depreciation action
- `ONT_EMAIL_RETRY` — Notifications: email entity, retry action

### Queues: `{MODULE}_QUEUE`

- `INV_QUEUE`, `SCM_QUEUE`, `HR_QUEUE`, `EAM_QUEUE`, `ONT_QUEUE`
- Special: `DEAD_LETTER_QUEUE` (cross-module failed jobs)

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
| `SCM_SLA_BREACH_CHECK` | `sla_breach` | SCM_QUEUE |
| `SCM_SLA_WARNING_CHECK` | `sla_warning` | SCM_QUEUE |
| `SCM_DAILY_RECONCILIATION` | `daily_reconciliation` | SCM_QUEUE |
| `SCM_SCHEDULED_REPORTS` | `scheduled_reports` | SCM_QUEUE |
| `SCM_SCHEDULED_RULES` | `scheduled_rules` | SCM_QUEUE |
| `INV_ABC_CLASSIFICATION` | `abc_classification` | INV_QUEUE |
| `INV_LOW_STOCK_ALERT` | `low_stock` | INV_QUEUE |
| `INV_EXPIRED_LOT_CHECK` | `expired_lots` | INV_QUEUE |
| `INV_CYCLE_COUNT_AUTO` | `cycle_count_auto` | INV_QUEUE |
| `INV_GATE_PASS_EXPIRY` | `gate_pass_expiry` | INV_QUEUE |
| `INV_ANOMALY_DETECTION` | `anomaly_detection` | INV_QUEUE |
| `INV_REORDER_UPDATE` | `reorder_update` | INV_QUEUE |
| `INV_EXPIRY_ALERT` | `expiry_alerts` | INV_QUEUE |
| `INV_EXPIRY_QUARANTINE` | `expiry_quarantine` | INV_QUEUE |
| `HR_TOKEN_CLEANUP` | `token_cleanup` | HR_QUEUE |
| `HR_SECURITY_MONITOR` | `security_monitor` | HR_QUEUE |
| `HR_VISITOR_OVERSTAY` | `visitor_overstay` | HR_QUEUE |
| `EAM_ASSET_DEPRECIATION` | `asset_depreciation` | EAM_QUEUE |
| `EAM_AMC_EXPIRY` | `amc_expiry` | EAM_QUEUE |
| `EAM_VEHICLE_MAINTENANCE` | `vehicle_maintenance` | EAM_QUEUE |
| `ONT_EMAIL_RETRY` | `email_retry` | ONT_QUEUE |
| `ONT_EQUIPMENT_RETURN` | `sow_equipment_return` | ONT_QUEUE |
| `ONT_SHIPMENT_DELAYS` | `sow_shipment_delays` | ONT_QUEUE |
| `ONT_CYCLE_COUNT_ALERT` | `sow_cycle_count` | ONT_QUEUE |
| `ONT_RATE_CARD_EXPIRY` | `sow_rate_card_expiry` | ONT_QUEUE |
| `ONT_VEHICLE_MAINT_ALERT` | `sow_vehicle_maint` | ONT_QUEUE |
| `ONT_NCR_DEADLINE` | `sow_ncr_deadline` | ONT_QUEUE |
| `ONT_CONTRACT_RENEWAL` | `sow_contract_renewal` | ONT_QUEUE |
| `ONT_OVERDUE_TOOLS` | `sow_overdue_tools` | ONT_QUEUE |

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
