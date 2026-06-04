import { Popover } from 'antd';
import { CheckOutlined, RightOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type {
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
  DevpanelNetworkSortKindSetting,
  DevpanelNetworkSortModeSetting,
  NetworkCustomNestedLevel,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
import { NETWORK_SORT_MODE_META, type NetworkSortMode } from '../../data/network-sort-modes';
import { ToolbarMenuPopover } from '../ToolbarMenuPopover';
import { COLUMN_DEFS, type ColumnKey } from './columns';

/**
 * `Sort ▾` dropdown for the Network requests table. The sort surface is
 * grouped into intent buckets — Waterfall, Priority, Grouping — with
 * hover-expanded submenus, so the top-level menu stays short. A further
 * row opens a builder for an arbitrary nested (multi-key) sort, and a
 * Custom (column-click) row reflects the sort a column-header click sets.
 *
 * Submenu positioning, collision detection, keyboard handling, and
 * portaling are all delegated to antd `Popover` (trigger="hover",
 * placement="rightTop") — one per group — so this component owns no
 * coordinate math and no submenu open/close state.
 *
 * Layout, the fire-dot toggle, and column visibility live elsewhere
 * (the View menu / the column-header context menu) — this owns sorting.
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
    modes: ['failures', 'slowest', 'largest', 'browserPriority'],
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

const WATERFALL_METRICS: ReadonlyArray<{ value: WaterfallMetric; subtitle: string }> = [
  { value: 'startTime', subtitle: 'When the request started.' },
  { value: 'responseTime', subtitle: 'When the first response byte arrived.' },
  { value: 'endTime', subtitle: 'When the request finished.' },
  { value: 'duration', subtitle: 'How long it took — bars zero-aligned.' },
  { value: 'latency', subtitle: 'Time to first byte — bars zero-aligned.' },
];

const MAX_NESTED_LEVELS = 4;

export function NetworkSortMenu({
  sortKind,
  sortMode,
  sortBy,
  sortDir,
  waterfallMetric,
  customNested,
  sortByLabel,
  onSortModeChange,
  onUseColumnSort,
  onWaterfallMetricChange,
  onCustomNestedChange,
  onUseCustomNested,
  onReset,
}: {
  sortKind: DevpanelNetworkSortKindSetting;
  sortMode: DevpanelNetworkSortModeSetting;
  sortBy: DevpanelNetworkSortBySetting;
  sortDir: DevpanelNetworkSortDirSetting;
  waterfallMetric: WaterfallMetric;
  customNested: readonly NetworkCustomNestedLevel[];
  /** Human label for the current column-click column (e.g. "Waterfall (Start time)"). */
  sortByLabel: string;
  onSortModeChange: (mode: NetworkSortMode) => void;
  onUseColumnSort: () => void;
  onWaterfallMetricChange: (metric: WaterfallMetric) => void;
  onCustomNestedChange: (next: NetworkCustomNestedLevel[]) => void;
  onUseCustomNested: () => void;
  /** Restore the sort selection to its registered default. */
  onReset: () => void;
}) {
  const waterfallActive = sortKind === 'column' && sortBy === 'waterfall';
  // Waterfall has its own row, so "Custom (column-click)" represents only the
  // non-waterfall column-header sorts — otherwise sorting by Waterfall would
  // light up both rows and echo "Waterfall" here, which reads as a duplicate.
  const columnClickActive = sortKind === 'column' && sortBy !== 'waterfall';
  const customActive = sortKind === 'customNested';
  const groupActive = (id: 'priority' | 'grouping') =>
    sortKind === 'mode' && GROUPS.find((g) => g.id === id)?.modes.includes(sortMode);

  // Default sort is Waterfall (Start time) ascending — only count the badge
  // when the user has moved away from it.
  const sortIsDefault = waterfallActive && waterfallMetric === 'startTime' && sortDir === 'asc';
  const activeBadgeCount = sortIsDefault ? 0 : 1;

  // ── Subtitle for the closed-state row ───────────────────────────
  // Picking up where the mode card subtitles left off — we want users
  // to see WHICH mode is active even when its group is collapsed.
  const activeSubtitle = useMemo<string>(() => {
    if (sortKind === 'column') {
      const label = sortBy === 'waterfall' ? WATERFALL_METRIC_LABELS[waterfallMetric] : sortByLabel;
      return `${label} · ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`;
    }
    if (sortKind === 'customNested') {
      if (customNested.length === 0) return 'No levels yet — open the builder.';
      return customNested.map((l) => `${labelFor(l.key)} ${l.dir === 'asc' ? '↑' : '↓'}`).join(' · ');
    }
    return NETWORK_SORT_MODE_META[sortMode].subtitle;
  }, [sortKind, sortMode, sortDir, sortBy, waterfallMetric, sortByLabel, customNested]);

  const activeTitle = useMemo<string>(() => {
    if (sortKind === 'column') return sortBy === 'waterfall' ? 'Waterfall' : 'Custom (column-click)';
    if (sortKind === 'customNested') return 'Custom (nested)';
    return NETWORK_SORT_MODE_META[sortMode].title;
  }, [sortKind, sortMode, sortBy]);

  return (
    <ToolbarMenuPopover label="Sort" activeCount={activeBadgeCount} menuClassName="dt-network-view-menu">
      <div className="dt-sortmode-heading">Sort order</div>
      <div className="dt-sortmode-active">
        <div className="dt-sortmode-active-title">{activeTitle}</div>
        <div className="dt-sortmode-active-subtitle">{activeSubtitle}</div>
      </div>
      <SortCustomNestedRow
        levels={customNested}
        active={customActive}
        onChange={onCustomNestedChange}
        onActivate={onUseCustomNested}
      />
      <WaterfallSortRow active={waterfallActive} activeMetric={waterfallMetric} onPick={onWaterfallMetricChange} />
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
      <SortRow
        title="Custom (column-click)"
        subtitle={
          sortBy === 'waterfall'
            ? 'Click a column header to sort by it.'
            : `${sortByLabel} · ${sortDir === 'asc' ? 'Ascending' : 'Descending'}${
                columnClickActive ? '' : ' · click a column header to use this'
              }`
        }
        active={columnClickActive}
        disabled={columnClickActive}
        onClick={onUseColumnSort}
      />
      <div className="dt-morefilters-divider" />
      <button
        type="button"
        className="dt-morefilters-reset"
        onClick={onReset}
        disabled={sortIsDefault && customNested.length === 0}
      >
        Reset to default
      </button>
    </ToolbarMenuPopover>
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

function WaterfallSortRow({
  active,
  activeMetric,
  onPick,
}: {
  active: boolean;
  activeMetric: WaterfallMetric;
  onPick: (metric: WaterfallMetric) => void;
}) {
  const submenu = (
    <div className="dt-sortmode-submenu" role="menu">
      {WATERFALL_METRICS.map((m) => {
        const isActive = active && activeMetric === m.value;
        return (
          <button key={m.value} type="button" className="dt-sortmode-item" onClick={() => onPick(m.value)}>
            <div className="dt-sortmode-item-body">
              <div className="dt-sortmode-item-title">{WATERFALL_METRIC_LABELS[m.value]}</div>
              <div className="dt-sortmode-item-subtitle">{m.subtitle}</div>
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
          <div className="dt-sortmode-item-title">Waterfall</div>
          <div className="dt-sortmode-item-subtitle">Sort by time.</div>
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
      ? 'Multi-key sort — column by column.'
      : `${levels.length} level${levels.length === 1 ? '' : 's'} — open to edit.`;
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
        <span className="dt-sortmode-builder-tiebreak">Final tiebreak: start time</span>
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
  const all: DevpanelNetworkSortBySetting[] = [
    'status',
    'time',
    'size',
    'type',
    'name',
    'method',
    'waterfall',
    'requestNumber',
  ];
  for (const k of all) if (!used.has(k)) return k;
  return 'requestNumber';
}

function labelFor(key: DevpanelNetworkSortBySetting): string {
  return COLUMN_DEFS[key].label;
}
