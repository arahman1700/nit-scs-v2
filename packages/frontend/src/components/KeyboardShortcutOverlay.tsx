import React, { useEffect, useMemo } from 'react';
import { getRegisteredShortcuts } from '@/hooks/useKeyboardShortcuts';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatKey(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }): string[] {
  const keys: string[] = [];
  if (shortcut.ctrl) keys.push(navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl');
  if (shortcut.shift) keys.push('Shift');
  if (shortcut.alt) keys.push(navigator.platform.includes('Mac') ? '\u2325' : 'Alt');
  keys.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return keys;
}

export const KeyboardShortcutOverlay: React.FC<KeyboardShortcutOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  // Read the registry every time the overlay opens
  const grouped = useMemo(() => {
    if (!isOpen) return new Map<string, ReturnType<typeof getRegisteredShortcuts> extends Map<string, infer V> ? V : never>();
    return getRegisteredShortcuts();
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(grouped.entries());

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-nesma-primary/20 border border-nesma-primary/30">
                <Keyboard size={20} className="text-nesma-secondary" />
              </div>
              <h2 id="shortcuts-title" className="text-lg font-semibold text-white">
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-300"
              aria-label="Close keyboard shortcuts"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Shortcut groups */}
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400">No shortcuts registered.</p>
          ) : (
            <div className="space-y-6">
              {categories.map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => {
                      const keys = formatKey(shortcut);
                      return (
                        <div
                          key={`${shortcut.key}-${shortcut.ctrl}-${shortcut.shift}-${shortcut.alt}`}
                          className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <span className="text-sm text-gray-300">{shortcut.label}</span>
                          <div className="flex items-center gap-1">
                            {keys.map((k, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span className="text-gray-500 text-xs">+</span>}
                                <kbd className="min-w-[28px] px-2 py-1 text-xs font-mono font-medium text-white bg-white/10 border border-white/20 rounded-lg text-center">
                                  {k}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer hint */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center">
              Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-white/10 border border-white/20 rounded">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
