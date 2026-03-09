import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, ChevronUp, ChevronDown, Eye, EyeOff, Save, RotateCcw, ChevronRight } from 'lucide-react';
import { SECTION_NAVIGATION } from '@/config/navigation';
import { UserRole } from '@nit-scs-v2/shared/types';
import type { NavSection } from '@nit-scs-v2/shared/types';

// ── Types ──────────────────────────────────────────────────────────────

interface NavItemConfig {
  label: string;
  path: string;
  icon?: string;
  visible: boolean;
}

interface NavSectionConfig {
  section: string;
  visible: boolean;
  items: NavItemConfig[];
}

type RoleNavConfig = NavSectionConfig[];

// ── Role labels ────────────────────────────────────────────────────────

const ROLE_OPTIONS = Object.values(UserRole)
  .filter(role => SECTION_NAVIGATION[role])
  .map(role => ({
    value: role,
    label: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }));

// ── Helpers ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nit-nav-config';

function loadConfig(): Record<string, RoleNavConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConfig(config: Record<string, RoleNavConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function defaultConfigForRole(role: string): RoleNavConfig {
  const sections = SECTION_NAVIGATION[role] ?? [];
  return sections.map((sec: NavSection) => {
    // Collect all items: direct items + items from children sub-groups
    const allItems = [...sec.items, ...(sec.children ?? []).flatMap(group => group.items)];
    return {
      section: sec.section,
      visible: true,
      items: allItems
        .filter(item => item.path) // Skip items without paths
        .map(item => ({
          label: item.label,
          path: item.path!,
          icon: item.icon,
          visible: true,
        })),
    };
  });
}

// ── SectionEditor ──────────────────────────────────────────────────────

interface SectionEditorProps {
  section: NavSectionConfig;
  index: number;
  totalSections: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSection: () => void;
  onToggleItem: (itemIndex: number) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  index,
  totalSections,
  onMoveUp,
  onMoveDown,
  onToggleSection,
  onToggleItem,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${
        section.visible ? '' : 'opacity-60'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 hover:bg-white/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move section up"
            >
              <ChevronUp size={14} className="text-gray-400" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === totalSections - 1}
              className="p-1 hover:bg-white/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move section down"
            >
              <ChevronDown size={14} className="text-gray-400" />
            </button>
          </div>

          {/* Section name */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-semibold text-white hover:text-nesma-secondary transition-colors"
          >
            <ChevronRight
              size={16}
              className={`transform transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
            {section.section}
          </button>

          <span className="text-xs text-gray-500">
            {section.items.filter(i => i.visible).length}/{section.items.length} items
          </span>
        </div>

        {/* Visibility toggle */}
        <button
          onClick={onToggleSection}
          className={`p-2 rounded-lg transition-all ${
            section.visible ? 'hover:bg-white/10 text-nesma-secondary' : 'hover:bg-white/10 text-gray-600'
          }`}
          aria-label={section.visible ? 'Hide section' : 'Show section'}
        >
          {section.visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* Items */}
      {expanded && (
        <div className="p-3 space-y-1">
          {section.items.map((item, itemIdx) => (
            <div
              key={item.path}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                item.visible ? 'hover:bg-white/5' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <span className={`text-sm ${item.visible ? 'text-gray-300' : 'text-gray-500 line-through'}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-gray-600 font-mono">{item.path}</span>
              </div>

              <button
                onClick={() => onToggleItem(itemIdx)}
                className={`p-1.5 rounded-lg transition-all ${
                  item.visible ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white/10 text-gray-600'
                }`}
                aria-label={item.visible ? 'Hide item' : 'Show item'}
              >
                {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Preview Panel ──────────────────────────────────────────────────────

interface PreviewPanelProps {
  config: RoleNavConfig;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ config }) => {
  const visibleSections = config.filter(s => s.visible);

  return (
    <div className="glass-card rounded-2xl p-4 sticky top-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Sidebar Preview</h3>

      <div className="space-y-4">
        {visibleSections.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No visible sections</p>}
        {visibleSections.map(section => {
          const visibleItems = section.items.filter(i => i.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-2">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <div
                    key={item.path}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-4 h-4 rounded bg-white/10" />
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── NavigationSettingsPage ──────────────────────────────────────────────

export const NavigationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string>(ROLE_OPTIONS[0]?.value ?? UserRole.ADMIN);
  const [allConfigs, setAllConfigs] = useState<Record<string, RoleNavConfig>>(loadConfig);
  const [hasChanges, setHasChanges] = useState(false);

  // Get or initialize config for selected role
  const currentConfig = useMemo(() => {
    return allConfigs[selectedRole] ?? defaultConfigForRole(selectedRole);
  }, [selectedRole, allConfigs]);

  // Update config for a role
  const updateConfig = useCallback(
    (newConfig: RoleNavConfig) => {
      setAllConfigs(prev => ({
        ...prev,
        [selectedRole]: newConfig,
      }));
      setHasChanges(true);
    },
    [selectedRole],
  );

  // Move section up/down
  const moveSection = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= currentConfig.length) return;
      const next = [...currentConfig];
      [next[index], next[target]] = [next[target], next[index]];
      updateConfig(next);
    },
    [currentConfig, updateConfig],
  );

  // Toggle section visibility
  const toggleSection = useCallback(
    (index: number) => {
      const next = [...currentConfig];
      next[index] = { ...next[index], visible: !next[index].visible };
      updateConfig(next);
    },
    [currentConfig, updateConfig],
  );

  // Toggle item visibility
  const toggleItem = useCallback(
    (sectionIndex: number, itemIndex: number) => {
      const next = [...currentConfig];
      const items = [...next[sectionIndex].items];
      items[itemIndex] = { ...items[itemIndex], visible: !items[itemIndex].visible };
      next[sectionIndex] = { ...next[sectionIndex], items };
      updateConfig(next);
    },
    [currentConfig, updateConfig],
  );

  // Save
  const handleSave = useCallback(() => {
    saveConfig(allConfigs);
    setHasChanges(false);
  }, [allConfigs]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setAllConfigs(prev => {
      const next = { ...prev };
      delete next[selectedRole];
      return next;
    });
    setHasChanges(true);
  }, [selectedRole]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/settings')}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            aria-label="Back to settings"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Compass size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Navigation Settings</h1>
            <p className="text-sm text-gray-400">Customize sidebar navigation per role</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {hasChanges ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="glass-card rounded-2xl p-4">
        <label className="text-sm text-gray-300 block mb-2">Select Role</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(role => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                selectedRole === role.value
                  ? 'bg-nesma-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content: Editor + Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Editor - 2 columns */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Sections & Items</h2>
            <span className="text-xs text-gray-500">{currentConfig.length} sections</span>
          </div>

          {currentConfig.map((section, idx) => (
            <SectionEditor
              key={section.section}
              section={section}
              index={idx}
              totalSections={currentConfig.length}
              onMoveUp={() => moveSection(idx, -1)}
              onMoveDown={() => moveSection(idx, 1)}
              onToggleSection={() => toggleSection(idx)}
              onToggleItem={itemIdx => toggleItem(idx, itemIdx)}
            />
          ))}
        </div>

        {/* Preview - 1 column */}
        <div className="xl:col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Preview</h2>
          <PreviewPanel config={currentConfig} />
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="glass-panel rounded-xl px-6 py-3 flex items-center gap-4 shadow-lg shadow-black/40">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-gray-300">You have unsaved changes</span>
            <button onClick={handleSave} className="btn-primary text-sm px-4 py-1.5">
              Save Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
