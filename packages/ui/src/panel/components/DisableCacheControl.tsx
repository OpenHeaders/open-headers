/**
 * "Disable cache" toolbar control (CDP Control Plane, Phase F1 surface).
 * Promoted from the More-filters overflow to a first-class toolbar checkbox,
 * Chrome-style, beside the throttle dropdown. Works in both modes — a DNR
 * revalidation hint in standard mode, a whole-tab `Network.setCacheDisabled`
 * once the tab is in Debug-mode scope — so it is never disabled; the (i)
 * popover and the mode-aware tooltip explain the difference.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
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
  const t = useT();
  const tooltip = cdpOwned ? t('panel.cache.tooltipDebug') : t('panel.cache.tooltipStandard');
  return (
    <span className="dt-debug-control">
      <Tooltip title={tooltip} placement="bottom">
        <label className="dt-checkbox">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          {t('panel.cache.label')}
        </label>
      </Tooltip>
      <InfoTrigger
        content={buildCacheInfo(t, { cdpOwned, onEnableDebug })}
        className="dt-header-info-trigger dt-debug-info-trigger"
        ariaLabel={t('panel.cache.aboutAria')}
      />
    </span>
  );
};
