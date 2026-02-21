import React, { Suspense, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserRole } from '@nit-scs-v2/shared/types';
import { useCurrentUser } from '@/api/hooks/useAuth';
import { connectSocket, disconnectSocket } from '@/socket/client';
import { MainLayout } from '@/layouts/MainLayout';
import { AppRouteDefinitions } from '@/routes';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

const LoginPage = React.lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));

/** Map backend systemRole string to UserRole enum (now 1:1 since enums match DB values) */
function mapSystemRoleToUserRole(systemRole: string): UserRole {
  const valid = Object.values(UserRole) as string[];
  if (valid.includes(systemRole)) return systemRole as UserRole;
  return UserRole.WAREHOUSE_STAFF; // safe fallback
}

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full"></div>
  </div>
);

export const AuthGuard: React.FC = () => {
  const queryClient = useQueryClient();
  const hasToken = !!localStorage.getItem('nit_scs_token');
  const meQuery = useCurrentUser();

  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.ADMIN);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(hasToken);

  // Restore session from token on mount / when meQuery resolves
  useEffect(() => {
    if (meQuery.data?.data) {
      const user = meQuery.data.data;
      const role = mapSystemRoleToUserRole(user.systemRole);
      setCurrentRole(role);
      setIsAuthenticated(true);
      setIsInitializing(false);
      connectSocket(localStorage.getItem('nit_scs_token') || '');
    } else if (meQuery.isError || (!hasToken && !meQuery.isLoading)) {
      if (meQuery.isError) {
        localStorage.removeItem('nit_scs_token');
        localStorage.removeItem('nit_scs_refresh_token');
      }
      setIsInitializing(false);
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, hasToken]);

  const handleLogin = (role: UserRole) => {
    setCurrentRole(role);
    setIsAuthenticated(true);
    const token = localStorage.getItem('nit_scs_token') || '';
    connectSocket(token);
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem('nit_scs_token');
    localStorage.removeItem('nit_scs_refresh_token');
    queryClient.clear();
    setIsAuthenticated(false);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-nesma-dark to-nesma-dark">
        <div className="animate-spin w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <RouteErrorBoundary label="Login">
        <Suspense fallback={<PageLoader />}>
          <LoginPage onLogin={handleLogin} />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  return (
    <MainLayout role={currentRole} setRole={setCurrentRole} onLogout={handleLogout}>
      <RouteErrorBoundary label="Page">
        <Suspense fallback={<PageLoader />}>
          <AppRouteDefinitions currentRole={currentRole} />
        </Suspense>
      </RouteErrorBoundary>
    </MainLayout>
  );
};
