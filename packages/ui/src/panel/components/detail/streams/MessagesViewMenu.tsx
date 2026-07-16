/**
 * `View ▾` dropdown for the Messages / EventStream grids — the same
 * anatomy as the network table's [[NetworkViewMenu]], scoped to the
 * options these grids share: the column layout (compact / wide), the
 * grid/payload split orientation and the payload-preview pane toggle.
 * Sits at the right end of the stream toolbar.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SplitLayout } from '@openheaders/ui/shared/split-layout';
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
  splitLayout,
  showPreview,
  modified,
  onLayoutChange,
  onSplitLayoutChange,
  onToggleShowPreview,
  onReset,
}: {
  layout: DevpanelNetworkLayoutSetting;
  /** Grid/payload split orientation — a shared split-layout preference,
   *  not a registered setting, so it has no dot and Reset skips it. */
  splitLayout: SplitLayout;
  showPreview: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  onSplitLayoutChange: (next: SplitLayout) => void;
  onToggleShowPreview: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const t = useT();
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover
      label={t('panel.inspector.streams.view.label')}
      activeCount={activeCount}
      menuClassName="dt-messages-view-menu"
    >
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.streams.view.layout')}
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.messagesLayout')} />
        </span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">{t('panel.inspector.streams.view.layoutCompact')}</option>
          <option value="wide">{t('panel.inspector.streams.view.layoutWide')}</option>
        </select>
      </label>
      <label
        className="dt-morefilters-item dt-morefilters-item--select"
        title={showPreview ? undefined : t('panel.inspector.streams.view.splitDisabledTitle')}
      >
        <span className="dt-morefilters-item-label">{t('panel.inspector.streams.view.split')}</span>
        <select
          value={splitLayout}
          disabled={!showPreview}
          onChange={(e) => onSplitLayoutChange(e.target.value as SplitLayout)}
        >
          <option value="horizontal">{t('panel.inspector.streams.view.splitSideBySide')}</option>
          <option value="vertical">{t('panel.inspector.streams.view.splitStacked')}</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showPreview} onChange={onToggleShowPreview} />
        {t('panel.inspector.streams.view.showPreview')}
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.messagesShowPreview')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}
