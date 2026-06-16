/**
 * `useInspectedTabCdp` — the inspected tab's CDP-ownership state, derived (never
 * stored) from the live `cdp` Status roster plus the Debug-mode master switch.
 *
 * The single read the panel's debug-gated controls share: the throttle dropdown
 * (available only when the tab is CDP-controlled) and the cache toggle's
 * mode-aware tooltip (standard DNR path vs whole-tab CDP disable). Mirrors the
 * scope check `DebugModeDormantNotice` does inline.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { hostNavigation } from '@openheaders/core/navigation';
import { readCdpRoster } from '@openheaders/core/types';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { useMemo } from 'react';

export interface InspectedTabCdpState {
  /** Host supports CDP-based inspection at all (false on Firefox / Safari). */
  hasCdpCapability: boolean;
  /** The Debug-mode master switch is on. */
  cdpEnabled: boolean;
  /** The inspected tab is actively CDP-controlled (present in the attach roster). */
  cdpOwned: boolean;
}

export function useInspectedTabCdp(): InspectedTabCdpState {
  const { snapshot } = useStatus();
  const cdpEnabled = useSettingValue('inspection.cdpEnabled');
  const hasCdpCapability = hasCapability('cdpInspection');
  const inspectedTabId = hostNavigation.inspectedTabId();
  const cdpOwned = useMemo(() => {
    if (!hasCdpCapability || !cdpEnabled || inspectedTabId == null) return false;
    return readCdpRoster(snapshot.cdp?.context).some((tab) => tab.tabId === inspectedTabId);
  }, [hasCdpCapability, cdpEnabled, inspectedTabId, snapshot.cdp?.context]);
  return { hasCdpCapability, cdpEnabled, cdpOwned };
}
