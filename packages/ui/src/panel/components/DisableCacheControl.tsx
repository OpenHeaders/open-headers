/**
 * "Disable cache" toolbar control (CDP Control Plane, Phase F1 surface).
 * Promoted from the More-filters overflow to a first-class toolbar checkbox,
 * Chrome-style, beside the throttle dropdown. Works in both modes — a DNR
 * revalidation hint in standard mode, a whole-tab `Network.setCacheDisabled`
 * once the tab is in Debug-mode scope — so it is never disabled; the (i)
 * popover and the mode-aware tooltip explain the difference.
 */

import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Tooltip } from 'antd';
import type React from 'react';
import { buildCacheInfo } from './debug-controls-info';

export interface DisableCacheControlProps {
  enabled: boolean;
  onToggle: () => void;
  /** The inspected tab is CDP-controlled — selects the whole-tab CDP path. */
  cdpOwned: boolean;
  /** Renders an "Enable Debug mode" action in the (i) popover when set. */
  onEnableDebug?: () => void;
}

export const DisableCacheControl: React.FC<DisableCacheControlProps> = ({
  enabled,
  onToggle,
  cdpOwned,
  onEnableDebug,
}) => {
  const tooltip = cdpOwned
    ? 'Disabling the cache at the network-stack level (Debug mode) — matches the browser’s native Disable cache.'
    : 'Bypasses the HTTP cache by forcing revalidation. Enable Debug mode for a full network-stack disable (the in-memory cache too).';
  return (
    <span className="dt-debug-control">
      <Tooltip title={tooltip} placement="bottom">
        <label className="dt-checkbox">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          Disable cache
        </label>
      </Tooltip>
      <InfoTrigger
        content={buildCacheInfo({ cdpOwned, onEnableDebug })}
        className="dt-header-info-trigger dt-debug-info-trigger"
        ariaLabel="About Disable cache"
      />
    </span>
  );
};
