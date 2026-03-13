import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Compass,
  FormInput,
  FileText,
  GitBranch,
  Bell,
  Clock,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

// ── Settings Categories ────────────────────────────────────────────────

interface SettingsCategory {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  href: string;
  badge: number | null;
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'navigation',
    label: 'Navigation & Layout',
    description: 'Configure sidebar menus, section ordering, and visibility per role',
    icon: Compass,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    href: '/admin/settings/navigation',
    badge: null,
  },
  {
    id: 'custom-fields',
    label: 'Custom Fields',
    description: 'Add custom fields to any document type \u2014 text, numbers, dates, dropdowns',
    icon: FormInput,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    href: '/admin/settings/custom-fields',
    badge: null,
  },
  {
    id: 'document-types',
    label: 'Document Types',
    description: 'Create custom document types with configurable status flows and fields',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    href: '/admin/settings/document-types',
    badge: null,
  },
  {
    id: 'workflows',
    label: 'Workflows & Approvals',
    description: 'Design approval chains, delegation rules, and automated workflows',
    icon: GitBranch,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    href: '/admin/settings/workflows',
    badge: null,
  },
  {
    id: 'notifications',
    label: 'Notifications & Rules',
    description: 'Configure alert rules, email templates, and automation triggers',
    icon: Bell,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    href: '/admin/settings/notifications',
    badge: null,
  },
  {
    id: 'scheduler',
    label: 'Scheduler & Jobs',
    description: 'Monitor scheduled jobs, view execution history, and manage the dead letter queue',
    icon: Clock,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    href: '/admin/settings/scheduler',
    badge: null,
  },
  {
    id: 'system',
    label: 'System Configuration',
    description: 'Email settings, SLA thresholds, branding, and general preferences',
    icon: Settings,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    href: '/admin/settings/system',
    badge: null,
  },
];

// ── SettingsCard ────────────────────────────────────────────────────────

interface SettingsCardProps {
  category: SettingsCategory;
  onClick: () => void;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ category, onClick }) => {
  const Icon = category.icon;

  return (
    <button
      onClick={onClick}
      className="glass-card rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 cursor-pointer group text-left w-full"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Icon circle */}
          <div className={`w-12 h-12 rounded-xl ${category.bgColor} flex items-center justify-center shrink-0`}>
            <Icon size={24} className={category.color} />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white group-hover:text-nesma-secondary transition-colors">
                {category.label}
              </h3>
              {category.badge !== null && (
                <span className="px-2 py-0.5 text-xs font-medium bg-nesma-primary/30 text-nesma-secondary rounded-full">
                  {category.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">{category.description}</p>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={20}
          className="text-gray-400 group-hover:text-nesma-secondary group-hover:translate-x-1 transition-all duration-300 shrink-0 mt-1"
        />
      </div>
    </button>
  );
};

// ── AdminSettingsHub ────────────────────────────────────────────────────

export const AdminSettingsHub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={22} className="text-nesma-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Settings</h1>
            <p className="text-sm text-gray-400">Configure and customize your NIT supply chain system</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-gray-400">System Status:</span>
            <span className="text-emerald-400 font-medium">Operational</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Roles:</span>
            <span className="text-white font-medium">14 configured</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Workflows:</span>
            <span className="text-white font-medium">Active</span>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SETTINGS_CATEGORIES.map(category => (
          <SettingsCard key={category.id} category={category} onClick={() => navigate(category.href)} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-xs text-gray-400 text-center">
          Changes to system settings may require a page refresh to take effect across all users. Critical changes are
          logged in the audit trail.
        </p>
      </div>
    </div>
  );
};
