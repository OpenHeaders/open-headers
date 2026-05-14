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

import { hostBridge } from '@openheaders/core/bridge';
import { hostNavigation } from '@openheaders/core/navigation';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useEffect } from 'react';

export interface UseCacheBypassResult {
  enabled: boolean;
  toggle: () => void;
}

export function useCacheBypass(): UseCacheBypassResult {
  const [enabled, setEnabled] = useSetting('rulesEngine.bypassHttpCache');

  // Reconcile the DNR rule to match the setting: install when on,
  // remove when off or on unmount. Scoped to the inspected tab.
  useEffect(() => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null) return;
    void hostBridge.call('setCacheBypass', { tabId, enabled }).catch(() => {});
    return () => {
      void hostBridge.call('setCacheBypass', { tabId, enabled: false }).catch(() => {});
    };
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, toggle };
}
