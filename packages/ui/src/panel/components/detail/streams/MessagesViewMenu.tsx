/**
 * `View ▾` dropdown for the Messages frame grid — the same anatomy as
 * the network table's [[NetworkViewMenu]], scoped to the options this
 * grid has: the column layout (compact / wide). Sits at the right end
 * of the stream toolbar, after the split-orientation toggle.
 */

import type { DevpanelNetworkLayoutSetting } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { ToolbarMenuPopover } from '../../ToolbarMenuPopover';

export function MessagesViewMenu({
  layout,
  onLayoutChange,
  onReset,
}: {
  layout: DevpanelNetworkLayoutSetting;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const activeBadgeCount = layout !== 'compact' ? 1 : 0;

  return (
    <ToolbarMenuPopover label="View" activeCount={activeBadgeCount} menuClassName="dt-messages-view-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Layout</span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeBadgeCount === 0}>
        Reset to default
      </button>
    </ToolbarMenuPopover>
  );
}
