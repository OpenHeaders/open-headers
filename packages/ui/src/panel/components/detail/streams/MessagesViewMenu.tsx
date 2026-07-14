/**
 * `View ▾` dropdown for the Messages / EventStream grids — the same
 * anatomy as the network table's [[NetworkViewMenu]], scoped to the
 * options these grids share: the column layout (compact / wide) and the
 * payload-preview pane toggle. Sits at the right end of the stream
 * toolbar, after the split-orientation toggle.
 */

import type { DevpanelNetworkLayoutSetting } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../../ToolbarMenuPopover';

/** Settings behind the `View ▾` menu — its badge, dots, and reset derive from these. */
export const MESSAGES_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelNetwork.messagesLayout',
  'devpanelNetwork.messagesShowPreview',
];

export function MessagesViewMenu({
  layout,
  showPreview,
  modified,
  onLayoutChange,
  onToggleShowPreview,
  onReset,
}: {
  layout: DevpanelNetworkLayoutSetting;
  showPreview: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  onToggleShowPreview: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover label="View" activeCount={activeCount} menuClassName="dt-messages-view-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          Layout
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.messagesLayout')} />
        </span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showPreview} onChange={onToggleShowPreview} />
        Show payload preview
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.messagesShowPreview')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        Reset to default
      </button>
    </ToolbarMenuPopover>
  );
}
