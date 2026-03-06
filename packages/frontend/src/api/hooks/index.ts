// ============================================================================
// React Query Hooks - Barrel Export
// ============================================================================

export * from './useAuth';
export * from './useBulkActions';
export * from './useComments';
export * from './useDelegations';
export * from './useImport';
export * from './useMasterData';
export * from './useDashboard';
export * from './useNotifications';
export * from './useAuditLog';
export * from './useSettings';
export * from './useUpload';
export * from './usePermissions';
export * from './useApprovalWorkflows';
export * from './useTasks';
export * from './useDocuments';
export * from './useReports';

// Document-specific hooks: only re-export status-transition hooks
// (basic CRUD is already exported from useMasterData via factory)
export {
  useJobOrderList,
  useSubmitJobOrder,
  useApproveJobOrder,
  useRejectJobOrder,
  useAssignJobOrder,
  useStartJobOrder,
  useHoldJobOrder,
  useResumeJobOrder,
  useCompleteJobOrder,
  useInvoiceJobOrder,
  useCancelJobOrder,
} from './useJobOrders';

export { useSubmitMrrv, useApproveQcMrrv, useReceiveMrrv, useStoreMrrv } from './useMrrv';
export { useSubmitMirv, useApproveMirv, useIssueMirv, useCancelMirv } from './useMirv';
export { useSubmitMrv, useReceiveMrv, useCompleteMrv } from './useMrv';
export { useStartRfim, useCompleteRfim } from './useRfim';
export { useSendClaimOsd, useResolveOsd } from './useOsd';
export {
  useSubmitMrf,
  useReviewMrf,
  useApproveMrf,
  useCheckStockMrf,
  useConvertMirvMrf,
  useFulfillMrf,
  useRejectMrf,
  useCancelMrf,
} from './useMrf';
export {
  useShipmentList,
  useUpdateShipmentStatus,
  useAddCustomsStage,
  useUpdateCustomsStage,
  useDeliverShipment,
  useCancelShipment,
} from './useShipments';
export {
  useGatePassList,
  useSubmitGatePass,
  useApproveGatePass,
  useReleaseGatePass,
  useReturnGatePass,
  useCancelGatePass,
} from './useGatePasses';
export {
  useStockTransferList,
  useSubmitStockTransfer,
  useApproveStockTransfer,
  useShipStockTransfer,
  useReceiveStockTransfer,
  useCompleteStockTransfer,
  useCancelStockTransfer,
} from './useStockTransfers';
export { useBarcodeLookup, usePrintLabels } from './useBarcodes';
export * from './useDashboards';
export * from './useSavedReports';
export * from './useWidgetData';
export {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useActivateWorkflow,
  useDeactivateWorkflow,
  useWorkflowRules,
  useWorkflowRule,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useTestRule,
  useRuleLogs,
} from './useWorkflows';
export {
  useEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  usePreviewEmailTemplate,
  useEmailLogs,
  useEmailLogStats,
} from './useEmailTemplates';

// ============================================================================
// V2 API Hooks — new endpoint names, coexist with V1 hooks above
// ============================================================================

// GRN (was MRRV)
export {
  useGrnList,
  useGrn,
  useCreateGrn,
  useUpdateGrn,
  useSubmitGrn,
  useApproveQcGrn,
  useReceiveGrn,
  useStoreGrn,
} from './useGrn';

// QCI (was RFIM)
export { useQciList, useQci, useUpdateQci, useStartQci, useCompleteQci } from './useQci';

// DR (was OSD)
export { useDrList, useDr, useCreateDr, useUpdateDr, useSendClaimDr, useResolveDr } from './useDr';

// MI (was MIRV)
export {
  useMiList,
  useMi,
  useCreateMi,
  useUpdateMi,
  useSubmitMi,
  useApproveMi,
  useIssueMi,
  useCancelMi,
} from './useMi';

// MRN (was MRV)
export { useMrnList, useMrn, useCreateMrn, useUpdateMrn, useSubmitMrn, useReceiveMrn, useCompleteMrn } from './useMrn';

// MR (was MRF)
export {
  useMrList,
  useMr,
  useCreateMr,
  useUpdateMr,
  useSubmitMr,
  useReviewMr,
  useApproveMr,
  useCheckStockMr,
  useConvertMiMr,
  useConvertMrToImsf,
  useFulfillMr,
  useRejectMr,
  useCancelMr,
} from './useMr';

// WT (was StockTransfer)
export {
  useWtList,
  useWt,
  useCreateWt,
  useUpdateWt,
  useSubmitWt,
  useApproveWt,
  useShipWt,
  useReceiveWt,
  useCompleteWt,
  useCancelWt,
} from './useWt';

// IMSF — new module
export {
  useImsfList,
  useImsf,
  useCreateImsf,
  useUpdateImsf,
  useSendImsf,
  useConfirmImsf,
  useShipImsf,
  useDeliverImsf,
  useCompleteImsf,
} from './useImsf';

// Surplus — new module
export {
  useSurplusList,
  useSurplus,
  useCreateSurplus,
  useUpdateSurplus,
  useEvaluateSurplus,
  useApproveSurplus,
  useActionSurplus,
  useCloseSurplus,
} from './useSurplus';

// Scrap — new module
export {
  useScrapList,
  useScrap,
  useCreateScrap,
  useUpdateScrap,
  useReportScrap,
  useApproveScrap,
  useSendToSscScrap,
  useMarkSoldScrap,
  useDisposeScrap,
  useCloseScrap,
  useApproveBySiteManager,
  useApproveByQc,
  useApproveByStorekeeper,
} from './useScrap';

// SSC — new module
export {
  useSscList,
  useSsc,
  useCreateSsc,
  useUpdateSsc,
  useDeleteSsc,
  useAcceptBid,
  useRejectBid,
  useSignMemo,
  useNotifyFinance,
} from './useSsc';

// Rental Contracts — new module
export {
  useRentalContractList,
  useRentalContract,
  useCreateRentalContract,
  useUpdateRentalContract,
  useSubmitRentalContract,
  useApproveRentalContract,
  useActivateRentalContract,
  useExtendRentalContract,
  useTerminateRentalContract,
} from './useRentalContracts';

// Tool Issues — new module
export {
  useToolIssueList,
  useToolIssue,
  useCreateToolIssue,
  useUpdateToolIssue,
  useReturnToolIssue,
} from './useToolIssues';

// Tools — new module
export { useToolList, useTool, useCreateTool, useUpdateTool, useDeleteTool, useDecommissionTool } from './useTools';

// Generator Fuel — new module (CRUD only)
export {
  useGeneratorFuelList,
  useGeneratorFuel,
  useCreateGeneratorFuel,
  useUpdateGeneratorFuel,
} from './useGeneratorFuel';

// Generator Maintenance — new module
export {
  useGeneratorMaintenanceList,
  useGeneratorMaintenance,
  useCreateGeneratorMaintenance,
  useUpdateGeneratorMaintenance,
  useStartGeneratorMaintenance,
  useCompleteGeneratorMaintenance,
  useMarkOverdueGeneratorMaintenance,
} from './useGeneratorMaintenance';

// Vehicle Maintenance — M8 module
export {
  useVehicleMaintenanceList,
  useVehicleMaintenance,
  useCreateVehicleMaintenance,
  useUpdateVehicleMaintenance,
  useCompleteVehicleMaintenance,
  useCancelVehicleMaintenance,
} from './useVehicleMaintenance';

// Warehouse Zones — new module (CRUD only)
export {
  useWarehouseZoneList,
  useWarehouseZone,
  useCreateWarehouseZone,
  useUpdateWarehouseZone,
  useDeleteWarehouseZone,
} from './useWarehouseZones';

// Bin Cards — new module
export {
  useBinCardList,
  useComputedBinCards,
  useBinCards,
  useBinCard,
  useCreateBinCard,
  useUpdateBinCard,
  useBinCardTransactionList,
  useCreateBinCardTransaction,
} from './useBinCards';

// Handovers — new module
export {
  useHandoverList,
  useHandover,
  useCreateHandover,
  useUpdateHandover,
  useStartHandoverVerification,
  useCompleteHandover,
} from './useHandovers';

// Rate Cards — SOW M2-F06
export { useRateCardList, useRateCard, useCreateRateCard, useUpdateRateCard, useRateCardLookup } from './useRateCards';

// Labor Productivity
export { useLaborProductivity } from './useLaborProductivity';

// MVP DEFERRED: ABC Analysis, Put-Away Rules, Cycle Counts, Pick Optimizer

// Route Optimization (JO Transport)
export { useUndeliveredJOs, useOptimizeRoute, useEstimateFuel } from './useRouteOptimizer';
export type { RouteStop, OptimizedRouteStop, OptimizedRoute, UndeliveredJO, FuelEstimate } from './useRouteOptimizer';

// MVP DEFERRED: ASN, Slotting, Demand Forecast, Cross-Docking

// Inspection Tools (AQL Calculator & Checklists)
export {
  useAqlCalculation,
  useAqlTable,
  useChecklistList,
  useChecklist,
  useCreateChecklist,
  useUpdateChecklist,
  useDeleteChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
} from './useInspection';
export type { InspectionLevel, AqlSample, AqlTableRow, AqlTable, ChecklistItem, Checklist } from './useInspection';

// Parallel Approvals — multi-approver groups
export {
  useDocumentApprovalGroups,
  usePendingApprovals,
  useCreateParallelApproval,
  useRespondToApproval,
} from './useParallelApprovals';
export type { ParallelApprovalGroup, ParallelApprovalResponse } from './useParallelApprovals';

// Visitor Management — SOW M5-F03
export {
  useVisitorList,
  useVisitor,
  useRegisterVisitor,
  useUpdateVisitor,
  useCheckInVisitor,
  useCheckOutVisitor,
  useCancelVisitor,
} from './useVisitors';

// Equipment Delivery & Return Notes — SOW M2-F02
export {
  useEquipmentDeliveryNoteList,
  useEquipmentDeliveryNote,
  useCreateEquipmentDeliveryNote,
  useUpdateEquipmentDeliveryNote,
  useConfirmEquipmentDeliveryNote,
  useCancelEquipmentDeliveryNote,
  useEquipmentReturnNoteList,
  useEquipmentReturnNote,
  useCreateEquipmentReturnNote,
  useUpdateEquipmentReturnNote,
  useInspectEquipmentReturnNote,
  useConfirmEquipmentReturnNote,
  useDisputeEquipmentReturnNote,
} from './useEquipmentNotes';

// Tariff & Duties — SOW M3
export {
  useTariffRateList,
  useTariffRate,
  useCreateTariffRate,
  useUpdateTariffRate,
  useCalculateDuties,
  useApplyDuties,
} from './useTariffs';
export type { TariffRate, LineBreakdown, DutyCalculationResult } from './useTariffs';

// Comprehensive KPI Dashboard (M7)
export { useKpis, useKpisByCategory } from './useKpis';
export type {
  KpiResult,
  ComprehensiveKpis,
  InventoryKpis,
  ProcurementKpis,
  LogisticsKpis,
  QualityKpis,
  FinancialKpis,
  KpiCategory,
} from './useKpis';

// Security (M6: Access Control & Security)
export { useSecurityDashboard, useLoginHistory } from './useSecurity';
export type { SecurityDashboard, LoginHistoryEntry, LoginHistoryParams } from './useSecurity';

// AMC — Annual Maintenance Contracts (SOW M1)
export { useAmcList, useAmc, useCreateAmc, useUpdateAmc, useActivateAmc, useTerminateAmc } from './useAmc';
export type { Amc } from './useAmc';

// Customs Documents — SOW M9
export {
  useCustomsDocumentList,
  useCustomsDocument,
  useCreateCustomsDocument,
  useUpdateCustomsDocument,
  useVerifyCustomsDocument,
  useRejectCustomsDocument,
  useDocumentCompleteness,
} from './useCustomsDocuments';

// Compliance Audit Checklists (ISO 9001) — SOW M2
export {
  useChecklistList as useComplianceChecklistList,
  useChecklist as useComplianceChecklist,
  useCreateChecklist as useCreateComplianceChecklist,
  useUpdateChecklist as useUpdateComplianceChecklist,
  useAuditList as useComplianceAuditList,
  useAudit as useComplianceAudit,
  useCreateAudit as useCreateComplianceAudit,
  useSubmitAuditResponses,
  useCompleteAudit as useCompleteComplianceAudit,
} from './useCompliance';

// Asset Register (M10)
export {
  useAssetList,
  useAsset,
  useAssetSummary,
  useCreateAsset,
  useUpdateAsset,
  useTransferAsset,
  useRetireAsset,
  useDisposeAsset,
} from './useAssets';
export type {
  ComplianceChecklist,
  ComplianceChecklistItem,
  ComplianceAudit,
  ComplianceAuditResponse,
} from './useCompliance';

// Expiry Alerts (L2)
export { useExpiringLots } from './useExpiryAlerts';
export type { ExpiringLot, ExpiringItemGroup, ExpiringLotsResponse } from './useExpiryAlerts';

// Digital Signatures (L6)
export { useDocumentSignatures, useCreateSignature } from './useDigitalSignatures';
export type { DigitalSignature } from './useDigitalSignatures';

// Cost Allocation Reports (L7)
export { useCostAllocation, useCostAllocationSummary } from './useCostAllocation';
export type {
  CostCategory,
  MonthlyBreakdown,
  CostAllocationData,
  ProjectCostSummaryItem,
  CostAllocationSummaryData,
} from './useCostAllocation';

// Demand Analysis — L8 (Consumption Trends) + L9 (Demand Forecasting)
export { useItemConsumptionTrend, useTopConsumptionItems, useReorderSuggestions, useItemForecast } from './useDemand';
export type {
  MonthlyConsumption,
  ItemConsumptionTrend,
  TopConsumptionItem,
  ReorderSuggestion,
  ItemForecastProjection,
} from './useDemand';

// MVP DEFERRED: Sensors, Intelligence, Yard Management
