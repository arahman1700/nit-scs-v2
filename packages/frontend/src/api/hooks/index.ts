// ============================================================================
// React Query Hooks - Barrel Re-Export (Domain-Driven)
// ============================================================================
// All hooks now live in src/domains/{domain}/hooks/. This barrel re-exports
// them for backward compatibility with consumers importing from '@/api/hooks'.
// ============================================================================

// ── Auth ────────────────────────────────────────────────────────────────
export * from '../../domains/auth/hooks/useAuth';
export * from '../../domains/auth/hooks/usePermissions';
export { useSecurityDashboard, useLoginHistory } from '../../domains/auth/hooks/useSecurity';
export type { SecurityDashboard, LoginHistoryEntry, LoginHistoryParams } from '../../domains/auth/hooks/useSecurity';

// ── Master Data ─────────────────────────────────────────────────────────
export * from '../../domains/master-data/hooks/useMasterData';

// ── Inbound ─────────────────────────────────────────────────────────────
export {
  useGrnList,
  useGrn,
  useCreateGrn,
  useUpdateGrn,
  useSubmitGrn,
  useApproveQcGrn,
  useReceiveGrn,
  useStoreGrn,
} from '../../domains/inbound/hooks/useGrn';
export {
  useQciList,
  useQci,
  useCreateQci,
  useUpdateQci,
  useStartQci,
  useCompleteQci,
} from '../../domains/inbound/hooks/useQci';
export {
  useDrList,
  useDr,
  useCreateDr,
  useUpdateDr,
  useSendClaimDr,
  useResolveDr,
} from '../../domains/inbound/hooks/useDr';
export { useSubmitMrrv, useApproveQcMrrv, useReceiveMrrv, useStoreMrrv } from '../../domains/inbound/hooks/useMrrv';
export { useStartRfim, useCompleteRfim } from '../../domains/inbound/hooks/useRfim';
export { useSendClaimOsd, useResolveOsd } from '../../domains/inbound/hooks/useOsd';
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
} from '../../domains/inbound/hooks/useInspection';
export type {
  InspectionLevel,
  AqlSample,
  AqlTableRow,
  AqlTable,
  ChecklistItem,
  Checklist,
} from '../../domains/inbound/hooks/useInspection';

// ── Outbound ────────────────────────────────────────────────────────────
export {
  useMiList,
  useMi,
  useCreateMi,
  useUpdateMi,
  useSubmitMi,
  useApproveMi,
  useIssueMi,
  useCancelMi,
} from '../../domains/outbound/hooks/useMi';
export {
  useMrnList,
  useMrn,
  useCreateMrn,
  useUpdateMrn,
  useSubmitMrn,
  useReceiveMrn,
  useCompleteMrn,
} from '../../domains/outbound/hooks/useMrn';
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
} from '../../domains/outbound/hooks/useMr';
export { useSubmitMirv, useApproveMirv, useIssueMirv, useCancelMirv } from '../../domains/outbound/hooks/useMirv';
export { useSubmitMrv, useReceiveMrv, useCompleteMrv } from '../../domains/outbound/hooks/useMrv';
export {
  useSubmitMrf,
  useReviewMrf,
  useApproveMrf,
  useCheckStockMrf,
  useConvertMirvMrf,
  useFulfillMrf,
  useRejectMrf,
  useCancelMrf,
} from '../../domains/outbound/hooks/useMrf';

// ── Inventory ───────────────────────────────────────────────────────────
export {
  useBinCardList,
  useComputedBinCards,
  useBinCards,
  useBinCard,
  useCreateBinCard,
  useUpdateBinCard,
  useBinCardTransactionList,
  useCreateBinCardTransaction,
} from '../../domains/inventory/hooks/useBinCards';
export {
  useSurplusList,
  useSurplus,
  useCreateSurplus,
  useUpdateSurplus,
  useEvaluateSurplus,
  useApproveSurplus,
  useActionSurplus,
  useCloseSurplus,
} from '../../domains/inventory/hooks/useSurplus';
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
} from '../../domains/inventory/hooks/useScrap';
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
} from '../../domains/inventory/hooks/useSsc';
export { useExpiringLots } from '../../domains/inventory/hooks/useExpiryAlerts';
export type {
  ExpiringLot,
  ExpiringItemGroup,
  ExpiringLotsResponse,
} from '../../domains/inventory/hooks/useExpiryAlerts';

// ── Transfers ───────────────────────────────────────────────────────────
export {
  useStockTransferList,
  useSubmitStockTransfer,
  useApproveStockTransfer,
  useShipStockTransfer,
  useReceiveStockTransfer,
  useCompleteStockTransfer,
  useCancelStockTransfer,
} from '../../domains/transfers/hooks/useStockTransfers';
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
} from '../../domains/transfers/hooks/useWt';
export {
  useHandoverList,
  useHandover,
  useCreateHandover,
  useUpdateHandover,
  useStartHandoverVerification,
  useCompleteHandover,
} from '../../domains/transfers/hooks/useHandovers';
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
} from '../../domains/transfers/hooks/useImsf';

// ── Logistics ───────────────────────────────────────────────────────────
export {
  useShipmentList,
  useUpdateShipmentStatus,
  useAddCustomsStage,
  useUpdateCustomsStage,
  useDeliverShipment,
  useCancelShipment,
} from '../../domains/logistics/hooks/useShipments';
export {
  useGatePassList,
  useSubmitGatePass,
  useApproveGatePass,
  useReleaseGatePass,
  useReturnGatePass,
  useCancelGatePass,
} from '../../domains/logistics/hooks/useGatePasses';
export { useUndeliveredJOs, useOptimizeRoute, useEstimateFuel } from '../../domains/logistics/hooks/useRouteOptimizer';
export type {
  RouteStop,
  OptimizedRouteStop,
  OptimizedRoute,
  UndeliveredJO,
  FuelEstimate,
} from '../../domains/logistics/hooks/useRouteOptimizer';
export {
  useTariffRateList,
  useTariffRate,
  useCreateTariffRate,
  useUpdateTariffRate,
  useCalculateDuties,
  useApplyDuties,
} from '../../domains/logistics/hooks/useTariffs';
export type { TariffRate, LineBreakdown, DutyCalculationResult } from '../../domains/logistics/hooks/useTariffs';
export {
  useCustomsDocumentList,
  useCustomsDocument,
  useCreateCustomsDocument,
  useUpdateCustomsDocument,
  useVerifyCustomsDocument,
  useRejectCustomsDocument,
  useDocumentCompleteness,
} from '../../domains/logistics/hooks/useCustomsDocuments';
export {
  useCarrierList,
  useCarrier,
  useCreateCarrier,
  useUpdateCarrier,
  useSuspendCarrier,
  useActivateCarrier,
  useDeleteCarrier,
  useCarrierRates,
  useCreateCarrierRate,
  useUpdateCarrierRate,
  useDeleteCarrierRate,
} from '../../domains/logistics/hooks/useCarrier';
export type { CarrierService, CarrierRate, CarrierFilters } from '../../domains/logistics/hooks/useCarrier';
export {
  useThreePlContractList,
  useThreePlContract,
  useCreateThreePlContract,
  useUpdateThreePlContract,
  useActivateThreePlContract,
  useSuspendThreePlContract,
  useTerminateThreePlContract,
  useDeleteThreePlContract,
  useThreePlChargeList,
  useThreePlCharge,
  useCreateThreePlCharge,
  useUpdateThreePlCharge,
  useDeleteThreePlCharge,
} from '../../domains/logistics/hooks/use3pl';
export type {
  ThreePlContract,
  ThreePlCharge,
  ThreePlContractFilters,
  ThreePlChargeFilters,
} from '../../domains/logistics/hooks/use3pl';

// ── Equipment ───────────────────────────────────────────────────────────
export {
  useToolList,
  useTool,
  useCreateTool,
  useUpdateTool,
  useDeleteTool,
  useDecommissionTool,
} from '../../domains/equipment/hooks/useTools';
export {
  useToolIssueList,
  useToolIssue,
  useCreateToolIssue,
  useUpdateToolIssue,
  useReturnToolIssue,
} from '../../domains/equipment/hooks/useToolIssues';
export {
  useGeneratorFuelList,
  useGeneratorFuel,
  useCreateGeneratorFuel,
  useUpdateGeneratorFuel,
} from '../../domains/equipment/hooks/useGeneratorFuel';
export {
  useGeneratorMaintenanceList,
  useGeneratorMaintenance,
  useCreateGeneratorMaintenance,
  useUpdateGeneratorMaintenance,
  useStartGeneratorMaintenance,
  useCompleteGeneratorMaintenance,
  useMarkOverdueGeneratorMaintenance,
} from '../../domains/equipment/hooks/useGeneratorMaintenance';
export {
  useVehicleMaintenanceList,
  useVehicleMaintenance,
  useCreateVehicleMaintenance,
  useUpdateVehicleMaintenance,
  useCompleteVehicleMaintenance,
  useCancelVehicleMaintenance,
} from '../../domains/equipment/hooks/useVehicleMaintenance';
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
} from '../../domains/equipment/hooks/useRentalContracts';
export {
  useAmcList,
  useAmc,
  useCreateAmc,
  useUpdateAmc,
  useActivateAmc,
  useTerminateAmc,
} from '../../domains/equipment/hooks/useAmc';
export type { Amc } from '../../domains/equipment/hooks/useAmc';
export {
  useAssetList,
  useAsset,
  useAssetSummary,
  useCreateAsset,
  useUpdateAsset,
  useTransferAsset,
  useRetireAsset,
  useDisposeAsset,
} from '../../domains/equipment/hooks/useAssets';
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
} from '../../domains/equipment/hooks/useEquipmentNotes';

// ── Job Orders ──────────────────────────────────────────────────────────
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
} from '../../domains/job-orders/hooks/useJobOrders';
export { useLaborProductivity } from '../../domains/job-orders/hooks/useLaborProductivity';

// ── Warehouse Ops ───────────────────────────────────────────────────────
export {
  useWarehouseZoneList,
  useWarehouseZone,
  useCreateWarehouseZone,
  useUpdateWarehouseZone,
  useDeleteWarehouseZone,
} from '../../domains/warehouse-ops/hooks/useWarehouseZones';
export {
  useLpnList,
  useLpn,
  useCreateLpn,
  useUpdateLpn,
  useCloseLpn,
  useDeleteLpn,
} from '../../domains/warehouse-ops/hooks/useLpn';
export type { LicensePlate, LpnContent } from '../../domains/warehouse-ops/hooks/useLpn';
export {
  useRfidTagList,
  useRfidTag,
  useCreateRfidTag,
  useUpdateRfidTag,
  useAssignRfidTag,
  useDeactivateRfidTag,
  useDeleteRfidTag,
  useRfidScanEvents,
} from '../../domains/warehouse-ops/hooks/useRfid';
export type { RfidTag, RfidScanEvent } from '../../domains/warehouse-ops/hooks/useRfid';
export {
  useWmsTaskList,
  useWmsTask,
  useCreateWmsTask,
  useUpdateWmsTask,
  useAssignWmsTask,
  useStartWmsTask,
  useCompleteWmsTask,
  useCancelWmsTask,
  useDeleteWmsTask,
} from '../../domains/warehouse-ops/hooks/useWmsTask';
export type { WmsTask, WmsTaskFilters } from '../../domains/warehouse-ops/hooks/useWmsTask';
export {
  useWaveList,
  useWave,
  useCreateWave,
  useUpdateWave,
  useReleaseWave,
  useCompleteWave,
  useCancelWave,
  useDeleteWave,
} from '../../domains/warehouse-ops/hooks/useWave';
export type { WaveHeader, WaveLine, WaveFilters } from '../../domains/warehouse-ops/hooks/useWave';
export {
  useStockAllocationList,
  useStockAllocation,
  useCreateStockAllocation,
  useUpdateStockAllocation,
  useReleaseStockAllocation,
  useCancelStockAllocation,
  useDeleteStockAllocation,
  useAllocationSummary,
} from '../../domains/warehouse-ops/hooks/useStockAllocation';
export type {
  StockAllocation,
  AllocationSummary,
  StockAllocationFilters,
} from '../../domains/warehouse-ops/hooks/useStockAllocation';

// ── Workflow ────────────────────────────────────────────────────────────
export * from '../../domains/workflow/hooks/useApprovalWorkflows';
export * from '../../domains/workflow/hooks/useComments';
export * from '../../domains/workflow/hooks/useDelegations';
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
} from '../../domains/workflow/hooks/useWorkflows';
export {
  useDocumentApprovalGroups,
  usePendingApprovals,
  useCreateParallelApproval,
  useRespondToApproval,
} from '../../domains/workflow/hooks/useParallelApprovals';
export type {
  ParallelApprovalGroup,
  ParallelApprovalResponse,
} from '../../domains/workflow/hooks/useParallelApprovals';
export { useDocumentSignatures, useCreateSignature } from '../../domains/workflow/hooks/useDigitalSignatures';
export type { DigitalSignature } from '../../domains/workflow/hooks/useDigitalSignatures';

// ── Compliance ──────────────────────────────────────────────────────────
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
} from '../../domains/compliance/hooks/useCompliance';
export type {
  ComplianceChecklist,
  ComplianceChecklistItem,
  ComplianceAudit,
  ComplianceAuditResponse,
} from '../../domains/compliance/hooks/useCompliance';
export {
  useVisitorList,
  useVisitor,
  useRegisterVisitor,
  useUpdateVisitor,
  useCheckInVisitor,
  useCheckOutVisitor,
  useCancelVisitor,
} from '../../domains/compliance/hooks/useVisitors';

// ── Reporting ───────────────────────────────────────────────────────────
export * from '../../domains/reporting/hooks/useDashboard';
export * from '../../domains/reporting/hooks/useDashboards';
export * from '../../domains/reporting/hooks/useSavedReports';
export * from '../../domains/reporting/hooks/useReports';
export * from '../../domains/reporting/hooks/useWidgetData';
export { useKpis, useKpisByCategory } from '../../domains/reporting/hooks/useKpis';
export type {
  KpiResult,
  ComprehensiveKpis,
  InventoryKpis,
  ProcurementKpis,
  LogisticsKpis,
  QualityKpis,
  FinancialKpis,
  KpiCategory,
} from '../../domains/reporting/hooks/useKpis';
export { useCostAllocation, useCostAllocationSummary } from '../../domains/reporting/hooks/useCostAllocation';
export type {
  CostCategory,
  MonthlyBreakdown,
  CostAllocationData,
  ProjectCostSummaryItem,
  CostAllocationSummaryData,
} from '../../domains/reporting/hooks/useCostAllocation';
export {
  useItemConsumptionTrend,
  useTopConsumptionItems,
  useReorderSuggestions,
  useItemForecast,
} from '../../domains/reporting/hooks/useDemand';
export type {
  MonthlyConsumption,
  ItemConsumptionTrend,
  TopConsumptionItem,
  ReorderSuggestion,
  ItemForecastProjection,
} from '../../domains/reporting/hooks/useDemand';

// ── System ──────────────────────────────────────────────────────────────
export * from '../../domains/system/hooks/useNotifications';
export * from '../../domains/system/hooks/useAuditLog';
export * from '../../domains/system/hooks/useSettings';
export * from '../../domains/system/hooks/useUpload';
export * from '../../domains/system/hooks/useImport';
export * from '../../domains/system/hooks/useBulkActions';
export * from '../../domains/system/hooks/useTasks';
export * from '../../domains/system/hooks/useDocuments';
export { useBarcodeLookup, usePrintLabels } from '../../domains/system/hooks/useBarcodes';
export {
  useEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  usePreviewEmailTemplate,
  useEmailLogs,
  useEmailLogStats,
} from '../../domains/system/hooks/useEmailTemplates';
export {
  useRateCardList,
  useRateCard,
  useCreateRateCard,
  useUpdateRateCard,
  useRateCardLookup,
} from '../../domains/system/hooks/useRateCards';
export * from '../../domains/system/hooks/useScheduler';
