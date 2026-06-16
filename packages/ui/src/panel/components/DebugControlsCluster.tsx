/**
 * The toolbar's Chrome-style debug-controls cluster: "Disable cache" + the
 * network-throttle dropdown + the environment overrides, side by side. Derives
 * the shared "Enable Debug mode" action all controls' (i) popovers offer.
 *
 * The cache toggle always renders (its DNR path works on every host). The
 * throttle dropdown and the overrides panel are CDP-only, so they render only
 * where Debug-mode inspection is supported.
 */

import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type React from 'react';
import { useNetworkConditions } from '../data/use-network-conditions';
import { useTabOverrides } from '../data/use-tab-overrides';
import { DisableCacheControl } from './DisableCacheControl';
import { NetworkThrottleControl } from './NetworkThrottleControl';
import { OverridesControl } from './OverridesControl';

export interface DebugControlsClusterProps {
  cacheBypassEnabled: boolean;
  onToggleCacheBypass: () => void;
}

export const DebugControlsCluster: React.FC<DebugControlsClusterProps> = ({
  cacheBypassEnabled,
  onToggleCacheBypass,
}) => {
  const throttle = useNetworkConditions();
  const overrides = useTabOverrides();
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
      {overrides.hasCdpCapability && (
        <OverridesControl
          overrides={overrides.overrides}
          setOverrides={overrides.setOverrides}
          cdpOwned={overrides.cdpOwned}
          onEnableDebug={onEnableDebug}
        />
      )}
    </div>
  );
};
