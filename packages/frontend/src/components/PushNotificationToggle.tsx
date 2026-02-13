// ============================================================================
// Push Notification Toggle — Enable / Disable web push notifications
// ============================================================================
// Renders a toggle switch with status indicator. Handles permission request,
// subscription lifecycle, and displays current state.
// Designed for use in the Header dropdown or Settings page.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '@/services/pushNotifications';

export const PushNotificationToggle: React.FC = () => {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // Check current state on mount
  useEffect(() => {
    async function check() {
      const isSupported = isPushSupported();
      setSupported(isSupported);

      if (!isSupported) {
        setLoading(false);
        return;
      }

      if (Notification.permission === 'denied') {
        setDenied(true);
        setLoading(false);
        return;
      }

      const isSub = await isPushSubscribed();
      setSubscribed(isSub);
      setLoading(false);
    }
    check();
  }, []);

  const handleToggle = useCallback(async () => {
    if (loading || !supported || denied) return;

    setLoading(true);
    try {
      if (subscribed) {
        const success = await unsubscribeFromPush();
        if (success) setSubscribed(false);
      } else {
        const success = await subscribeToPush();
        if (success) {
          setSubscribed(true);
        } else if (Notification.permission === 'denied') {
          setDenied(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [loading, supported, denied, subscribed]);

  // ── Not supported ───────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
        <BellOff size={16} className="text-gray-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400">Push Notifications</p>
          <p className="text-[10px] text-gray-600">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  // ── Permission denied ───────────────────────────────────────────────────
  if (denied) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/10">
        <BellOff size={16} className="text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-red-400">Push Notifications</p>
          <p className="text-[10px] text-gray-500">Blocked by browser. Enable in browser settings.</p>
        </div>
      </div>
    );
  }

  // ── Normal toggle ───────────────────────────────────────────────────────
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-wait group"
    >
      {loading ? (
        <Loader2 size={16} className="text-nesma-secondary animate-spin flex-shrink-0" />
      ) : subscribed ? (
        <BellRing size={16} className="text-nesma-secondary flex-shrink-0" />
      ) : (
        <BellOff size={16} className="text-gray-500 flex-shrink-0 group-hover:text-gray-300 transition-colors" />
      )}

      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-medium text-gray-300">Push Notifications</p>
        <p className="text-[10px] text-gray-500">{loading ? 'Updating...' : subscribed ? 'Enabled' : 'Disabled'}</p>
      </div>

      {/* Toggle Switch */}
      <div
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
          subscribed ? 'bg-nesma-secondary/30' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all shadow-sm ${
            subscribed ? 'left-[calc(100%-1.125rem)] bg-nesma-secondary' : 'left-0.5 bg-gray-500'
          }`}
        />
      </div>
    </button>
  );
};
