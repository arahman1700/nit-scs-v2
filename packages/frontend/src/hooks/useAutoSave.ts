import { useEffect, useCallback, useRef } from 'react';

const SAVE_INTERVAL = 10_000; // 10 seconds
const PREFIX = 'nit_draft_';

/**
 * Auto-saves form data to localStorage every 10 seconds.
 * Returns the recovered draft (if any) and clear function.
 *
 * @param formKey - Unique key for this form (e.g., 'grn-new', 'mi-edit-123')
 * @param formData - Current form data object
 * @param enabled - Whether auto-save is active (disable for view-only modes)
 */
export function useAutoSave<T extends Record<string, unknown>>(formKey: string, formData: T, enabled = true) {
  const key = `${PREFIX}${formKey}`;
  const dataRef = useRef(formData);
  dataRef.current = formData;

  // Auto-save on interval
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      try {
        const payload = {
          data: dataRef.current,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    }, SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [key, enabled]);

  // Save on page unload
  useEffect(() => {
    if (!enabled) return;

    const handleUnload = () => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            data: dataRef.current,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [key, enabled]);

  // Recover saved draft
  const recoverDraft = useCallback((): { data: T; savedAt: string } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data || !parsed?.savedAt) return null;

      // Expire drafts older than 24 hours
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed as { data: T; savedAt: string };
    } catch {
      return null;
    }
  }, [key]);

  // Clear saved draft (call after successful save)
  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { recoverDraft, clearDraft };
}
