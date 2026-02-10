/**
 * DocumentActions — Status transition action menu for document list pages.
 *
 * Renders a dropdown of available status transitions based on the document's
 * current status and type. Each action calls the corresponding API mutation hook.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Play,
  Check,
  X,
  Send,
  Package,
  Truck,
  ClipboardCheck,
  Ban,
  FileCheck,
  Search,
  DollarSign,
} from 'lucide-react';
import { toast } from '@/components/Toaster';
import {
  useSubmitMrrv,
  useApproveQcMrrv,
  useReceiveMrrv,
  useStoreMrrv,
  useSubmitMirv,
  useApproveMirv,
  useIssueMirv,
  useCancelMirv,
  useSubmitMrv,
  useReceiveMrv,
  useCompleteMrv,
  useStartRfim,
  useCompleteRfim,
  useSendClaimOsd,
  useResolveOsd,
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
  useSubmitGatePass,
  useApproveGatePass,
  useReleaseGatePass,
  useReturnGatePass,
  useCancelGatePass,
  useSubmitStockTransfer,
  useApproveStockTransfer,
  useShipStockTransfer,
  useReceiveStockTransfer,
  useCompleteStockTransfer,
  useCancelStockTransfer,
  useSubmitMrf,
  useReviewMrf,
  useApproveMrf,
  useCheckStockMrf,
  useConvertMirvMrf,
  useFulfillMrf,
  useRejectMrf,
  useCancelMrf,
  useDeliverShipment,
  useCancelShipment,
} from '@/api/hooks';

/** Loose mutation type that covers hooks accepting either `string` or `{ id: string }` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- required to unify heterogeneous mutation hook signatures
type AnyMutation = { mutate: (vars: any, opts?: any) => void; isPending: boolean };

interface ActionDef {
  label: string;
  icon: React.ElementType;
  hook: AnyMutation;
  color: string;
  confirm?: string;
  /** If true, pass { id } instead of just id to the mutation */
  objectArg?: boolean;
}

interface DocumentActionsProps {
  resource: string;
  row: Record<string, unknown>;
}

/**
 * Normalise the display status string to a comparable lowercase form.
 * Server returns e.g. 'draft', 'pending_approval', frontend may show 'Draft', 'Pending Approval'.
 */
function normaliseStatus(s: unknown): string {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Custom hook that returns available actions for a given resource.
 * Must be called unconditionally (hooks rules) — returns empty array for unknown resources.
 */
function useDocumentActions(resource: string, status: string): ActionDef[] {
  // MRRV
  const submitMrrv = useSubmitMrrv();
  const approveQcMrrv = useApproveQcMrrv();
  const receiveMrrv = useReceiveMrrv();
  const storeMrrv = useStoreMrrv();

  // MIRV
  const submitMirv = useSubmitMirv();
  const approveMirv = useApproveMirv();
  const issueMirv = useIssueMirv();
  const cancelMirv = useCancelMirv();

  // MRV
  const submitMrv = useSubmitMrv();
  const receiveMrv = useReceiveMrv();
  const completeMrv = useCompleteMrv();

  // RFIM
  const startRfim = useStartRfim();
  const completeRfim = useCompleteRfim();

  // OSD
  const sendClaimOsd = useSendClaimOsd();
  const resolveOsd = useResolveOsd();

  // Job Orders
  const submitJo = useSubmitJobOrder();
  const approveJo = useApproveJobOrder();
  const rejectJo = useRejectJobOrder();
  const assignJo = useAssignJobOrder();
  const startJo = useStartJobOrder();
  const holdJo = useHoldJobOrder();
  const resumeJo = useResumeJobOrder();
  const completeJo = useCompleteJobOrder();
  const invoiceJo = useInvoiceJobOrder();
  const cancelJo = useCancelJobOrder();

  // Gate Passes
  const submitGp = useSubmitGatePass();
  const approveGp = useApproveGatePass();
  const releaseGp = useReleaseGatePass();
  const returnGp = useReturnGatePass();
  const cancelGp = useCancelGatePass();

  // Stock Transfers
  const submitSt = useSubmitStockTransfer();
  const approveSt = useApproveStockTransfer();
  const shipSt = useShipStockTransfer();
  const receiveSt = useReceiveStockTransfer();
  const completeSt = useCompleteStockTransfer();
  const cancelSt = useCancelStockTransfer();

  // MRF
  const submitMrf = useSubmitMrf();
  const reviewMrf = useReviewMrf();
  const approveMrf = useApproveMrf();
  const checkStockMrf = useCheckStockMrf();
  const convertMirvMrf = useConvertMirvMrf();
  const fulfillMrf = useFulfillMrf();
  const rejectMrf = useRejectMrf();
  const cancelMrf = useCancelMrf();

  // Shipments
  const deliverShipment = useDeliverShipment();
  const cancelShipment = useCancelShipment();

  const s = normaliseStatus(status);

  // Build per-resource action maps
  const allActions: Record<string, Record<string, ActionDef[]>> = {
    mrrv: {
      draft: [{ label: 'Submit', icon: Send, hook: submitMrrv, color: 'text-blue-400' }],
      pending_qc: [{ label: 'Approve QC', icon: ClipboardCheck, hook: approveQcMrrv, color: 'text-green-400' }],
      inspected: [{ label: 'Receive', icon: Package, hook: receiveMrrv, color: 'text-emerald-400' }],
      received: [{ label: 'Store', icon: Check, hook: storeMrrv, color: 'text-teal-400' }],
    },
    mirv: {
      draft: [
        { label: 'Submit', icon: Send, hook: submitMirv, color: 'text-blue-400' },
        { label: 'Cancel', icon: Ban, hook: cancelMirv, color: 'text-red-400', confirm: 'Cancel this MI?' },
      ],
      pending_approval: [
        { label: 'Approve', icon: Check, hook: approveMirv, color: 'text-green-400' },
        { label: 'Cancel', icon: Ban, hook: cancelMirv, color: 'text-red-400', confirm: 'Cancel this MI?' },
      ],
      approved: [{ label: 'Issue', icon: Package, hook: issueMirv, color: 'text-emerald-400' }],
    },
    mrv: {
      draft: [{ label: 'Submit', icon: Send, hook: submitMrv, color: 'text-blue-400' }],
      pending: [{ label: 'Receive', icon: Package, hook: receiveMrv, color: 'text-emerald-400' }],
      received: [{ label: 'Complete', icon: Check, hook: completeMrv, color: 'text-green-400' }],
    },
    rfim: {
      draft: [{ label: 'Start Inspection', icon: Play, hook: startRfim, color: 'text-blue-400' }],
      pending: [{ label: 'Start Inspection', icon: Play, hook: startRfim, color: 'text-blue-400' }],
      in_progress: [{ label: 'Complete', icon: Check, hook: completeRfim, color: 'text-green-400', objectArg: true }],
    },
    osd: {
      draft: [{ label: 'Send Claim', icon: Send, hook: sendClaimOsd, color: 'text-blue-400' }],
      reported: [{ label: 'Send Claim', icon: Send, hook: sendClaimOsd, color: 'text-blue-400' }],
      claim_sent: [{ label: 'Resolve', icon: Check, hook: resolveOsd, color: 'text-green-400', objectArg: true }],
    },
    'job-orders': {
      draft: [
        { label: 'Submit', icon: Send, hook: submitJo, color: 'text-blue-400' },
        {
          label: 'Cancel',
          icon: Ban,
          hook: cancelJo,
          color: 'text-red-400',
          confirm: 'Cancel this Job Order?',
          objectArg: true,
        },
      ],
      pending_approval: [
        { label: 'Approve', icon: Check, hook: approveJo, color: 'text-green-400' },
        {
          label: 'Reject',
          icon: X,
          hook: rejectJo,
          color: 'text-red-400',
          confirm: 'Reject this Job Order?',
          objectArg: true,
        },
      ],
      approved: [{ label: 'Assign', icon: ClipboardCheck, hook: assignJo, color: 'text-cyan-400', objectArg: true }],
      assigned: [{ label: 'Start', icon: Play, hook: startJo, color: 'text-blue-400' }],
      in_progress: [
        { label: 'Complete', icon: Check, hook: completeJo, color: 'text-green-400' },
        { label: 'Hold', icon: Ban, hook: holdJo, color: 'text-yellow-400', objectArg: true },
      ],
      on_hold: [
        { label: 'Resume', icon: Play, hook: resumeJo, color: 'text-blue-400' },
        {
          label: 'Cancel',
          icon: Ban,
          hook: cancelJo,
          color: 'text-red-400',
          confirm: 'Cancel this Job Order?',
          objectArg: true,
        },
      ],
      completed: [{ label: 'Invoice', icon: DollarSign, hook: invoiceJo, color: 'text-emerald-400', objectArg: true }],
    },
    'gate-pass': {
      draft: [
        { label: 'Submit', icon: Send, hook: submitGp, color: 'text-blue-400' },
        { label: 'Cancel', icon: Ban, hook: cancelGp, color: 'text-red-400', confirm: 'Cancel this Gate Pass?' },
      ],
      pending: [
        { label: 'Approve', icon: Check, hook: approveGp, color: 'text-green-400' },
        { label: 'Cancel', icon: Ban, hook: cancelGp, color: 'text-red-400', confirm: 'Cancel?' },
      ],
      approved: [{ label: 'Release', icon: Truck, hook: releaseGp, color: 'text-emerald-400' }],
      released: [{ label: 'Return', icon: Package, hook: returnGp, color: 'text-teal-400' }],
    },
    'stock-transfer': {
      draft: [
        { label: 'Submit', icon: Send, hook: submitSt, color: 'text-blue-400' },
        { label: 'Cancel', icon: Ban, hook: cancelSt, color: 'text-red-400', confirm: 'Cancel this Transfer?' },
      ],
      pending: [
        { label: 'Approve', icon: Check, hook: approveSt, color: 'text-green-400' },
        { label: 'Cancel', icon: Ban, hook: cancelSt, color: 'text-red-400', confirm: 'Cancel?' },
      ],
      approved: [{ label: 'Ship', icon: Truck, hook: shipSt, color: 'text-blue-400' }],
      shipped: [{ label: 'Receive', icon: Package, hook: receiveSt, color: 'text-emerald-400' }],
      received: [{ label: 'Complete', icon: Check, hook: completeSt, color: 'text-green-400' }],
    },
    mrf: {
      draft: [
        { label: 'Submit', icon: Send, hook: submitMrf, color: 'text-blue-400' },
        { label: 'Cancel', icon: Ban, hook: cancelMrf, color: 'text-red-400', confirm: 'Cancel this MR?' },
      ],
      pending_review: [
        { label: 'Review', icon: Search, hook: reviewMrf, color: 'text-cyan-400', objectArg: true },
        {
          label: 'Reject',
          icon: X,
          hook: rejectMrf,
          color: 'text-red-400',
          confirm: 'Reject this MR?',
          objectArg: true,
        },
      ],
      reviewed: [
        { label: 'Approve', icon: Check, hook: approveMrf, color: 'text-green-400' },
        { label: 'Reject', icon: X, hook: rejectMrf, color: 'text-red-400', confirm: 'Reject?', objectArg: true },
      ],
      approved: [{ label: 'Check Stock', icon: FileCheck, hook: checkStockMrf, color: 'text-teal-400' }],
      stock_checked: [{ label: 'Convert to MI', icon: Package, hook: convertMirvMrf, color: 'text-emerald-400' }],
      mirv_created: [{ label: 'Fulfill', icon: Check, hook: fulfillMrf, color: 'text-green-400' }],
    },
    shipments: {
      in_transit: [
        { label: 'Deliver', icon: Truck, hook: deliverShipment, color: 'text-green-400' },
        { label: 'Cancel', icon: Ban, hook: cancelShipment, color: 'text-red-400', confirm: 'Cancel this Shipment?' },
      ],
      customs_clearance: [{ label: 'Deliver', icon: Truck, hook: deliverShipment, color: 'text-green-400' }],
      new: [{ label: 'Cancel', icon: Ban, hook: cancelShipment, color: 'text-red-400', confirm: 'Cancel?' }],
    },
  };

  return allActions[resource]?.[s] ?? [];
}

export const DocumentActions: React.FC<DocumentActionsProps> = ({ resource, row }) => {
  const [open, setOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ActionDef | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = useDocumentActions(resource, row.status as string);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (actions.length === 0) return null;

  const handleAction = (action: ActionDef) => {
    if (action.confirm) {
      setConfirmAction(action);
      setOpen(false);
      return;
    }
    executeAction(action);
  };

  const executeAction = (action: ActionDef) => {
    const id = row.id as string;
    const mutateArg = action.objectArg ? { id } : id;
    action.hook.mutate(mutateArg, {
      onSuccess: () => {
        toast.success(`${action.label} successful`);
        setConfirmAction(null);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error)?.message ||
          'Action failed';
        toast.error(`${action.label} failed`, msg);
        setConfirmAction(null);
      },
    });
    setOpen(false);
  };

  // If only one action, show it as a direct button
  if (actions.length === 1) {
    const action = actions[0];
    const Icon = action.icon;
    return (
      <>
        <button
          onClick={e => {
            e.stopPropagation();
            handleAction(action);
          }}
          disabled={action.hook.isPending}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${action.color} bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50`}
          title={action.label}
        >
          {action.hook.isPending ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon size={13} />
          )}
          {action.label}
        </button>
        {confirmAction && (
          <ConfirmOverlay
            message={confirmAction.confirm!}
            onConfirm={() => executeAction(confirmAction)}
            onCancel={() => setConfirmAction(null)}
            loading={confirmAction.hook.isPending}
          />
        )}
      </>
    );
  }

  // Multiple actions — dropdown
  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        className="p-1.5 rounded-lg hover:bg-white/10 text-nesma-secondary transition-colors"
        title="Actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] glass-card rounded-lg border border-white/10 shadow-xl py-1 animate-fade-in">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={e => {
                  e.stopPropagation();
                  handleAction(action);
                }}
                disabled={action.hook.isPending}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs ${action.color} hover:bg-white/10 transition-colors disabled:opacity-50`}
              >
                {action.hook.isPending ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon size={14} />
                )}
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <ConfirmOverlay
          message={confirmAction.confirm!}
          onConfirm={() => executeAction(confirmAction)}
          onCancel={() => setConfirmAction(null)}
          loading={confirmAction.hook.isPending}
        />
      )}
    </div>
  );
};

// Mini inline confirm dialog
const ConfirmOverlay: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ message, onConfirm, onCancel, loading }) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    onClick={e => {
      e.stopPropagation();
      onCancel();
    }}
  >
    <div
      className="glass-card rounded-xl p-5 max-w-sm mx-4 border border-white/10 shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-white text-sm mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 rounded-lg border border-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </div>
  </div>
);

export default DocumentActions;
