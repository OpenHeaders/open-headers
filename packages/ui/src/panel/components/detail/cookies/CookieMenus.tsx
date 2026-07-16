/**
 * `More filters ▾` / `View ▾` dropdowns for the Cookies tab. Mirrors
 * `headers/HeadersMenus.tsx` so the muscle memory is the same.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type { DevpanelCookiesExpiresFormatSetting, DevpanelCookiesSortSetting } from '../../../../workbench/settings/schema/devpanel-cookies';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../../ToolbarMenuPopover';

/** Settings behind the `View ▾` menu — its badge, dots, and reset derive from these. */
export const COOKIE_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelCookies.sortMode',
  'devpanelCookies.expiresFormat',
  'devpanelCookies.decodeValues',
  'devpanelCookies.groupByRole',
  'devpanelCookies.showChips',
  'devpanelCookies.showInsights',
];

export function CookieMoreFiltersMenu({
  problemsOnly,
  thirdPartyOnly,
  ruleOnly,
  showFilteredOut,
  onToggleProblemsOnly,
  onToggleThirdPartyOnly,
  onToggleRuleOnly,
  onToggleShowFilteredOut,
}: {
  problemsOnly: boolean;
  thirdPartyOnly: boolean;
  ruleOnly: boolean;
  showFilteredOut: boolean;
  onToggleProblemsOnly: () => void;
  onToggleThirdPartyOnly: () => void;
  onToggleRuleOnly: () => void;
  onToggleShowFilteredOut: () => void;
}) {
  const t = useT();
  const activeCount = [problemsOnly, thirdPartyOnly, ruleOnly, showFilteredOut].reduce(
    (n, v) => n + (v ? 1 : 0),
    0,
  );
  const reset = () => {
    if (problemsOnly) onToggleProblemsOnly();
    if (thirdPartyOnly) onToggleThirdPartyOnly();
    if (ruleOnly) onToggleRuleOnly();
    if (showFilteredOut) onToggleShowFilteredOut();
  };
  return (
    <ToolbarMenuPopover label={t('panel.inspector.cookies.moreFilters.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={problemsOnly} onChange={onToggleProblemsOnly} />
        {t('panel.inspector.cookies.moreFilters.problemsOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={thirdPartyOnly} onChange={onToggleThirdPartyOnly} />
        {t('panel.inspector.cookies.moreFilters.thirdPartyOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={ruleOnly} onChange={onToggleRuleOnly} />
        {t('panel.inspector.cookies.moreFilters.ruleOnly')}
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFilteredOut} onChange={onToggleShowFilteredOut} />
        {t('panel.inspector.cookies.moreFilters.showFilteredOut')}
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={reset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}

export interface CookieViewMenuProps {
  sortMode: DevpanelCookiesSortSetting;
  expiresFormat: DevpanelCookiesExpiresFormatSetting;
  decodeValues: boolean;
  showInsights: boolean;
  showChips: boolean;
  groupByRole: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onSortChange: (v: DevpanelCookiesSortSetting) => void;
  onExpiresFormatChange: (v: DevpanelCookiesExpiresFormatSetting) => void;
  onToggleDecodeValues: () => void;
  onToggleShowInsights: () => void;
  onToggleShowChips: () => void;
  onToggleGroupByRole: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}

export function CookieViewMenu(props: CookieViewMenuProps) {
  const t = useT();
  const { modified, onReset } = props;
  const activeCount = modified.size;

  return (
    <ToolbarMenuPopover label={t('panel.inspector.cookies.view.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.cookies.view.sort')}
          <MenuNonDefaultDot show={modified.has('devpanelCookies.sortMode')} />
        </span>
        <select value={props.sortMode} onChange={(e) => props.onSortChange(e.target.value as DevpanelCookiesSortSetting)}>
          <option value="original">{t('panel.inspector.cookies.view.sortOriginal')}</option>
          <option value="az">{t('panel.inspector.cookies.view.sortAz')}</option>
          <option value="size">{t('panel.inspector.cookies.view.sortSize')}</option>
          <option value="expires">{t('panel.inspector.cookies.view.sortExpires')}</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.cookies.view.expiresFormat')}
          <MenuNonDefaultDot show={modified.has('devpanelCookies.expiresFormat')} />
        </span>
        <select
          value={props.expiresFormat}
          onChange={(e) => props.onExpiresFormatChange(e.target.value as DevpanelCookiesExpiresFormatSetting)}
        >
          <option value="relative">{t('panel.inspector.cookies.view.expiresRelative')}</option>
          <option value="absolute">{t('panel.inspector.cookies.view.expiresAbsolute')}</option>
        </select>
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.decodeValues} onChange={props.onToggleDecodeValues} />
        {t('panel.inspector.cookies.view.decodeValues')}
        <MenuNonDefaultDot show={modified.has('devpanelCookies.decodeValues')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.groupByRole} onChange={props.onToggleGroupByRole} />
        {t('panel.inspector.cookies.view.groupByRole')}
        <MenuNonDefaultDot show={modified.has('devpanelCookies.groupByRole')} />
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.showChips} onChange={props.onToggleShowChips} />
        {t('panel.inspector.cookies.view.showTags')}
        <MenuNonDefaultDot show={modified.has('devpanelCookies.showChips')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.showInsights} onChange={props.onToggleShowInsights} />
        {t('panel.inspector.cookies.view.showSuggestions')}
        <MenuNonDefaultDot show={modified.has('devpanelCookies.showInsights')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}
