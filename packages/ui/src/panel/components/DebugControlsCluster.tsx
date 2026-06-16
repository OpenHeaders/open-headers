/**
 * The toolbar's Chrome-style debug-controls cluster: "Disable cache" + the
 * network-throttle dropdown, side by side. Owns the single
 * {@link useNetworkConditions} read (one Status subscription) and derives the
 * shared "Enable Debug mode" action both controls' (i) popovers offer.
 *
 * The cache toggle always renders (its DNR path works on every host). The
 * throttle dropdown is CDP-only, so it renders only where Debug-mode inspection
 * is supported.
 */

import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type React from 'react';
import { useNetworkConditions } from '../data/use-network-conditions';
import { DisableCacheControl } from './DisableCacheControl';
import { NetworkThrottleControl } from './NetworkThrottleControl';

export interface DebugControlsClusterProps {
  cacheBypassEnabled: boolean;
  onToggleCacheBypass: () => void;
}

export const DebugControlsCluster: React.FC<DebugControlsClusterProps> = ({
  cacheBypassEnabled,
  onToggleCacheBypass,
}) => {
  const throttle = useNetworkConditions();
  const [, setCdpEnabled] = useSetting('inspection.cdpEnabled');
  // Offer "Enable Debug mode" only when the host can do CDP and it is off — once
  // on, the panel's own tab joins the default `devtools` scope.
  const onEnableDebug =
    throttle.hasCdpCapability && !throttle.cdpEnabled ? () => setCdpEnabled(true) : undefined;

  return (
    <div className="dt-debug-controls">
      <DisableCacheControl
        enabled={cacheBypassEnabled}
        onToggle={onToggleCacheBypass}
        cdpOwned={throttle.cdpOwned}
        onEnableDebug={onEnableDebug}
      />
      {throttle.hasCdpCapability && (
        <NetworkThrottleControl
          profileKey={throttle.profileKey}
          conditions={throttle.conditions}
          setConditions={throttle.setConditions}
          cdpOwned={throttle.cdpOwned}
          onEnableDebug={onEnableDebug}
        />
      )}
    </div>
  );
};
