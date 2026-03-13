import { useEffect, useRef } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  label: string;
  category: string;
  handler: () => void;
}

// Global registry shared across all hook instances
const shortcutRegistry = new Map<string, Shortcut>();

function buildId(s: Pick<Shortcut, 'key' | 'ctrl' | 'shift' | 'alt'>): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push('ctrl');
  if (s.shift) parts.push('shift');
  if (s.alt) parts.push('alt');
  parts.push(s.key.toLowerCase());
  return parts.join('+');
}

/**
 * Registers an array of shortcuts into the global registry.
 * Shortcuts are removed on unmount or when the list changes.
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  enabled: boolean = true,
): void {
  const prevIds = useRef<string[]>([]);

  useEffect(() => {
    // Clean up previously registered shortcuts from this instance
    for (const id of prevIds.current) {
      shortcutRegistry.delete(id);
    }

    if (!enabled) {
      prevIds.current = [];
      return;
    }

    const ids: string[] = [];
    for (const shortcut of shortcuts) {
      const id = buildId(shortcut);
      shortcutRegistry.set(id, shortcut);
      ids.push(id);
    }
    prevIds.current = ids;

    return () => {
      for (const id of ids) {
        shortcutRegistry.delete(id);
      }
    };
  }, [shortcuts, enabled]);
}

/**
 * Attaches a single global keydown listener that dispatches to registered shortcuts.
 * Call this once (e.g. in MainLayout).
 */
export function useGlobalShortcutListener(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName;

      // Allow Escape everywhere, but skip other shortcuts when inside form elements
      const isFormElement =
        tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const isContentEditable = target.isContentEditable;

      if (e.key === 'Escape') {
        const id = buildId({ key: 'escape' });
        const shortcut = shortcutRegistry.get(id);
        if (shortcut) {
          e.preventDefault();
          shortcut.handler();
        }
        return;
      }

      // Skip shortcuts when user is typing in form elements
      if (isFormElement || isContentEditable) return;

      const id = buildId({
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      });

      const shortcut = shortcutRegistry.get(id);
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Returns a snapshot of all currently registered shortcuts,
 * grouped by category.
 */
export function getRegisteredShortcuts(): Map<string, Shortcut[]> {
  const grouped = new Map<string, Shortcut[]>();
  for (const shortcut of shortcutRegistry.values()) {
    const list = grouped.get(shortcut.category) || [];
    list.push(shortcut);
    grouped.set(shortcut.category, list);
  }
  return grouped;
}
