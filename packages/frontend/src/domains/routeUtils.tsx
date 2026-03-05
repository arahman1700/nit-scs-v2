import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';

// ── Role-based route guard component ──────────────────────────────────────
export const RoleGuard: React.FC<{
  currentRole: UserRole;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ currentRole, allowedRoles, children }) => {
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// ── Role groups ──────────────────────────────────────────────────────────
export const ADMIN_MANAGER_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SCRAP_COMMITTEE_MEMBER,
  UserRole.FINANCE_USER,
  UserRole.COMPLIANCE_OFFICER,
];
export const WAREHOUSE_ROLES = [
  UserRole.ADMIN,
  UserRole.WAREHOUSE_SUPERVISOR,
  UserRole.WAREHOUSE_STAFF,
  UserRole.GATE_OFFICER,
  UserRole.INVENTORY_SPECIALIST,
];
export const TRANSPORT_ROLES = [UserRole.ADMIN, UserRole.FREIGHT_FORWARDER, UserRole.TRANSPORT_SUPERVISOR];
export const QC_ROLES = [UserRole.ADMIN, UserRole.QC_OFFICER];
export const LOGISTICS_ROLES = [
  UserRole.ADMIN,
  UserRole.LOGISTICS_COORDINATOR,
  UserRole.TRANSPORT_SUPERVISOR,
  UserRole.SHIPPING_OFFICER,
  UserRole.CUSTOMS_SPECIALIST,
];
export const ENGINEER_ROLES = [UserRole.ADMIN, UserRole.SITE_ENGINEER];
export const MANAGER_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICAL_MANAGER];

// ── Role-to-redirect map ─────────────────────────────────────────────────
export const ROLE_REDIRECT: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.MANAGER]: '/manager',
  [UserRole.WAREHOUSE_SUPERVISOR]: '/warehouse',
  [UserRole.WAREHOUSE_STAFF]: '/warehouse',
  [UserRole.LOGISTICS_COORDINATOR]: '/logistics',
  [UserRole.SITE_ENGINEER]: '/site-engineer',
  [UserRole.QC_OFFICER]: '/qc',
  [UserRole.FREIGHT_FORWARDER]: '/transport',
  [UserRole.TRANSPORT_SUPERVISOR]: '/logistics',
  [UserRole.SCRAP_COMMITTEE_MEMBER]: '/admin',
  // SOW Section 13.1 — additional roles
  [UserRole.TECHNICAL_MANAGER]: '/manager',
  [UserRole.GATE_OFFICER]: '/warehouse',
  [UserRole.INVENTORY_SPECIALIST]: '/warehouse',
  [UserRole.SHIPPING_OFFICER]: '/logistics',
  [UserRole.FINANCE_USER]: '/admin',
  [UserRole.CUSTOMS_SPECIALIST]: '/logistics',
  [UserRole.COMPLIANCE_OFFICER]: '/admin',
};

// ── 404 Not Found page ───────────────────────────────────────────────────
export const NotFoundPage: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="glass-card rounded-2xl p-10 max-w-md text-center border border-white/10">
      <div className="text-6xl font-bold text-nesma-primary mb-4">404</div>
      <h1 className="text-xl font-semibold text-white mb-2">Page Not Found</h1>
      <p className="text-gray-400 text-sm mb-6">The page you are looking for does not exist or has been moved.</p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm"
      >
        Go to Dashboard
      </a>
    </div>
  </div>
);
