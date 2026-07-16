import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import type { HeaderNameCase } from '../../../data/headers/header-name-case';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../../ToolbarMenuPopover';
import type { HeaderLayoutMode, HeaderSortMode } from './types';

/** Settings behind the `View ▾` menu — its badge, dots, and reset derive from these. */
export const HEADER_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelHeaders.layout',
  'devpanelHeaders.sortMode',
  'devpanelHeaders.nameCase',
  'devpanelHeaders.showChips',
  'devpanelHeaders.showInsights',
];

/**
 * `More filters ▾` dropdown — checkbox-only toggles that narrow the
 * visible header set. Layout / sort live in the sibling `View ▾`
 * popover so this menu stays focused on "what do I want to hide?".
 */
export function HeaderMoreFiltersMenu({
  ruleOnly,
  securityOnly,
  overridableOnly,
  hideNoise,
  onToggleRuleOnly,
  onToggleSecurityOnly,
  onToggleOverridableOnly,
  onToggleHideNoise,
}: {
  ruleOnly: boolean;
  securityOnly: boolean;
  overridableOnly: boolean;
  hideNoise: boolean;
  onToggleRuleOnly: () => void;
  onToggleSecurityOnly: () => void;
  onToggleOverridableOnly: () => void;
  onToggleHideNoise: () => void;
}) {
  const t = useT();
  const activeCount = [ruleOnly, securityOnly, overridableOnly, hideNoise].reduce((n, v) => n + (v ? 1 : 0), 0);
  const reset = () => {
    if (ruleOnly) onToggleRuleOnly();
    if (securityOnly) onToggleSecurityOnly();
    if (overridableOnly) onToggleOverridableOnly();
    if (hideNoise) onToggleHideNoise();
  };
  return (
    <ToolbarMenuPopover label={t('panel.inspector.headers.moreFilters.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={ruleOnly} onChange={onToggleRuleOnly} />
        {t('panel.inspector.headers.moreFilters.ruleOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={securityOnly} onChange={onToggleSecurityOnly} />
        {t('panel.inspector.headers.moreFilters.securityOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={overridableOnly} onChange={onToggleOverridableOnly} />
        {t('panel.inspector.headers.moreFilters.overridableOnly')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={hideNoise} onChange={onToggleHideNoise} />
        {t('panel.inspector.headers.moreFilters.hideNoise')}
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={reset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}

/**
 * `View ▾` dropdown — layout + sort options. Kept separate from More
 * filters so changing how the list is presented doesn't read as a
 * filtering action. The badge counts settings that differ from their
 * registered defaults and each such row carries a dot; the parent
 * derives `modified` from the settings registry ([[HEADER_VIEW_MENU_KEYS]])
 * so the menu carries no baseline of its own.
 */
export function HeaderViewMenu({
  layout,
  sortMode,
  nameCase,
  showInsights,
  showChips,
  modified,
  onLayoutChange,
  onSortChange,
  onNameCaseChange,
  onToggleShowInsights,
  onToggleShowChips,
  onReset,
}: {
  layout: HeaderLayoutMode;
  sortMode: HeaderSortMode;
  nameCase: HeaderNameCase;
  showInsights: boolean;
  showChips: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onLayoutChange: (mode: HeaderLayoutMode) => void;
  onSortChange: (mode: HeaderSortMode) => void;
  onNameCaseChange: (mode: HeaderNameCase) => void;
  onToggleShowInsights: () => void;
  onToggleShowChips: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const t = useT();
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover label={t('panel.inspector.headers.view.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.headers.view.layout')}
          <MenuNonDefaultDot show={modified.has('devpanelHeaders.layout')} />
        </span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as HeaderLayoutMode)}>
          <option value="grouped">{t('panel.inspector.headers.view.layoutGrouped')}</option>
          <option value="flat">{t('panel.inspector.headers.view.layoutFlat')}</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.headers.view.sort')}
          <MenuNonDefaultDot show={modified.has('devpanelHeaders.sortMode')} />
        </span>
        <select value={sortMode} onChange={(e) => onSortChange(e.target.value as HeaderSortMode)}>
          <option value="original">{t('panel.inspector.headers.view.sortOriginal')}</option>
          <option value="az">{t('panel.inspector.headers.view.sortAz')}</option>
          <option value="rule-first">{t('panel.inspector.headers.view.sortRuleFirst')}</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.inspector.headers.view.nameCase')}
          <MenuNonDefaultDot show={modified.has('devpanelHeaders.nameCase')} />
        </span>
        <select value={nameCase} onChange={(e) => onNameCaseChange(e.target.value as HeaderNameCase)}>
          <option value="train">{t('panel.inspector.headers.view.nameCaseTrain')}</option>
          <option value="original">{t('panel.inspector.headers.view.nameCaseOriginal')}</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showChips} onChange={onToggleShowChips} />
        {t('panel.inspector.headers.view.showTags')}
        <MenuNonDefaultDot show={modified.has('devpanelHeaders.showChips')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        {t('panel.inspector.headers.view.showSuggestions')}
        <MenuNonDefaultDot show={modified.has('devpanelHeaders.showInsights')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}
