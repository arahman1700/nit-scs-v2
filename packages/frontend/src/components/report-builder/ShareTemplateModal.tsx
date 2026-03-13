import React, { useState, useEffect } from 'react';
import { Share2, X, Users, Globe, Check } from 'lucide-react';
import { useShareReport } from '@/domains/reporting/hooks/useSavedReports';
import type { SavedReport } from '@/domains/reporting/hooks/useSavedReports';

// ── Role definitions ─────────────────────────────────────────────────────────

interface RoleOption {
  value: string;
  label: string;
}

const ALL_ROLES: RoleOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'warehouse_supervisor', label: 'Warehouse Supervisor' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'logistics_coordinator', label: 'Logistics Coordinator' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'qc_officer', label: 'QC Officer' },
  { value: 'freight_forwarder', label: 'Freight Forwarder' },
  { value: 'transport_supervisor', label: 'Transport Supervisor' },
  { value: 'scrap_committee_member', label: 'Scrap Committee Member' },
  { value: 'technical_manager', label: 'Technical Manager' },
  { value: 'gate_officer', label: 'Gate Officer' },
  { value: 'inventory_specialist', label: 'Inventory Specialist' },
  { value: 'shipping_officer', label: 'Shipping Officer' },
  { value: 'finance_user', label: 'Finance User' },
  { value: 'customs_specialist', label: 'Customs Specialist' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
];

// ── Component ────────────────────────────────────────────────────────────────

interface ShareTemplateModalProps {
  report: SavedReport;
  onClose: () => void;
}

export const ShareTemplateModal: React.FC<ShareTemplateModalProps> = ({ report, onClose }) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(report.sharedWithRoles ?? []);
  const [isPublic, setIsPublic] = useState<boolean>(report.isPublic ?? false);
  const [saved, setSaved] = useState(false);

  const shareReport = useShareReport();

  // Reset saved indicator when report changes
  useEffect(() => {
    setSelectedRoles(report.sharedWithRoles ?? []);
    setIsPublic(report.isPublic ?? false);
    setSaved(false);
  }, [report.id]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => (prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]));
    setSaved(false);
  };

  const toggleSelectAll = () => {
    if (selectedRoles.length === ALL_ROLES.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(ALL_ROLES.map(r => r.value));
    }
    setSaved(false);
  };

  const handleSave = async () => {
    await shareReport.mutateAsync({ id: report.id, roles: selectedRoles, isPublic });
    setSaved(true);
  };

  const allSelected = selectedRoles.length === ALL_ROLES.length;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal panel */}
      <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 shadow-xl shadow-nesma-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-nesma-primary/20">
              <Share2 size={18} className="text-nesma-secondary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Share Template</h2>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{report.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Public toggle */}
        <div className="flex items-center justify-between mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-nesma-secondary" />
            <span className="text-sm text-white font-medium">Public (visible to everyone)</span>
          </div>
          <button
            onClick={() => {
              setIsPublic(v => !v);
              setSaved(false);
            }}
            aria-label="Toggle public access"
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              isPublic ? 'bg-nesma-primary' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                isPublic ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Role selector */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-gray-400" />
              <span className="text-sm font-medium text-white">Share with roles</span>
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-[11px] text-nesma-secondary hover:text-white transition-colors duration-300"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
            {ALL_ROLES.map(role => {
              const checked = selectedRoles.includes(role.value);
              return (
                <label
                  key={role.value}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 ${
                    checked
                      ? 'bg-nesma-primary/15 border border-nesma-primary/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${
                      checked ? 'bg-nesma-primary border-nesma-primary' : 'border-white/30'
                    }`}
                  >
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleRole(role.value)}
                  />
                  <span className="text-sm text-gray-300">{role.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Selected count */}
        {selectedRoles.length > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            Shared with {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-gray-400 bg-white/5 border border-white/10
              hover:bg-white/10 hover:text-white rounded-lg transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={shareReport.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
              bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg
              transition-all duration-300 disabled:opacity-50"
          >
            {shareReport.isPending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check size={14} />
                Saved
              </>
            ) : (
              <>
                <Share2 size={14} />
                Save Sharing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
