/**
 * `useCacheBypass` — state + lifecycle for the "Bypass HTTP Cache"
 * panel toggle.
 *
 * Behaviors:
 *   - Persistent state lives in `rulesEngine.bypassHttpCache` setting
 *     so the preference carries across panel opens.
 *   - On mount (with a resolved tabId + setting = true), install the
 *     session-layer DNR rule. On unmount remove the rule but leave the
 *     setting intact — the next panel-open re-enables it automatically.
 *   - Toggle flips the setting; the mount/unmount effect reconciles the
 *     DNR rule to match.
 */

import { call } from '@utils/bridge';
import { useCallback, useEffect } from 'react';
import { useSetting } from '@/rules/settings/hooks';

/**
 * Inspected-tab id. Available inside a DevTools panel context only;
 * falls back to `null` in other contexts (tests, popup) so the hook
 * becomes a no-op cleanly.
 */
function getInspectedTabId(): number | null {
  const ct = chrome as unknown as { devtools?: { inspectedWindow?: { tabId?: number } } };
  const id = ct.devtools?.inspectedWindow?.tabId;
  return typeof id === 'number' ? id : null;
}

export interface UseCacheBypassResult {
  enabled: boolean;
  toggle: () => void;
}

export function useCacheBypass(): UseCacheBypassResult {
  const [enabled, setEnabled] = useSetting('rulesEngine.bypassHttpCache');

  // Reconcile the DNR rule to match the setting: install when on,
  // remove when off or on unmount. Scoped to the inspected tab.
  useEffect(() => {
    const tabId = getInspectedTabId();
    if (tabId == null) return;
    void call('setCacheBypass', { tabId, enabled }).catch(() => {});
    return () => {
      void call('setCacheBypass', { tabId, enabled: false }).catch(() => {});
    };
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, toggle };
}
