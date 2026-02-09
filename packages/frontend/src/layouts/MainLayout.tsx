import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import type { User } from '@nit-scs-v2/shared/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import { useRealtimeSync } from '@/socket/useRealtimeSync';
import { useCurrentUser } from '@/api/hooks/useAuth';

export const MainLayout: React.FC<{
  children: React.ReactNode;
  role: UserRole;
  setRole: (r: UserRole) => void;
  onLogout: () => void;
}> = ({ children, role, setRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const location = useLocation();
  const navigate = useNavigate();

  // Real-time: invalidate React Query caches on Socket.IO events
  useRealtimeSync();

  // Close sidebar on mobile route change
  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

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
      [UserRole.SCRAP_COMMITTEE_MEMBER]: 'admin',
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
        <Sidebar
          role={role}
          isOpen={isSidebarOpen}
          setRole={setRole}
          isMobile={window.innerWidth <= 1024}
          onLogout={onLogout}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 w-full">
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} user={user} role={role} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 relative scroll-smooth">
          {/* Background texture (inline SVG noise — no external CDN) */}
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none fixed bg-[url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E&quot;)]"></div>
          <div className="relative z-10 min-h-full pb-10">{children}</div>
        </main>
      </div>

      <PwaInstallPrompt />
      <PwaUpdatePrompt />
    </div>
  );
};
