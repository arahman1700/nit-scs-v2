# Prisma → Oracle Table Mapping Reference

> Phase 5 artifact — maps every Prisma model to its Oracle WMS/EBS/Fusion table name.

## Naming Convention

| Oracle Module Prefix | Domain | Examples |
|---|---|---|
| `FND_` | Foundation | Settings, Counters, Login, Digital Signatures |
| `PER_` | People/HR | Employees |
| `AP_` | Accounts Payable | Suppliers, Supplier Equipment Rates |
| `PA_` | Projects | Projects |
| `HR_` | Human Resources | Legal Entities |
| `MTL_` | Materials/Inventory | Items, Onhand, Lots, Transfers, Surplus, Scrap |
| `RCV_` | Receiving | GRN Headers/Lines, ASN, Discrepancies |
| `ONT_` | Order Management | MI Headers/Lines, MRN, Requisitions |
| `WSH_` | Shipping | Deliveries, Customs, Tariffs |
| `WMS_` | Warehouse Management | Zones, Bin Cards, Gate Passes, Staging, Packing |
| `EAM_` | Enterprise Asset Mgmt | Equipment, Generators, Vehicles, Tools, Assets |
| `QA_` | Quality Assurance | Inspections, Compliance Checklists |
| `AME_` | Approval Management | Workflows, Parallel Approvals, Templates |

## Full Model → Table Mapping

### 01-reference.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Region` | `FND_REGIONS` | FND |
| `City` | `FND_CITIES` | FND |
| `Port` | `WSH_PORTS` | WSH |
| `UnitOfMeasure` | `MTL_UNITS_OF_MEASURE` | MTL |
| `WarehouseType` | `WMS_WAREHOUSE_TYPES` | WMS |
| `EquipmentCategory` | `EAM_EQUIPMENT_CATEGORIES` | EAM |
| `EquipmentType` | `EAM_EQUIPMENT_TYPES` | EAM |
| `ApprovalWorkflow` | `AME_APPROVAL_WORKFLOWS` | AME |

### 02-master-data.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Entity` | `HR_LEGAL_ENTITIES` | HR |
| `Project` | `PA_PROJECTS` | PA |
| `Employee` | `PER_ALL_PEOPLE` | PER |
| `Supplier` | `AP_SUPPLIERS` | AP |
| `Warehouse` | `WMS_WAREHOUSES` | WMS |
| `Item` | `MTL_SYSTEM_ITEMS` | MTL |
| `Generator` | `EAM_GENERATORS` | EAM |
| `EquipmentFleet` | `EAM_FLEET_VEHICLES` | EAM |

### 03-inbound.prisma (5 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Mrrv` | `RCV_RECEIPT_HEADERS` | RCV |
| `MrrvLine` | `RCV_RECEIPT_LINES` | RCV |
| `Rfim` | `QA_INSPECTION_HEADERS` | QA |
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

### 07-logistics.prisma (5 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Shipment` | `WSH_DELIVERY_HEADERS` | WSH |
| `CustomsTracking` | `WSH_CUSTOMS_TRACKING` | WSH |
| `ShipmentLine` | `WSH_DELIVERY_LINES` | WSH |
| `SupplierEquipmentRate` | `AP_SUPPLIER_EQUIPMENT_RATES` | AP |
| `DepreciationEntry` | `EAM_DEPRECIATION_ENTRIES` | EAM |
| `TariffRate` | `WSH_TARIFF_RATES` | WSH |

### 08-system.prisma (8 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `DocumentCounter` | `FND_DOCUMENT_COUNTERS` | FND |
| `AuditLog` | `FND_AUDIT_LOG` | FND |
| `Notification` | `FND_NOTIFICATIONS` | FND |
| `Upload` | `FND_UPLOADS` | FND |
| `Comment` | `AME_COMMENTS` | AME |
| `ApprovalDelegation` | `AME_APPROVAL_DELEGATIONS` | AME |
| `UserPreference` | `FND_USER_PREFERENCES` | FND |
| `DashboardConfig` | `FND_DASHBOARD_CONFIGS` | FND |

### 09-workflow.prisma (4 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `SystemSetting` | `FND_SYSTEM_SETTINGS` | FND |
| `WorkflowDefinition` | `AME_WORKFLOW_DEFINITIONS` | AME |
| `WorkflowRule` | `AME_WORKFLOW_RULES` | AME |
| `WorkflowExecution` | `AME_WORKFLOW_EXECUTIONS` | AME |

### 10-email-dashboard.prisma (11 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `EmailTemplate` | `FND_EMAIL_TEMPLATES` | FND |
| `EmailLog` | `FND_EMAIL_LOG` | FND |
| `ReportDefinition` | `FND_REPORT_DEFINITIONS` | FND |
| `SavedReport` | `FND_SAVED_REPORTS` | FND |
| `SupplierEvaluation` | `AP_SUPPLIER_EVALUATIONS` | AP |
| `VisitorLog` | `FND_VISITOR_LOG` | FND |
| `TransportOrder` | `WSH_TRANSPORT_ORDERS` | WSH |
| `CostAllocation` | `PA_COST_ALLOCATIONS` | PA |
| `SupplierEvaluationAnswer` | `AP_SUPPLIER_EVALUATION_ANSWERS` | AP |
| `CostAllocationItem` | `PA_COST_ALLOCATION_ITEMS` | PA |
| `TransportOrderItem` | `WSH_TRANSPORT_ORDER_ITEMS` | WSH |

### 11-v2-modules.prisma (24 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `Imsf` | `MTL_INTERNAL_TRANSFERS` | MTL |
| `ImsfLine` | `MTL_INTERNAL_TRANSFER_LINES` | MTL |
| `BinCard` | `WMS_BIN_CARDS` | WMS |
| `BinCardTransaction` | `WMS_BIN_CARD_TRANSACTIONS` | WMS |
| `RentalContract` | `EAM_RENTAL_CONTRACTS` | EAM |
| `RentalContractLine` | `EAM_RENTAL_CONTRACT_LINES` | EAM |
| `GeneratorFuelLog` | `EAM_GENERATOR_FUEL_LOGS` | EAM |
| `GeneratorMaintenance` | `EAM_GENERATOR_MAINTENANCE` | EAM |
| `SurplusItem` | `MTL_SURPLUS_ITEMS` | MTL |
| `ScrapItem` | `MTL_SCRAP_ITEMS` | MTL |
| `SscBid` | `MTL_SSC_BIDS` | MTL |
| `Tool` | `EAM_TOOL_REGISTRY` | EAM |
| `ToolIssue` | `EAM_TOOL_ISSUES` | EAM |
| `WarehouseZone` | `WMS_ZONES` | WMS |
| `BinLocation` | `WMS_BIN_LOCATIONS` | WMS |
| `StorekeeperHandover` | `WMS_STOREKEEPER_HANDOVERS` | WMS |
| `PutAwayRule` | `WMS_PUT_AWAY_RULES` | WMS |
| `CycleCount` | `MTL_CYCLE_COUNT_HEADERS` | MTL |
| `CycleCountLine` | `MTL_CYCLE_COUNT_LINES` | MTL |
| `AdvanceShippingNotice` | `RCV_ASN_HEADERS` | RCV |
| `AsnLine` | `RCV_ASN_LINES` | RCV |
| `CrossDock` | `WMS_CROSS_DOCKS` | WMS |
| `InspectionChecklist` | `QA_INSPECTION_CHECKLISTS` | QA |
| `InspectionChecklistItem` | `QA_INSPECTION_CHECKLIST_ITEMS` | QA |

### 12-advanced-ops.prisma (10 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `ParallelApprovalGroup` | `AME_PARALLEL_APPROVAL_GROUPS` | AME |
| `ParallelApprovalResponse` | `AME_PARALLEL_APPROVAL_RESPONSES` | AME |
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
| `WorkflowTemplate` | `AME_WORKFLOW_TEMPLATES` | AME |
| `AiConversation` | `FND_AI_CONVERSATIONS` | FND |
| `AiMessage` | `FND_AI_MESSAGES` | FND |
| `AiSuggestion` | `FND_AI_SUGGESTIONS` | FND |

### 13-warehouse-ops.prisma (5 models)

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
| `EquipmentDeliveryNote` | `EAM_DELIVERY_NOTES` | EAM |
| `EquipmentDeliveryNoteLine` | `EAM_DELIVERY_NOTE_LINES` | EAM |
| `EquipmentReturnNote` | `EAM_RETURN_NOTES` | EAM |
| `EquipmentReturnNoteLine` | `EAM_RETURN_NOTE_LINES` | EAM |
| `EquipmentTimesheetEntry` | `EAM_TIMESHEET_ENTRIES` | EAM |
| `EquipmentDailyLog` | `EAM_DAILY_LOGS` | EAM |
| `EquipmentLogEntry` | `EAM_LOG_ENTRIES` | EAM |

### 15-sow-modules.prisma (12 models)

| Prisma Model | DB Table | Module |
|---|---|---|
| `LoginAttempt` | `FND_LOGIN_ATTEMPTS` | FND |
| `AnnualMaintenanceContract` | `EAM_MAINTENANCE_CONTRACTS` | EAM |
| `Asset` | `EAM_ASSET_REGISTER` | EAM |
| `AssetTransfer` | `EAM_ASSET_TRANSFERS` | EAM |
| `AssetDepreciation` | `EAM_ASSET_DEPRECIATIONS` | EAM |
| `CustomsDocument` | `WSH_CUSTOMS_DOCUMENTS` | WSH |
| `VehicleMaintenance` | `EAM_VEHICLE_MAINTENANCE` | EAM |
| `ComplianceChecklist` | `QA_COMPLIANCE_CHECKLISTS` | QA |
| `ComplianceChecklistItem` | `QA_COMPLIANCE_CHECKLIST_ITEMS` | QA |
| `ComplianceAudit` | `QA_COMPLIANCE_AUDITS` | QA |
| `ComplianceAuditResponse` | `QA_COMPLIANCE_AUDIT_RESPONSES` | QA |
| `DigitalSignature` | `FND_DIGITAL_SIGNATURES` | FND |

## Summary

| Metric | Count |
|---|---|
| Total Prisma models | 151 |
| Oracle module prefixes used | 13 |
| Schema files | 16 |
