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
} from './useScrap';

// SSC — new module (CRUD only)
export { useSscList, useSsc, useCreateSsc, useUpdateSsc, useDeleteSsc } from './useSsc';

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

// Tools — new module (CRUD only)
export { useToolList, useTool, useCreateTool, useUpdateTool, useDeleteTool } from './useTools';

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

// Warehouse Zones — new module (CRUD only)
export {
  useWarehouseZoneList,
  useWarehouseZone,
  useCreateWarehouseZone,
  useUpdateWarehouseZone,
  useDeleteWarehouseZone,
} from './useWarehouseZones';
