import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../../ToolbarMenuPopover';
import type { SortMode } from './tree-model';

/** Settings behind the `View ▾` menu — its badge and dots derive from these. */
export const INITIATOR_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelInitiator.sortMode',
  'devpanelInitiator.showInsights',
];

/** `More filters ▾` — boolean toggles that narrow the visible rows. */
export function InitiatorMoreFiltersMenu({
  failuresOnly,
  thirdPartyOnly,
  onToggleFailuresOnly,
  onToggleThirdPartyOnly,
}: {
  failuresOnly: boolean;
  thirdPartyOnly: boolean;
  onToggleFailuresOnly: () => void;
  onToggleThirdPartyOnly: () => void;
}) {
  const t = useT();
  const activeCount = [failuresOnly, thirdPartyOnly].reduce((n, v) => n + (v ? 1 : 0), 0);
  return (
    <ToolbarMenuPopover label={t('panel.inspector.initiator.moreFilters.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={failuresOnly} onChange={onToggleFailuresOnly} />
        {t('panel.inspector.initiator.moreFilters.failuresOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={thirdPartyOnly} onChange={onToggleThirdPartyOnly} />
        {t('panel.inspector.initiator.moreFilters.thirdPartyOnly')}
      </label>
    </ToolbarMenuPopover>
  );
}

/** `View ▾` — children sort + show-suggestions toggle. The badge counts
 *  settings that differ from their registered defaults and each such
 *  row carries a dot; the parent derives `modified` from the settings
 *  registry ([[INITIATOR_VIEW_MENU_KEYS]]). */
export function InitiatorViewMenu({
  sortMode,
  showInsights,
  modified,
  onSortChange,
  onToggleShowInsights,
}: {
  sortMode: SortMode;
  showInsights: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onSortChange: (mode: SortMode) => void;
  onToggleShowInsights: () => void;
}) {
  const t = useT();
  return (
    <ToolbarMenuPopover label={t('panel.inspector.initiator.view.label')} activeCount={modified.size}>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.initiator.view.sort')}
          <MenuNonDefaultDot show={modified.has('devpanelInitiator.sortMode')} />
        </span>
        <select value={sortMode} onChange={(e) => onSortChange(e.target.value as SortMode)}>
          <option value="initiator">{t('panel.inspector.initiator.view.sortInitiator')}</option>
          <option value="chronological">{t('panel.inspector.initiator.view.sortChronological')}</option>
          <option value="largest">{t('panel.inspector.initiator.view.sortLargest')}</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        {t('panel.inspector.initiator.view.showSuggestions')}
        <MenuNonDefaultDot show={modified.has('devpanelInitiator.showInsights')} />
      </label>
    </ToolbarMenuPopover>
  );
}
