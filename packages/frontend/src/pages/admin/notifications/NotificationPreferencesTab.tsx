import React, { useState, useCallback } from 'react';
import { apiClient } from '@/api/client';
import type { NotificationPreference } from './notificationHelpers';
import { EVENT_TYPES } from './notificationHelpers';
import { Bell, Save, CheckCircle2, Mail, MonitorSmartphone, Smartphone } from 'lucide-react';

export function NotificationPreferencesTab() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(() =>
    EVENT_TYPES.map(et => ({
      eventType: et.value,
      label: et.label,
      description: et.description,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: true,
    })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleChannel = useCallback((eventType: string, channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => (p.eventType === eventType ? { ...p, [channel]: !p[channel] } : p)));
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save preferences via settings endpoint
      await apiClient.put('/settings', {
        key: 'notification_preferences',
        value: preferences.map(p => ({
          eventType: p.eventType,
          emailEnabled: p.emailEnabled,
          inAppEnabled: p.inAppEnabled,
          pushEnabled: p.pushEnabled,
        })),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Fail silently -- the apiClient interceptor handles errors via toast
    } finally {
      setIsSaving(false);
    }
  }, [preferences]);

  const enableAllForChannel = useCallback((channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => ({ ...p, [channel]: true })));
    setSaveSuccess(false);
  }, []);

  const disableAllForChannel = useCallback((channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => ({ ...p, [channel]: false })));
    setSaveSuccess(false);
  }, []);

  const allEnabled = useCallback(
    (channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => preferences.every(p => p[channel]),
    [preferences],
  );

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Notification Channels</h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure which notification channels are active for each event type
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={16} />
                Saved
              </>
            ) : (
              <>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </>
            )}
          </button>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-4 items-center mb-3 px-4">
          <span className="text-sm font-medium text-gray-400">Event Type</span>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('emailEnabled') ? disableAllForChannel('emailEnabled') : enableAllForChannel('emailEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Mail size={16} className="mx-auto mb-1" />
              Email
            </button>
          </div>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('inAppEnabled') ? disableAllForChannel('inAppEnabled') : enableAllForChannel('inAppEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <MonitorSmartphone size={16} className="mx-auto mb-1" />
              In-App
            </button>
          </div>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('pushEnabled') ? disableAllForChannel('pushEnabled') : enableAllForChannel('pushEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Smartphone size={16} className="mx-auto mb-1" />
              Push
            </button>
          </div>
        </div>

        {/* Event Rows */}
        <div className="space-y-1">
          {preferences.map(pref => (
            <div
              key={pref.eventType}
              className="grid grid-cols-[1fr_100px_100px_100px] gap-4 items-center bg-white/5 rounded-xl px-4 py-3 hover:bg-white/10 transition-all duration-300"
            >
              <div>
                <p className="text-white text-sm font-medium">{pref.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pref.description}</p>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'emailEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.emailEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle email for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.emailEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'inAppEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.inAppEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle in-app for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.inAppEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'pushEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.pushEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle push for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.pushEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
