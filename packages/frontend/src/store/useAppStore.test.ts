import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import type { User, Notification } from '@nit-scs-v2/shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'u1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  avatar: '',
} as unknown as User;

const createNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'n1',
    type: 'system',
    title: 'Test',
    message: 'msg',
    severity: 'info',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }) as unknown as Notification;

// ── Setup ────────────────────────────────────────────────────────────────

let setItemSpy: ReturnType<typeof vi.fn>;
let removeItemSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Reset store to known defaults
  useAppStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    notifications: [],
    unreadCount: 0,
    sidebarOpen: true,
    theme: 'dark',
  });

  vi.restoreAllMocks();

  // Mock localStorage methods directly on the global object
  setItemSpy = vi.fn();
  removeItemSpy = vi.fn();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn(),
      setItem: setItemSpy,
      removeItem: removeItemSpy,
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('useAppStore', () => {
  // ── Initial state ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has null user, null token, and isAuthenticated false', () => {
      const state = useAppStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('has empty notifications and zero unreadCount', () => {
      const state = useAppStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('has theme set to dark', () => {
      expect(useAppStore.getState().theme).toBe('dark');
    });
  });

  // ── Auth ─────────────────────────────────────────────────────────────

  describe('setAuth', () => {
    it('sets user, token, and isAuthenticated to true', () => {
      useAppStore.getState().setAuth(mockUser, 'tok_123');

      const state = useAppStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('tok_123');
      expect(state.isAuthenticated).toBe(true);
    });

    it('persists token to localStorage', () => {
      useAppStore.getState().setAuth(mockUser, 'tok_123');

      expect(setItemSpy).toHaveBeenCalledWith('nit_scs_token', 'tok_123');
    });
  });

  describe('clearAuth', () => {
    it('resets user, token, and isAuthenticated', () => {
      // Arrange: set auth first
      useAppStore.getState().setAuth(mockUser, 'tok_123');

      // Act
      useAppStore.getState().clearAuth();

      const state = useAppStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('removes both tokens from localStorage', () => {
      useAppStore.getState().clearAuth();

      expect(removeItemSpy).toHaveBeenCalledWith('nit_scs_token');
      expect(removeItemSpy).toHaveBeenCalledWith('nit_scs_refresh_token');
    });
  });

  // ── Notifications ────────────────────────────────────────────────────

  describe('addNotification', () => {
    it('prepends notification and increments unreadCount', () => {
      const n1 = createNotification({ id: 'n1' });
      const n2 = createNotification({ id: 'n2' });

      useAppStore.getState().addNotification(n1);
      useAppStore.getState().addNotification(n2);

      const state = useAppStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].id).toBe('n2'); // most recent first
      expect(state.notifications[1].id).toBe('n1');
      expect(state.unreadCount).toBe(2);
    });
  });

  describe('markAsRead', () => {
    it('marks a specific notification as read and decrements unreadCount', () => {
      const n1 = createNotification({ id: 'n1', read: false });
      const n2 = createNotification({ id: 'n2', read: false });
      useAppStore.getState().addNotification(n1);
      useAppStore.getState().addNotification(n2);

      useAppStore.getState().markAsRead('n1');

      const state = useAppStore.getState();
      const marked = state.notifications.find(n => n.id === 'n1');
      expect(marked!.read).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('does not decrement unreadCount when marking an already-read notification', () => {
      const n = createNotification({ id: 'n1', read: false });
      useAppStore.getState().addNotification(n);

      // Mark once
      useAppStore.getState().markAsRead('n1');
      expect(useAppStore.getState().unreadCount).toBe(0);

      // Mark again — should stay at 0
      useAppStore.getState().markAsRead('n1');
      expect(useAppStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read and sets unreadCount to 0', () => {
      useAppStore.getState().addNotification(createNotification({ id: 'n1' }));
      useAppStore.getState().addNotification(createNotification({ id: 'n2' }));
      useAppStore.getState().addNotification(createNotification({ id: 'n3' }));

      useAppStore.getState().markAllAsRead();

      const state = useAppStore.getState();
      expect(state.notifications.every(n => n.read)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('clearNotifications', () => {
    it('empties notifications array and resets unreadCount', () => {
      useAppStore.getState().addNotification(createNotification({ id: 'n1' }));
      useAppStore.getState().addNotification(createNotification({ id: 'n2' }));

      useAppStore.getState().clearNotifications();

      const state = useAppStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });
  });

  // ── UI ───────────────────────────────────────────────────────────────

  describe('setSidebarOpen', () => {
    it('toggles sidebarOpen state', () => {
      useAppStore.getState().setSidebarOpen(false);
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().setSidebarOpen(true);
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('setTheme', () => {
    it('changes the theme', () => {
      useAppStore.getState().setTheme('light');
      expect(useAppStore.getState().theme).toBe('light');

      useAppStore.getState().setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');
    });
  });
});
