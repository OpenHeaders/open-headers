import { Popover } from 'antd';
import { CheckOutlined, RightOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type {
  DevpanelNetworkLayoutSetting,
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
  DevpanelNetworkSortKindSetting,
  DevpanelNetworkSortModeSetting,
  NetworkCustomNestedLevel,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { NETWORK_SORT_MODE_META, type NetworkSortMode } from '../../data/network-sort-modes';
import { COLUMN_DEFS, type ColumnKey } from './columns';

/**
 * `View ▾` dropdown for the Network requests table. The sort surface
 * is grouped into three intent buckets — Order, Priority, Grouping —
 * with hover-expanded submenus, so the top-level menu stays short. A
 * fourth row opens a builder for an arbitrary nested (multi-key) sort.
 *
 * The mode rows mirror the popup pattern (title + subtitle) — the
 * subtitles only render inside the hover submenu so the closed-state
 * dropdown stays compact. Column-header click still wins and shows
 * the active column under a Custom (column-click) row.
 *
 * Submenu positioning, collision detection, keyboard handling, and
 * portaling are all delegated to antd `Popover` (trigger="hover",
 * placement="rightTop") — one per group — so this component owns no
 * coordinate math and no submenu open/close state.
 *
 * Column visibility lives on the column-header context menu — we
 * don't duplicate it here.
 */

const GROUPS: ReadonlyArray<{
  id: 'priority' | 'grouping';
  label: string;
  hint: string;
  modes: readonly NetworkSortMode[];
}> = [
  {
    id: 'priority',
    label: 'Priority',
    hint: 'What needs your attention first.',
    modes: ['failures', 'slowest', 'largest'],
  },
  {
    id: 'grouping',
    label: 'Grouping',
    hint: 'Cluster requests by category.',
    modes: ['byType', 'byDomain', 'ruleModified'],
  },
];

const SORTABLE_COLUMN_KEYS: ReadonlyArray<ColumnKey> = (Object.keys(COLUMN_DEFS) as ColumnKey[]).filter(
  (k) => COLUMN_DEFS[k].sortable,
);

const MAX_NESTED_LEVELS = 4;

export function NetworkViewMenu({
  layout,
  sortKind,
  sortMode,
  sortBy: _sortBy,
  sortDir,
  customNested,
  showFireDots,
  sortByLabel,
  onLayoutChange,
  onSortModeChange,
  onUseColumnSort,
  onCustomNestedChange,
  onUseCustomNested,
  onToggleShowFireDots,
}: {
  layout: DevpanelNetworkLayoutSetting;
  sortKind: DevpanelNetworkSortKindSetting;
  sortMode: DevpanelNetworkSortModeSetting;
  sortBy: DevpanelNetworkSortBySetting;
  sortDir: DevpanelNetworkSortDirSetting;
  customNested: readonly NetworkCustomNestedLevel[];
  showFireDots: boolean;
  /** Human label for the current column-click column (e.g. "Timestamp"). */
  sortByLabel: string;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  onSortModeChange: (mode: NetworkSortMode) => void;
  onUseColumnSort: () => void;
  onCustomNestedChange: (next: NetworkCustomNestedLevel[]) => void;
  onUseCustomNested: () => void;
  onToggleShowFireDots: () => void;
}) {
  const arrivalActive = sortKind === 'mode' && sortMode === 'arrival';
  const columnActive = sortKind === 'column';
  const customActive = sortKind === 'customNested';
  const groupActive = (id: 'priority' | 'grouping') =>
    sortKind === 'mode' && GROUPS.find((g) => g.id === id)?.modes.includes(sortMode);

  const activeBadgeCount =
    (layout !== 'compact' ? 1 : 0) +
    (sortKind === 'column' || sortKind === 'customNested' || sortMode !== 'arrival' ? 1 : 0) +
    (!showFireDots ? 1 : 0);

  // ── Subtitle for the closed-state row ───────────────────────────
  // Picking up where the mode card subtitles left off — we want users
  // to see WHICH mode is active even when its group is collapsed.
  const activeSubtitle = useMemo<string>(() => {
    if (sortKind === 'column') return `${sortByLabel} · ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`;
    if (sortKind === 'customNested') {
      if (customNested.length === 0) return 'No levels yet — open the builder.';
      return customNested.map((l) => `${labelFor(l.key)} ${l.dir === 'asc' ? '↑' : '↓'}`).join(' · ');
    }
    return NETWORK_SORT_MODE_META[sortMode].subtitle;
  }, [sortKind, sortMode, sortDir, sortByLabel, customNested]);

  const activeTitle = useMemo<string>(() => {
    if (sortKind === 'column') return 'Custom (column-click)';
    if (sortKind === 'customNested') return 'Custom (nested)';
    return NETWORK_SORT_MODE_META[sortMode].title;
  }, [sortKind, sortMode]);

  const content = (
    <div className="dt-morefilters-menu dt-network-view-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Layout</span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <div className="dt-sortmode-heading">Sort order</div>
      <div className="dt-sortmode-active">
        <div className="dt-sortmode-active-title">{activeTitle}</div>
        <div className="dt-sortmode-active-subtitle">{activeSubtitle}</div>
      </div>
      <SortRow
        title="Arrival"
        subtitle="Chronological — the order requests started."
        active={arrivalActive}
        onClick={() => onSortModeChange('arrival')}
      />
      {GROUPS.map((g) => (
        <SortGroupRow
          key={g.id}
          label={g.label}
          hint={g.hint}
          modes={g.modes}
          active={!!groupActive(g.id)}
          activeMode={sortKind === 'mode' ? sortMode : null}
          onPick={onSortModeChange}
        />
      ))}
      <SortCustomNestedRow
        levels={customNested}
        active={customActive}
        onChange={onCustomNestedChange}
        onActivate={onUseCustomNested}
      />
      <SortRow
        title="Custom (column-click)"
        subtitle={`${sortByLabel} · ${sortDir === 'asc' ? 'Ascending' : 'Descending'}${
          !columnActive ? ' · click a column header to use this' : ''
        }`}
        active={columnActive}
        disabled={columnActive}
        onClick={onUseColumnSort}
      />
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFireDots} onChange={onToggleShowFireDots} />
        Show rule-fire dots
      </label>
    </div>
  );
  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      overlayClassName="dt-morefilters-popover"
    >
      <button type="button" className={`dt-toolbar-dropdown${activeBadgeCount > 0 ? ' dt-toolbar-dropdown--active' : ''}`}>
        View
        {activeBadgeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeBadgeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}

function SortRow({
  title,
  subtitle,
  active,
  disabled,
  onClick,
}: {
  title: string;
  subtitle?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dt-sortmode-item" disabled={disabled} onClick={onClick}>
      <div className="dt-sortmode-item-body">
        <div className="dt-sortmode-item-title">{title}</div>
        {subtitle && <div className="dt-sortmode-item-subtitle">{subtitle}</div>}
      </div>
      {active && (
        <span className="dt-sortmode-item-check" aria-hidden="true">
          <CheckOutlined />
        </span>
      )}
    </button>
  );
}

function SortGroupRow({
  label,
  hint,
  modes,
  active,
  activeMode,
  onPick,
}: {
  label: string;
  hint: string;
  modes: readonly NetworkSortMode[];
  active: boolean;
  activeMode: NetworkSortMode | null;
  onPick: (m: NetworkSortMode) => void;
}) {
  const submenu = (
    <div className="dt-sortmode-submenu" role="menu">
      {modes.map((m) => {
        const meta = NETWORK_SORT_MODE_META[m];
        const isActive = activeMode === m;
        return (
          <button key={m} type="button" className="dt-sortmode-item" onClick={() => onPick(m)}>
            <div className="dt-sortmode-item-body">
              <div className="dt-sortmode-item-title">{meta.title}</div>
              <div className="dt-sortmode-item-subtitle">{meta.subtitle}</div>
            </div>
            {isActive && (
              <span className="dt-sortmode-item-check" aria-hidden="true">
                <CheckOutlined />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
  return (
    <Popover
      content={submenu}
      trigger="hover"
      placement="rightTop"
      arrow={false}
      overlayClassName="dt-morefilters-popover dt-sortmode-submenu-popover"
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.1}
    >
      <div className="dt-sortmode-item dt-sortmode-item--group">
        <div className="dt-sortmode-item-body">
          <div className="dt-sortmode-item-title">{label}</div>
          <div className="dt-sortmode-item-subtitle">{hint}</div>
        </div>
        {active && (
          <span className="dt-sortmode-item-check" aria-hidden="true">
            <CheckOutlined />
          </span>
        )}
        <span className="dt-sortmode-item-chevron" aria-hidden="true">
          <RightOutlined />
        </span>
      </div>
    </Popover>
  );
}

function SortCustomNestedRow({
  levels,
  active,
  onChange,
  onActivate,
}: {
  levels: readonly NetworkCustomNestedLevel[];
  active: boolean;
  onChange: (next: NetworkCustomNestedLevel[]) => void;
  onActivate: () => void;
}) {
  const subtitle =
    levels.length === 0
      ? 'Build a multi-key sort — column by column, with arrival as the final tiebreak.'
      : `${levels.length} level${levels.length === 1 ? '' : 's'} — opens to edit.`;
  const submenu = (
    <div className="dt-sortmode-submenu dt-sortmode-submenu--builder" role="menu">
      <div className="dt-sortmode-builder-title">Sort by, in order</div>
      {levels.length === 0 && <div className="dt-sortmode-builder-empty">No levels yet. Add one below.</div>}
      {levels.map((lvl, i) => (
        <div key={i} className="dt-sortmode-builder-row">
          <span className="dt-sortmode-builder-step">{i + 1}.</span>
          <select
            value={lvl.key}
            onChange={(e) => {
              const next = levels.slice();
              next[i] = { ...lvl, key: e.target.value as DevpanelNetworkSortBySetting };
              onChange(next);
            }}
          >
            <option value="id"># (Arrival)</option>
            {SORTABLE_COLUMN_KEYS.map((k) => (
              <option key={k} value={k}>
                {COLUMN_DEFS[k].label}
              </option>
            ))}
          </select>
          <select
            value={lvl.dir}
            onChange={(e) => {
              const next = levels.slice();
              next[i] = { ...lvl, dir: e.target.value as DevpanelNetworkSortDirSetting };
              onChange(next);
            }}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <button
            type="button"
            className="dt-sortmode-builder-remove"
            aria-label={`Remove level ${i + 1}`}
            onClick={() => onChange(levels.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      {levels.length < MAX_NESTED_LEVELS && (
        <button
          type="button"
          className="dt-sortmode-builder-add"
          onClick={() => onChange([...levels, { key: defaultLevelKey(levels), dir: 'asc' }])}
        >
          + Add level
        </button>
      )}
      <div className="dt-sortmode-builder-footer">
        <span className="dt-sortmode-builder-tiebreak">Final tiebreak: arrival</span>
        <button
          type="button"
          className="dt-sortmode-builder-apply"
          onClick={onActivate}
          disabled={levels.length === 0 || active}
        >
          {active ? 'Active' : 'Apply'}
        </button>
      </div>
    </div>
  );
  return (
    <Popover
      content={submenu}
      trigger="hover"
      placement="rightTop"
      arrow={false}
      overlayClassName="dt-morefilters-popover dt-sortmode-submenu-popover"
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.1}
    >
      <div className="dt-sortmode-item dt-sortmode-item--group">
        <div className="dt-sortmode-item-body">
          <div className="dt-sortmode-item-title">Custom (nested)</div>
          <div className="dt-sortmode-item-subtitle">{subtitle}</div>
        </div>
        {active && (
          <span className="dt-sortmode-item-check" aria-hidden="true">
            <CheckOutlined />
          </span>
        )}
        <span className="dt-sortmode-item-chevron" aria-hidden="true">
          <RightOutlined />
        </span>
      </div>
    </Popover>
  );
}

function defaultLevelKey(existing: readonly NetworkCustomNestedLevel[]): DevpanelNetworkSortBySetting {
  // Pick the first sortable column that's not already in the chain.
  const used = new Set(existing.map((l) => l.key));
  const all: DevpanelNetworkSortBySetting[] = ['status', 'time', 'size', 'type', 'name', 'method', 'timestamp', 'id'];
  for (const k of all) if (!used.has(k)) return k;
  return 'id';
}

function labelFor(key: DevpanelNetworkSortBySetting): string {
  if (key === 'id') return '#';
  return COLUMN_DEFS[key].label;
}
