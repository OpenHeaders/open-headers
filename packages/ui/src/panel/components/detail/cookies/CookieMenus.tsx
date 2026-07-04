/**
 * `More filters ▾` / `View ▾` dropdowns for the Cookies tab. Mirrors
 * `headers/HeadersMenus.tsx` so the muscle memory is the same.
 */

import type { DevpanelCookiesExpiresFormatSetting, DevpanelCookiesSortSetting } from '../../../../workbench/settings/schema/devpanel-cookies';
import { ToolbarMenuPopover } from '../../ToolbarMenuPopover';

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
    <ToolbarMenuPopover label="More filters" activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={problemsOnly} onChange={onToggleProblemsOnly} />
        Problems only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={thirdPartyOnly} onChange={onToggleThirdPartyOnly} />
        3rd-party only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={ruleOnly} onChange={onToggleRuleOnly} />
        Rule-modified only
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFilteredOut} onChange={onToggleShowFilteredOut} />
        Show filtered-out request cookies
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={reset} disabled={activeCount === 0}>
        Reset to default
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
  onSortChange: (v: DevpanelCookiesSortSetting) => void;
  onExpiresFormatChange: (v: DevpanelCookiesExpiresFormatSetting) => void;
  onToggleDecodeValues: () => void;
  onToggleShowInsights: () => void;
  onToggleShowChips: () => void;
  onToggleGroupByRole: () => void;
}

export function CookieViewMenu(props: CookieViewMenuProps) {
  const activeCount =
    (props.sortMode !== 'az' ? 1 : 0) +
    (props.expiresFormat !== 'relative' ? 1 : 0) +
    (props.decodeValues ? 1 : 0) +
    (!props.showInsights ? 1 : 0) +
    (!props.showChips ? 1 : 0) +
    (!props.groupByRole ? 1 : 0);

  const reset = () => {
    if (props.sortMode !== 'az') props.onSortChange('az');
    if (props.expiresFormat !== 'relative') props.onExpiresFormatChange('relative');
    if (props.decodeValues) props.onToggleDecodeValues();
    if (!props.groupByRole) props.onToggleGroupByRole();
    if (!props.showChips) props.onToggleShowChips();
    if (!props.showInsights) props.onToggleShowInsights();
  };

  return (
    <ToolbarMenuPopover label="View" activeCount={activeCount}>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Sort</span>
        <select value={props.sortMode} onChange={(e) => props.onSortChange(e.target.value as DevpanelCookiesSortSetting)}>
          <option value="original">Original</option>
          <option value="az">A → Z</option>
          <option value="size">Size</option>
          <option value="expires">Expires</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Expires</span>
        <select
          value={props.expiresFormat}
          onChange={(e) => props.onExpiresFormatChange(e.target.value as DevpanelCookiesExpiresFormatSetting)}
        >
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
        </select>
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.decodeValues} onChange={props.onToggleDecodeValues} />
        Decode URL-encoded values
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.groupByRole} onChange={props.onToggleGroupByRole} />
        Group by role (auth / pref / tracking)
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.showChips} onChange={props.onToggleShowChips} />
        Show tags
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={props.showInsights} onChange={props.onToggleShowInsights} />
        Show suggestions
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={reset} disabled={activeCount === 0}>
        Reset to default
      </button>
    </ToolbarMenuPopover>
  );
}
