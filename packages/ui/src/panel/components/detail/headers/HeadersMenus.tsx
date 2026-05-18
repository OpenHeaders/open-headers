import { Popover } from 'antd';
import type { HeaderNameCase } from '../../../data/header-name-case';
import type { HeaderLayoutMode, HeaderSortMode } from './types';

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
  const activeCount = [ruleOnly, securityOnly, overridableOnly, hideNoise].reduce((n, v) => n + (v ? 1 : 0), 0);
  const active = activeCount > 0;
  const content = (
    <div className="dt-morefilters-menu">
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={ruleOnly} onChange={onToggleRuleOnly} />
        Rule-modified only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={securityOnly} onChange={onToggleSecurityOnly} />
        Security headers only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={overridableOnly} onChange={onToggleOverridableOnly} />
        Overridable only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={hideNoise} onChange={onToggleHideNoise} />
        Hide noise (Accept-*, Sec-Fetch-*, User-Agent, …)
      </label>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false} overlayClassName="dt-morefilters-popover">
      <button type="button" className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}>
        More filters
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}

/**
 * `View ▾` dropdown — layout + sort options. Kept separate from More
 * filters so changing how the list is presented doesn't read as a
 * filtering action. The badge counts non-default values, so the user
 * always knows the list shape isn't its default.
 */
export function HeaderViewMenu({
  layout,
  sortMode,
  nameCase,
  showInsights,
  showChips,
  onLayoutChange,
  onSortChange,
  onNameCaseChange,
  onToggleShowInsights,
  onToggleShowChips,
}: {
  layout: HeaderLayoutMode;
  sortMode: HeaderSortMode;
  nameCase: HeaderNameCase;
  showInsights: boolean;
  showChips: boolean;
  onLayoutChange: (mode: HeaderLayoutMode) => void;
  onSortChange: (mode: HeaderSortMode) => void;
  onNameCaseChange: (mode: HeaderNameCase) => void;
  onToggleShowInsights: () => void;
  onToggleShowChips: () => void;
}) {
  const activeCount =
    (layout !== 'grouped' ? 1 : 0) +
    (sortMode !== 'original' ? 1 : 0) +
    (nameCase !== 'train' ? 1 : 0) +
    (!showInsights ? 1 : 0) +
    (!showChips ? 1 : 0);
  const active = activeCount > 0;
  const content = (
    <div className="dt-morefilters-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Layout</span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as HeaderLayoutMode)}>
          <option value="grouped">Grouped</option>
          <option value="flat">Flat</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Sort</span>
        <select value={sortMode} onChange={(e) => onSortChange(e.target.value as HeaderSortMode)}>
          <option value="original">Original</option>
          <option value="az">A → Z</option>
          <option value="rule-first">Rule-modified first</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Name case</span>
        <select value={nameCase} onChange={(e) => onNameCaseChange(e.target.value as HeaderNameCase)}>
          <option value="train">Train-Case</option>
          <option value="original">Original (raw)</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showChips} onChange={onToggleShowChips} />
        Show tags
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        Show suggestions
      </label>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false} overlayClassName="dt-morefilters-popover">
      <button type="button" className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}>
        View
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}
