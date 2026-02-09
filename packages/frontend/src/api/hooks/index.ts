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
