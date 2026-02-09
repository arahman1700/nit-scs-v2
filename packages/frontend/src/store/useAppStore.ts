// ============================================================================
// Global Application Store (Zustand)
// Auth, notifications, UI preferences
// ============================================================================

import { create } from 'zustand';
import type { User, Notification } from '@nit-scs/shared/types';
import { UserRole } from '@nit-scs/shared/types';

interface AppState {
  // Auth (managed by login API response)
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;

  // UI Preferences
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user: User, token: string) => {
    localStorage.setItem('nit_scs_token', token);
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('nit_scs_token');
    localStorage.removeItem('nit_scs_refresh_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // Notifications (populated via WebSocket / API)
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
  markAsRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
    }));
  },
  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  // UI
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 1024 : true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
