import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import type { User } from '@nit-scs-v2/shared/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useRealtimeSync } from '@/socket/useRealtimeSync';
import { useCurrentUser } from '@/api/hooks/useAuth';

export const MainLayout: React.FC<{
  children: React.ReactNode;
  role: UserRole;
  setRole: (r: UserRole) => void;
  onLogout: () => void;
}> = ({ children, role, setRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();

  // Real-time: invalidate React Query caches on Socket.IO events
  useRealtimeSync();

  // Track window size changes via resize observer
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile && !isSidebarOpen) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Close sidebar on mobile route change
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  // Handle Role Switching Redirection
  useEffect(() => {
    const basePath = location.pathname.split('/')[1];
    const roleBasePaths: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'admin',
      [UserRole.MANAGER]: 'manager',
      [UserRole.WAREHOUSE_SUPERVISOR]: 'warehouse',
      [UserRole.WAREHOUSE_STAFF]: 'warehouse',
      [UserRole.LOGISTICS_COORDINATOR]: 'logistics',
      [UserRole.SITE_ENGINEER]: 'site-engineer',
      [UserRole.QC_OFFICER]: 'qc',
      [UserRole.FREIGHT_FORWARDER]: 'transport',
      [UserRole.TRANSPORT_SUPERVISOR]: 'logistics',
      [UserRole.SCRAP_COMMITTEE_MEMBER]: 'assets',
    };
    const expectedPath = roleBasePaths[role] || 'admin';

    if (basePath !== expectedPath) {
      navigate(`/${expectedPath}`);
    }
  }, [role, navigate]);

  // Build user object from real API data
  const meQuery = useCurrentUser();
  const meData = meQuery.data?.data as { id: string; fullName: string; email: string; department: string } | undefined;

  const user: User = meData
    ? {
        id: meData.id,
        name: meData.fullName || meData.email,
        email: meData.email,
        role,
        avatar: '',
        department: meData.department,
      }
    : { id: '', name: 'Loading...', email: '', role, avatar: '' };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-nesma-dark to-[#051020] text-white font-sans">
      {/* Skip Navigation — Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:start-2 focus:px-4 focus:py-2 focus:bg-nesma-primary focus:text-white focus:rounded-lg focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Offline banner */}
      {isOffline && (
        <div
          className="fixed top-0 inset-x-0 z-[100] bg-amber-600 text-white text-center text-sm py-1.5 px-4"
          role="alert"
        >
          You are currently offline. Some features may be unavailable.
        </div>
      )}

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 start-0 z-50 transform ${isSidebarOpen ? 'translate-x-0 rtl:-translate-x-0' : '-translate-x-full rtl:translate-x-full'} lg:relative lg:translate-x-0 rtl:lg:-translate-x-0 transition-transform duration-300 ease-in-out h-full`}
      >
        <Sidebar role={role} isOpen={isSidebarOpen} setRole={setRole} isMobile={isMobile} onLogout={onLogout} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 w-full">
        <Header toggleSidebar={toggleSidebar} user={user} role={role} />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 relative scroll-smooth"
          role="main"
        >
          {/* Background texture (inline SVG noise — no external CDN) */}
          <div className="absolute top-0 start-0 w-full h-full opacity-20 pointer-events-none fixed bg-[url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E&quot;)]"></div>
          <div className="relative z-10 min-h-full pb-10">{children}</div>
        </main>
      </div>

      <PwaInstallPrompt />
      <PwaUpdatePrompt />
      <OfflineIndicator />
    </div>
  );
};
