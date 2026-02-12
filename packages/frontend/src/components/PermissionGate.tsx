import React from 'react';
import type { Permission } from '@nit-scs-v2/shared/permissions';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGateProps {
  resource: string;
  action: Permission;
  /** Content to render when permission is denied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions.
 * Usage:
 *   <PermissionGate resource="grn" action="create">
 *     <button>New GRN</button>
 *   </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({ resource, action, fallback = null, children }) => {
  const allowed = usePermission(resource, action);
  return <>{allowed ? children : fallback}</>;
};
