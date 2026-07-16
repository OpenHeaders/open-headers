import { Popover } from 'antd';
import { CheckOutlined, RightOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
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
  labelKey: MessageKey;
  hintKey: MessageKey;
  modes: readonly NetworkSortMode[];
}> = [
  {
    id: 'priority',
    labelKey: 'panel.network.sort.groupPriority',
    hintKey: 'panel.network.sort.groupPriorityHint',
    modes: ['failures', 'slowest', 'largest', 'browserPriority'],
  },
  {
    id: 'grouping',
    labelKey: 'panel.network.sort.groupGrouping',
    hintKey: 'panel.network.sort.groupGroupingHint',
    modes: ['byType', 'byDomain', 'ruleModified'],
  },
];

const SORTABLE_COLUMN_KEYS: ReadonlyArray<ColumnKey> = (Object.keys(COLUMN_DEFS) as ColumnKey[]).filter(
  (k) => COLUMN_DEFS[k].sortable,
);

// The metric names themselves (Start time / … / Latency) are parity
// vocabulary and stay raw; only the explanatory subtitles key.
const WATERFALL_METRICS: ReadonlyArray<{ value: WaterfallMetric; subtitleKey: MessageKey }> = [
  { value: 'startTime', subtitleKey: 'panel.network.sortMetric.startTime' },
  { value: 'responseTime', subtitleKey: 'panel.network.sortMetric.responseTime' },
  { value: 'endTime', subtitleKey: 'panel.network.sortMetric.endTime' },
  { value: 'duration', subtitleKey: 'panel.network.sortMetric.duration' },
  { value: 'latency', subtitleKey: 'panel.network.sortMetric.latency' },
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
  const t = useT();
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
      // Raw column / metric label · keyed direction — an independent-clause
      // join, not fragment stitching.
      return `${label} · ${sortDir === 'asc' ? t('panel.network.sort.ascending') : t('panel.network.sort.descending')}`;
    }
    if (sortKind === 'customNested') {
      if (customNested.length === 0) return t('panel.network.sort.noLevelsYet');
      return customNested.map((l) => `${labelFor(l.key)} ${l.dir === 'asc' ? '↑' : '↓'}`).join(' · ');
    }
    return t(NETWORK_SORT_MODE_META[sortMode].subtitleKey);
  }, [sortKind, sortMode, sortDir, sortBy, waterfallMetric, sortByLabel, customNested, t]);

  const activeTitle = useMemo<string>(() => {
    if (sortKind === 'column') return sortBy === 'waterfall' ? 'Waterfall' : t('panel.network.sort.columnClick');
    if (sortKind === 'customNested') return t('panel.network.sort.customNested');
    return t(NETWORK_SORT_MODE_META[sortMode].titleKey);
  }, [sortKind, sortMode, sortBy, t]);

  return (
    <ToolbarMenuPopover
      label={t('panel.network.sort.label')}
      activeCount={activeBadgeCount}
      menuClassName="dt-network-view-menu"
    >
      <div className="dt-sortmode-heading">{t('panel.network.sort.heading')}</div>
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
          label={t(g.labelKey)}
          hint={t(g.hintKey)}
          modes={g.modes}
          active={!!groupActive(g.id)}
          activeMode={sortKind === 'mode' ? sortMode : null}
          onPick={onSortModeChange}
        />
      ))}
      <SortRow
        title={t('panel.network.sort.columnClick')}
        subtitle={
          sortBy === 'waterfall'
            ? t('panel.network.sort.columnClickIdle')
            : [
                sortByLabel,
                sortDir === 'asc' ? t('panel.network.sort.ascending') : t('panel.network.sort.descending'),
                ...(columnClickActive ? [] : [t('panel.network.sort.columnClickUse')]),
              ].join(' · ')
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
        {t('panel.menu.resetToDefault')}
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
  const t = useT();
  const submenu = (
    <div className="dt-sortmode-submenu" role="menu">
      {modes.map((m) => {
        const meta = NETWORK_SORT_MODE_META[m];
        const isActive = activeMode === m;
        return (
          <button key={m} type="button" className="dt-sortmode-item" onClick={() => onPick(m)}>
            <div className="dt-sortmode-item-body">
              <div className="dt-sortmode-item-title">{t(meta.titleKey)}</div>
              <div className="dt-sortmode-item-subtitle">{t(meta.subtitleKey)}</div>
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
  const t = useT();
  const submenu = (
    <div className="dt-sortmode-submenu" role="menu">
      {WATERFALL_METRICS.map((m) => {
        const isActive = active && activeMetric === m.value;
        return (
          <button key={m.value} type="button" className="dt-sortmode-item" onClick={() => onPick(m.value)}>
            <div className="dt-sortmode-item-body">
              <div className="dt-sortmode-item-title">{WATERFALL_METRIC_LABELS[m.value]}</div>
              <div className="dt-sortmode-item-subtitle">{t(m.subtitleKey)}</div>
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
          {/* Parity vocabulary — the Waterfall column name stays raw. */}
          <div className="dt-sortmode-item-title">Waterfall</div>
          <div className="dt-sortmode-item-subtitle">{t('panel.network.sort.byTime')}</div>
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
  const t = useT();
  const subtitle =
    levels.length === 0
      ? t('panel.network.sort.customNestedIdle')
      : t('panel.network.sort.customNestedLevels', { count: levels.length });
  const submenu = (
    <div className="dt-sortmode-submenu dt-sortmode-submenu--builder" role="menu">
      <div className="dt-sortmode-builder-title">{t('panel.network.sort.builderTitle')}</div>
      {levels.length === 0 && <div className="dt-sortmode-builder-empty">{t('panel.network.sort.builderEmpty')}</div>}
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
            <option value="asc">{t('panel.network.sort.asc')}</option>
            <option value="desc">{t('panel.network.sort.desc')}</option>
          </select>
          <button
            type="button"
            className="dt-sortmode-builder-remove"
            aria-label={t('panel.network.sort.removeLevel', { n: i + 1 })}
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
          {t('panel.network.sort.addLevel')}
        </button>
      )}
      <div className="dt-sortmode-builder-footer">
        <span className="dt-sortmode-builder-tiebreak">{t('panel.network.sort.finalTiebreak')}</span>
        <button
          type="button"
          className="dt-sortmode-builder-apply"
          onClick={onActivate}
          disabled={levels.length === 0 || active}
        >
          {active ? t('panel.network.sort.active') : t('panel.network.sort.apply')}
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
          <div className="dt-sortmode-item-title">{t('panel.network.sort.customNested')}</div>
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
