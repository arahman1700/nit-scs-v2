import React, { useState } from 'react';
import { Bell, Mail, FileText } from 'lucide-react';
import type { Tab } from './notifications/notificationHelpers';
import { EmailTemplatesTab } from './notifications/EmailTemplatesTab';
import { NotificationPreferencesTab } from './notifications/NotificationPreferencesTab';
import { NotificationLogTab } from './notifications/NotificationLogTab';

// ── Constants ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'templates', label: 'Email Templates', icon: Mail },
  { id: 'preferences', label: 'Notification Preferences', icon: Bell },
  { id: 'logs', label: 'Notification Log', icon: FileText },
];

// ── Component ──────────────────────────────────────────────────────────────

export function NotificationRulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Bell size={24} className="text-nesma-secondary" />
            <h1 className="text-2xl font-bold text-white">Notifications & Rules</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Manage email templates, notification preferences, and delivery logs
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card rounded-2xl p-1.5">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && <EmailTemplatesTab />}
      {activeTab === 'preferences' && <NotificationPreferencesTab />}
      {activeTab === 'logs' && <NotificationLogTab />}
    </div>
  );
}
