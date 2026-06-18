/**
 * Tab-source resolution shared by the debug-mode footer controls.
 *
 * Where a per-tab debug-mode decision (the "include this browser tab" pin, the
 * out-of-scope dormancy notice) resolves its target. The panel inspects a fixed
 * tab; the popup / side panel follow the active tab; the workbench is
 * tab-agnostic, so it shows no per-tab affordance.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useEffect, useState } from 'react';

export type DebugModeTabSource = 'inspected' | 'active' | 'none';

/**
 * Resolve the tab a per-tab debug-mode control acts on for the current
 * surface. `inspected` reads the fixed panel tab synchronously; `active`
 * follows the focused tab and re-resolves whenever it changes; `none` yields
 * `null`.
 */
export function useControlTabId(tabSource: DebugModeTabSource): number | null {
  const [tabId, setTabId] = useState<number | null>(() =>
    tabSource === 'inspected' ? hostNavigation.inspectedTabId() : null,
  );

  useEffect(() => {
    if (tabSource === 'inspected') {
      setTabId(hostNavigation.inspectedTabId());
      return;
    }
    if (tabSource !== 'active') {
      setTabId(null);
      return;
    }
    let cancelled = false;
    const resolve = (): void => {
      void hostNavigation.getActiveTab().then((tab) => {
        if (!cancelled) setTabId(tab?.id ?? null);
      });
    };
    resolve();
    const unsubscribe = hostNavigation.observeActiveTabContext(resolve);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tabSource]);

  return tabId;
}
