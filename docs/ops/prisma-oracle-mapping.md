# Prisma → Oracle Table Mapping Reference

> Phase 5 artifact — maps every Prisma model to its Oracle WMS/Logistics table name.

## Naming Convention — Logistics-Only Prefixes

| Oracle Module Prefix | Domain | Examples |
|---|---|---|
| `FND_` | Foundation | Settings, Counters, Auth, Suppliers, Employees, Projects, Workflows |
| `MTL_` | Materials/Inventory | Items, Onhand, Lots, Transfers, Surplus, Scrap, Cycle Counts |
| `RCV_` | Receiving | GRN Headers/Lines, ASN, Inspections, Discrepancies |
| `ONT_` | Order Management | MI Headers/Lines, MRN, Requisitions |
| `WSH_` | Shipping | Deliveries, Transport Orders |
| `WMS_` | Warehouse Management | Zones, Bins, Gate Passes, Equipment, Assets, Staging, Packing |
| `CUST_` | Customs | Customs Tracking, Documents, Tariffs |

## Full Model → Table Mapping

### 01-reference.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Region` | `FND_REGIONS` | FND |
| `City` | `FND_CITIES` | FND |
| `Port` | `WSH_PORTS` | WSH |
| `UnitOfMeasure` | `MTL_UNITS_OF_MEASURE` | MTL |
| `WarehouseType` | `WMS_WAREHOUSE_TYPES` | WMS |
| `EquipmentCategory` | `WMS_EQUIPMENT_CATEGORIES` | WMS |
| `EquipmentType` | `WMS_EQUIPMENT_TYPES` | WMS |
| `ApprovalWorkflow` | `FND_APPROVAL_WORKFLOWS` | FND |

### 02-master-data.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Entity` | `FND_LEGAL_ENTITIES` | FND |
| `Project` | `FND_PROJECTS` | FND |
| `Employee` | `FND_EMPLOYEES` | FND |
| `Supplier` | `FND_SUPPLIERS` | FND |
| `Warehouse` | `WMS_WAREHOUSES` | WMS |
| `Item` | `MTL_SYSTEM_ITEMS` | MTL |
| `Generator` | `WMS_GENERATORS` | WMS |
| `EquipmentFleet` | `WMS_FLEET_VEHICLES` | WMS |

### 03-inbound.prisma (5 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Mrrv` | `RCV_RECEIPT_HEADERS` | RCV |
| `MrrvLine` | `RCV_RECEIPT_LINES` | RCV |
| `Rfim` | `RCV_INSPECTION_HEADERS` | RCV |
| `OsdReport` | `RCV_DISCREPANCY_HEADERS` | RCV |
| `OsdLine` | `RCV_DISCREPANCY_LINES` | RCV |

### 04-outbound.prisma (10 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Mirv` | `ONT_ISSUE_HEADERS` | ONT |
| `MirvLine` | `ONT_ISSUE_LINES` | ONT |
| `Mrv` | `ONT_RETURN_HEADERS` | ONT |
| `MrvLine` | `ONT_RETURN_LINES` | ONT |
| `GatePass` | `WMS_GATE_PASSES` | WMS |
| `GatePassItem` | `WMS_GATE_PASS_ITEMS` | WMS |
| `MaterialRequisition` | `ONT_REQUISITION_HEADERS` | ONT |
| `MrfLine` | `ONT_REQUISITION_LINES` | ONT |
| `StockTransfer` | `MTL_TRANSFER_HEADERS` | MTL |
| `StockTransferLine` | `MTL_TRANSFER_LINES` | MTL |

### 05-job-orders.prisma (9 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `JobOrder` | `WMS_JOB_ORDERS` | WMS |
| `JoTransportDetail` | `WMS_JO_TRANSPORT_DETAILS` | WMS |
| `JoRentalDetail` | `WMS_JO_RENTAL_DETAILS` | WMS |
| `JoGeneratorDetail` | `WMS_JO_GENERATOR_DETAILS` | WMS |
| `JoScrapDetail` | `WMS_JO_SCRAP_DETAILS` | WMS |
| `JoEquipmentLine` | `WMS_JO_EQUIPMENT_LINES` | WMS |
| `JoSlaTracking` | `WMS_JO_SLA_TRACKING` | WMS |
| `JoApproval` | `WMS_JO_APPROVALS` | WMS |
| `JoPayment` | `WMS_JO_PAYMENTS` | WMS |

### 06-inventory.prisma (4 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `InventoryLevel` | `MTL_ONHAND_QUANTITIES` | MTL |
| `InventoryLot` | `MTL_LOT_NUMBERS` | MTL |
| `LotConsumption` | `MTL_LOT_CONSUMPTIONS` | MTL |
| `LeftoverMaterial` | `MTL_LEFTOVER_MATERIALS` | MTL |

### 07-logistics.prisma (6 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Shipment` | `WSH_DELIVERY_HEADERS` | WSH |
| `CustomsTracking` | `CUST_TRACKING` | CUST |
| `ShipmentLine` | `WSH_DELIVERY_LINES` | WSH |
| `SupplierEquipmentRate` | `FND_SUPPLIER_EQUIPMENT_RATES` | FND |
| `DepreciationEntry` | `WMS_DEPRECIATION_ENTRIES` | WMS |
| `TariffRate` | `CUST_TARIFF_RATES` | CUST |

### 08-system.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `DocumentCounter` | `FND_DOCUMENT_COUNTERS` | FND |
| `AuditLog` | `FND_AUDIT_LOG` | FND |
| `Notification` | `FND_NOTIFICATIONS` | FND |
| `PushSubscription` | `FND_PUSH_SUBSCRIPTIONS` | FND |
| `Task` | `FND_TASKS` | FND |
| `TaskComment` | `FND_TASK_COMMENTS` | FND |
| `PasswordResetCode` | `FND_PASSWORD_RESET_CODES` | FND |
| `CompanyDocument` | `FND_COMPANY_DOCUMENTS` | FND |

### 09-workflow.prisma (4 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `SystemSetting` | `FND_SYSTEM_SETTINGS` | FND |
| `Workflow` | `FND_WORKFLOWS` | FND |
| `WorkflowRule` | `FND_WORKFLOW_RULES` | FND |
| `WorkflowExecutionLog` | `FND_WORKFLOW_EXECUTION_LOGS` | FND |

### 10-email-dashboard.prisma (11 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `EmailTemplate` | `FND_EMAIL_TEMPLATES` | FND |
| `EmailLog` | `FND_EMAIL_LOGS` | FND |
| `Dashboard` | `FND_DASHBOARDS` | FND |
| `DashboardWidget` | `FND_DASHBOARD_WIDGETS` | FND |
| `SavedReport` | `FND_SAVED_REPORTS` | FND |
| `RefreshToken` | `FND_REFRESH_TOKENS` | FND |
| `DocumentComment` | `FND_DOCUMENT_COMMENTS` | FND |
| `ApprovalStep` | `FND_APPROVAL_STEPS` | FND |
| `DelegationRule` | `FND_DELEGATION_RULES` | FND |
| `Attachment` | `FND_ATTACHMENTS` | FND |
| `UserView` | `FND_USER_VIEWS` | FND |

### 11-v2-modules.prisma (24 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Imsf` | `MTL_INTERNAL_TRANSFERS` | MTL |
| `ImsfLine` | `MTL_INTERNAL_TRANSFER_LINES` | MTL |
| `BinCard` | `WMS_BIN_CARDS` | WMS |
| `BinCardTransaction` | `WMS_BIN_CARD_TRANSACTIONS` | WMS |
| `RentalContract` | `WMS_RENTAL_CONTRACTS` | WMS |
| `RentalContractLine` | `WMS_RENTAL_CONTRACT_LINES` | WMS |
| `GeneratorFuelLog` | `WMS_GENERATOR_FUEL_LOGS` | WMS |
| `GeneratorMaintenance` | `WMS_GENERATOR_MAINTENANCE` | WMS |
| `SurplusItem` | `MTL_SURPLUS_ITEMS` | MTL |
| `ScrapItem` | `MTL_SCRAP_ITEMS` | MTL |
| `SscBid` | `MTL_SSC_BIDS` | MTL |
| `Tool` | `WMS_TOOL_REGISTRY` | WMS |
| `ToolIssue` | `WMS_TOOL_ISSUES` | WMS |
| `WarehouseZone` | `WMS_ZONES` | WMS |
| `BinLocation` | `WMS_BIN_LOCATIONS` | WMS |
| `StorekeeperHandover` | `WMS_STOREKEEPER_HANDOVERS` | WMS |
| `PutAwayRule` | `WMS_PUT_AWAY_RULES` | WMS |
| `CycleCount` | `MTL_CYCLE_COUNT_HEADERS` | MTL |
| `CycleCountLine` | `MTL_CYCLE_COUNT_LINES` | MTL |
| `AdvanceShippingNotice` | `RCV_ASN_HEADERS` | RCV |
| `AsnLine` | `RCV_ASN_LINES` | RCV |
| `CrossDock` | `WMS_CROSS_DOCKS` | WMS |
| `InspectionChecklist` | `WMS_INSPECTION_CHECKLISTS` | WMS |
| `InspectionChecklistItem` | `WMS_INSPECTION_CHECKLIST_ITEMS` | WMS |

### 12-advanced-ops.prisma (21 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `ParallelApprovalGroup` | `FND_PARALLEL_APPROVAL_GROUPS` | FND |
| `ParallelApprovalResponse` | `FND_PARALLEL_APPROVAL_RESPONSES` | FND |
| `DockDoor` | `WMS_DOCK_DOORS` | WMS |
| `YardAppointment` | `WMS_YARD_APPOINTMENTS` | WMS |
| `TruckVisit` | `WMS_TRUCK_VISITS` | WMS |
| `Sensor` | `WMS_SENSORS` | WMS |
| `SensorReading` | `WMS_SENSOR_READINGS` | WMS |
| `SensorAlert` | `WMS_SENSOR_ALERTS` | WMS |
| `RolePermission` | `FND_ROLE_PERMISSIONS` | FND |
| `DynamicDocumentType` | `FND_DYNAMIC_DOCUMENT_TYPES` | FND |
| `DynamicFieldDefinition` | `FND_DYNAMIC_FIELD_DEFINITIONS` | FND |
| `DynamicDocument` | `FND_DYNAMIC_DOCUMENTS` | FND |
| `DynamicDocumentLine` | `FND_DYNAMIC_DOCUMENT_LINES` | FND |
| `DynamicDocumentHistory` | `FND_DYNAMIC_DOCUMENT_HISTORY` | FND |
| `CustomDataSource` | `FND_CUSTOM_DATA_SOURCES` | FND |
| `CustomFieldDefinition` | `FND_CUSTOM_FIELD_DEFINITIONS` | FND |
| `CustomFieldValue` | `FND_CUSTOM_FIELD_VALUES` | FND |
| `WorkflowTemplate` | `FND_WORKFLOW_TEMPLATES` | FND |
| `AiConversation` | `FND_AI_CONVERSATIONS` | FND |
| `AiMessage` | `FND_AI_MESSAGES` | FND |
| `AiSuggestion` | `FND_AI_SUGGESTIONS` | FND |

### 13-warehouse-ops.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `PackingSession` | `WMS_PACKING_SESSIONS` | WMS |
| `PackingLine` | `WMS_PACKING_LINES` | WMS |
| `StagingAssignment` | `WMS_STAGING_ASSIGNMENTS` | WMS |
| `LaborStandard` | `WMS_LABOR_STANDARDS` | WMS |
| `NavigationOverride` | `FND_NAVIGATION_OVERRIDES` | FND |
| `SemanticMeasure` | `FND_SEMANTIC_MEASURES` | FND |
| `SemanticDimension` | `FND_SEMANTIC_DIMENSIONS` | FND |
| `NotificationPreference` | `FND_NOTIFICATION_PREFERENCES` | FND |

### 14-equipment-compliance.prisma (7 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `EquipmentDeliveryNote` | `WMS_DELIVERY_NOTES` | WMS |
| `EquipmentReturnNote` | `WMS_RETURN_NOTES` | WMS |
| `SupplierEvaluation` | `FND_SUPPLIER_EVALUATIONS` | FND |
| `SupplierEvaluationMetric` | `FND_SUPPLIER_EVALUATION_METRICS` | FND |
| `TransportOrder` | `WSH_TRANSPORT_ORDERS` | WSH |
| `TransportOrderItem` | `WSH_TRANSPORT_ORDER_ITEMS` | WSH |
| `VisitorPass` | `FND_VISITOR_PASSES` | FND |

### 15-sow-modules.prisma (12 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `LoginAttempt` | `FND_LOGIN_ATTEMPTS` | FND |
| `AnnualMaintenanceContract` | `WMS_MAINTENANCE_CONTRACTS` | WMS |
| `Asset` | `WMS_ASSET_REGISTER` | WMS |
| `AssetTransfer` | `WMS_ASSET_TRANSFERS` | WMS |
| `AssetDepreciation` | `WMS_ASSET_DEPRECIATIONS` | WMS |
| `CustomsDocument` | `CUST_DOCUMENTS` | CUST |
| `VehicleMaintenance` | `WMS_VEHICLE_MAINTENANCE` | WMS |
| `ComplianceChecklist` | `WMS_COMPLIANCE_CHECKLISTS` | WMS |
| `ComplianceChecklistItem` | `WMS_COMPLIANCE_CHECKLIST_ITEMS` | WMS |
| `ComplianceAudit` | `WMS_COMPLIANCE_AUDITS` | WMS |
| `ComplianceAuditResponse` | `WMS_COMPLIANCE_AUDIT_RESPONSES` | WMS |
| `DigitalSignature` | `FND_DIGITAL_SIGNATURES` | FND |

## Summary

| Metric | Count |
|---|---|
| Total Prisma models | 145 |
| Oracle module prefixes used | 7 (logistics-only) |
| Schema files | 16 |

### Prefix Distribution

| Prefix | Count | Domain |
|---|---|---|
| `FND_` | 55 | Foundation (settings, auth, suppliers, employees, workflows) |
| `WMS_` | 54 | Warehouse Management (equipment, assets, zones, bins, staging) |
| `MTL_` | 15 | Materials/Inventory (items, lots, transfers, cycle counts) |
| `RCV_` | 7 | Receiving (GRN, ASN, inspections, discrepancies) |
| `ONT_` | 6 | Order Management (MI, MRN, requisitions) |
| `WSH_` | 5 | Shipping (deliveries, transport orders) |
| `CUST_` | 3 | Customs (tracking, documents, tariffs) |
