import React, { useState, useMemo, useCallback } from 'react';
import { Shield, Check, X, Eye, Edit, Lock, Save } from 'lucide-react';
import { UserRole } from '@nit-scs-v2/shared/types';
import { getPermissionMatrix, getEffectivePermissions } from '@nit-scs-v2/shared/permissions';
import type { PermissionOverrides, Permission } from '@nit-scs-v2/shared/permissions';
import { usePermissions, useUpdatePermissions } from '@/api/hooks/usePermissions';

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_RESOURCES = [
  'mrrv',
  'mirv',
  'mrv',
  'rfim',
  'osd',
  'jo',
  'gatepass',
  'stock-transfer',
  'mrf',
  'shipment',
  'customs',
  'inventory',
  'items',
  'projects',
  'suppliers',
  'employees',
  'warehouses',
  'reports',
  'audit-log',
  'settings',
];

const RESOURCE_LABELS: Record<string, string> = {
  mrrv: 'GRN',
  mirv: 'MI',
  mrv: 'MRN',
  rfim: 'QCI',
  osd: 'DR',
  jo: 'Job Orders',
  gatepass: 'Gate Pass',
  'stock-transfer': 'Stock Transfer',
  mrf: 'MR',
  shipment: 'Shipments',
  customs: 'Customs',
  inventory: 'Inventory',
  items: 'Items',
  projects: 'Projects',
  suppliers: 'Suppliers',
  employees: 'Employees',
  warehouses: 'Warehouses',
  reports: 'Reports',
  'audit-log': 'Audit Log',
  settings: 'Settings',
};

const ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.WAREHOUSE_SUPERVISOR,
  UserRole.WAREHOUSE_STAFF,
  UserRole.LOGISTICS_COORDINATOR,
  UserRole.SITE_ENGINEER,
  UserRole.QC_OFFICER,
  UserRole.FREIGHT_FORWARDER,
];
const PERMISSIONS = ['create', 'read', 'update', 'delete', 'approve', 'export'];

type PermState = PermissionOverrides;

// ── Component ──────────────────────────────────────────────────────────────────

export const RolesPage: React.FC = () => {
  const { data: permData } = usePermissions();
  const updateMutation = useUpdatePermissions();

  const overrides = (permData?.data ?? {}) as PermissionOverrides;

  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState<PermState>({});
  const [dirty, setDirty] = useState(false);

  // Build the effective matrix per role using API overrides (view mode) or local edits (edit mode)
  const effectiveForRole = useCallback(
    (role: UserRole): Record<string, string[]> => {
      if (editMode) return local[role] ?? getPermissionMatrix(role);
      return getEffectivePermissions(role, overrides);
    },
    [editMode, local, overrides],
  );

  // Enter edit mode — clone current effective permissions into local state
  const enterEditMode = useCallback(() => {
    const snapshot: PermState = {};
    for (const role of ROLES) {
      snapshot[role] = { ...getEffectivePermissions(role, overrides) };
      // Deep-clone each array
      for (const res of Object.keys(snapshot[role])) {
        snapshot[role][res] = [...snapshot[role][res]];
      }
    }
    setLocal(snapshot);
    setDirty(false);
    setEditMode(true);
  }, [overrides]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setDirty(false);
    setLocal({});
  }, []);

  // Toggle a single permission cell
  const togglePerm = useCallback((role: UserRole, resource: string, perm: string) => {
    if (role === UserRole.ADMIN) return; // Admin locked
    setLocal(prev => {
      const rolePerms = { ...(prev[role] ?? {}) };
      const current = [...(rolePerms[resource] ?? [])];
      const idx = current.indexOf(perm as Permission);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(perm as Permission);
      rolePerms[resource] = current;
      return { ...prev, [role]: rolePerms };
    });
    setDirty(true);
  }, []);

  // Compute diff: only include overrides that differ from defaults
  const computeOverrides = useCallback((): Record<string, Record<string, string[]>> => {
    const result: Record<string, Record<string, string[]>> = {};
    for (const role of ROLES) {
      if (role === UserRole.ADMIN) continue; // Never override admin
      const defaults = getPermissionMatrix(role);
      const edited = local[role] ?? {};
      const roleDiff: Record<string, string[]> = {};
      let hasDiff = false;
      for (const resource of ALL_RESOURCES) {
        const defaultPerms = (defaults[resource] ?? []).slice().sort();
        const editedPerms = (edited[resource] ?? []).slice().sort();
        if (JSON.stringify(defaultPerms) !== JSON.stringify(editedPerms)) {
          roleDiff[resource] = edited[resource] ?? [];
          hasDiff = true;
        }
      }
      if (hasDiff) result[role] = roleDiff;
    }
    return result;
  }, [local]);

  const handleSave = useCallback(() => {
    const diff = computeOverrides();
    updateMutation.mutate(diff as Record<string, unknown>, {
      onSuccess: () => {
        setEditMode(false);
        setDirty(false);
        setLocal({});
      },
    });
  }, [computeOverrides, updateMutation]);

  const handleDiscard = useCallback(() => {
    // Reset local state from loaded API overrides
    const snapshot: PermState = {};
    for (const role of ROLES) {
      snapshot[role] = { ...getEffectivePermissions(role, overrides) };
      for (const res of Object.keys(snapshot[role])) {
        snapshot[role][res] = [...snapshot[role][res]];
      }
    }
    setLocal(snapshot);
    setDirty(false);
  }, [overrides]);

  // Role cards: total permission count
  const roleStats = useMemo(
    () =>
      ROLES.map(role => {
        const matrix = effectiveForRole(role);
        const total = Object.values(matrix).reduce((s, p) => s + p.length, 0);
        return { role, total, resources: Object.keys(matrix) };
      }),
    [effectiveForRole],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-400 mt-1">
            {editMode ? 'Editing permission matrix' : 'View system roles and their access permissions'}
          </p>
        </div>
        {!editMode && (
          <button
            onClick={enterEditMode}
            className="px-4 py-2 bg-nesma-primary/20 text-nesma-secondary rounded-lg text-sm hover:bg-nesma-primary/30 border border-nesma-primary/30 flex items-center gap-2 transition-colors"
          >
            <Edit size={14} /> Edit Permissions
          </button>
        )}
        {editMode && (
          <button
            onClick={exitEditMode}
            className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 border border-white/10 flex items-center gap-2 transition-colors"
          >
            <Eye size={14} /> View Mode
          </button>
        )}
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {roleStats.map(({ role, total, resources }) => (
          <div
            key={role}
            className="glass-card rounded-xl p-4 border border-white/10 hover:border-nesma-secondary/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-nesma-primary/20 flex items-center justify-center border border-nesma-primary/30">
                {role === UserRole.ADMIN ? (
                  <Lock size={18} className="text-nesma-secondary" />
                ) : (
                  <Shield size={18} className="text-nesma-secondary" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{role}</p>
                <p className="text-[10px] text-gray-500">{total} permissions</p>
              </div>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {resources.slice(0, 5).map(r => (
                <span
                  key={r}
                  className="text-[8px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-500"
                >
                  {RESOURCE_LABELS[r] || r}
                </span>
              ))}
              {resources.length > 5 && (
                <span className="text-[8px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-500">
                  +{resources.length - 5}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Permission Matrix */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Permission Matrix</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {editMode
                ? 'Click cells to toggle permissions — Admin row is locked'
                : 'Read-only view of current permissions'}
            </p>
          </div>
          {editMode && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
              <Edit size={10} /> Edit Mode
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase tracking-wider font-semibold sticky left-0 bg-[#0a1929] z-10 min-w-[140px]">
                  Resource
                </th>
                {ROLES.map(role => (
                  <th
                    key={role}
                    className="px-2 py-3 text-[10px] text-gray-400 uppercase tracking-wider font-semibold text-center min-w-[90px]"
                  >
                    {role.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ALL_RESOURCES.map(resource => (
                <tr key={resource} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-gray-300 font-medium sticky left-0 bg-[#0a1929]/95 z-10">
                    {RESOURCE_LABELS[resource] || resource}
                  </td>
                  {ROLES.map(role => {
                    const matrix = effectiveForRole(role);
                    const perms = matrix[resource] || [];
                    const isAdmin = role === UserRole.ADMIN;
                    return (
                      <td key={role} className={`px-2 py-2.5 text-center ${isAdmin ? 'bg-nesma-primary/5' : ''}`}>
                        <div className="flex justify-center gap-0.5 flex-wrap">
                          {PERMISSIONS.map(p => {
                            const has = perms.includes(p);
                            if (!editMode || isAdmin) {
                              // View mode or locked admin row
                              return has ? (
                                <span
                                  key={p}
                                  className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center"
                                  title={p}
                                >
                                  <Check size={10} className="text-emerald-400" />
                                </span>
                              ) : (
                                <span
                                  key={p}
                                  className="w-5 h-5 rounded bg-white/5 flex items-center justify-center"
                                  title={p}
                                >
                                  <X size={8} className="text-gray-700" />
                                </span>
                              );
                            }
                            // Edit mode — clickable toggle
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => togglePerm(role, resource, p)}
                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                  has ? 'bg-emerald-500/30 hover:bg-emerald-500/40' : 'bg-white/5 hover:bg-white/15'
                                }`}
                                title={`${has ? 'Remove' : 'Add'} ${p}`}
                              >
                                {has ? (
                                  <Check size={10} className="text-emerald-400" />
                                ) : (
                                  <X size={8} className="text-gray-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-white/10 bg-white/5 flex items-center gap-4 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500/20 inline-flex items-center justify-center">
              <Check size={8} className="text-emerald-400" />
            </span>{' '}
            Has permission
          </span>
          <span>Order: Create | Read | Update | Delete | Approve | Export</span>
          {editMode && (
            <span className="flex items-center gap-1 ml-auto text-amber-400">
              <Lock size={8} /> Admin row locked
            </span>
          )}
        </div>
      </div>

      {/* Unsaved Changes Bar */}
      {editMode && dirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-500/10 border-t border-amber-500/30 p-3 flex justify-between items-center z-40">
          <span className="text-sm text-amber-300 font-medium">Unsaved changes to permission matrix</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              className="bg-white/5 text-gray-300 rounded-lg px-4 py-2 border border-white/10 text-sm hover:bg-white/10 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={14} />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
