import { useMemo } from 'react';
import type { Permission } from '@nit-scs-v2/shared/permissions';
import { useCurrentUser, usePermissions } from '@/api/hooks';

type PermissionMatrix = Record<string, Record<string, Permission[]>>;

/**
 * Check if current user has a specific permission on a resource.
 * Reads from the DB-backed permissions API (cached 5 minutes).
 */
export function usePermission(resource: string, action: Permission): boolean {
  const { data: meData } = useCurrentUser();
  const { data: permData } = usePermissions();

  return useMemo(() => {
    const role = meData?.data?.systemRole;
    if (!role) return false;

    // Admin always has access
    if (role === 'admin') return true;

    const matrix = permData?.data as PermissionMatrix | undefined;
    if (!matrix || !matrix[role]) return false;

    const resourcePerms = matrix[role][resource];
    if (!resourcePerms) return false;
    return resourcePerms.includes(action);
  }, [meData?.data?.systemRole, permData?.data, resource, action]);
}

/**
 * Get the full permission set for the current user's role.
 */
export function useRolePermissions(): Record<string, Permission[]> {
  const { data: meData } = useCurrentUser();
  const { data: permData } = usePermissions();

  return useMemo(() => {
    const role = meData?.data?.systemRole;
    if (!role) return {};

    const matrix = permData?.data as PermissionMatrix | undefined;
    if (!matrix || !matrix[role]) return {};
    return matrix[role];
  }, [meData?.data?.systemRole, permData?.data]);
}
