import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Package, Clock, Info, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from '@/api/hooks';
import { formatRelativeTime } from '@nit-scs-v2/shared/formatters';
import type { Notification } from '@nit-scs-v2/shared/types';

// ── Icon / color maps ──────────────────────────────────────────────────────

const NOTIFICATION_ICONS: Record<Notification['type'], React.ElementType> = {
  approval_request: Clock,
  approval_result: CheckCircle,
  sla_warning: AlertTriangle,
  sla_breach: AlertTriangle,
  stock_alert: Package,
  status_change: Info,
  system: Info,
};

const NOTIFICATION_COLORS: Record<Notification['severity'], string> = {
  info: 'text-blue-400 bg-blue-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  error: 'text-red-400 bg-red-500/10',
  success: 'text-emerald-400 bg-emerald-500/10',
};

// ── Main Component ─────────────────────────────────────────────────────────

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // React Query hooks — backed by real API
  const { data: notificationsResponse, isLoading } = useNotifications({ pageSize: 30 });
  const { data: unreadResponse } = useUnreadCount();
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();

  const notifications: Notification[] = notificationsResponse?.data ?? [];
  const unreadCount: number = (unreadResponse?.data as number) ?? 0;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  // Group notifications by read/unread
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative cursor-pointer p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-nesma-dark flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] flex flex-col bg-nesma-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-nesma-secondary bg-nesma-secondary/10 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                  className="text-[10px] font-medium text-nesma-secondary hover:text-white transition-colors disabled:opacity-50"
                >
                  {markAllReadMutation.isPending ? 'Marking...' : 'Mark all read'}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <Loader2 size={28} className="text-nesma-secondary animate-spin mb-3" />
                <p className="text-sm text-gray-400">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <div className="p-4 rounded-full bg-white/5 mb-4">
                  <Bell size={28} className="text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-400">No notifications</p>
                <p className="text-xs text-gray-600 mt-1">You're all caught up</p>
              </div>
            ) : (
              <>
                {/* Unread Section */}
                {unreadNotifications.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-white/[0.02]">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">New</p>
                    </div>
                    {unreadNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))}
                  </div>
                )}

                {/* Read Section */}
                {readNotifications.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-white/[0.02]">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Earlier</p>
                    </div>
                    {readNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Individual Notification Item ───────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClick }) => {
  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
  const colorClass = NOTIFICATION_COLORS[notification.severity] || NOTIFICATION_COLORS.info;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-5 py-3.5 text-left transition-all hover:bg-white/5 group ${
        !notification.read ? 'bg-nesma-primary/[0.05]' : ''
      }`}
    >
      {/* Icon */}
      <div className={`p-2 rounded-xl flex-shrink-0 ${colorClass}`}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${notification.read ? 'text-gray-400' : 'text-white'}`}>
            {notification.title}
          </p>
          {/* Unread Dot */}
          {!notification.read && (
            <span className="w-2 h-2 rounded-full bg-nesma-secondary flex-shrink-0 shadow-[0_0_6px_rgba(128,209,233,0.6)]" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-gray-600 mt-1.5">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </button>
  );
};
