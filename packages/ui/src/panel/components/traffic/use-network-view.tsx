import { useResetSetting, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type {
  DevpanelNetworkWaterfallTimestampTzSetting,
  DevpanelNetworkWaterfallValueFormatSetting,
  DevpanelNetworkWaterfallValuesSetting,
  NetworkCustomNestedLevel,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import {
  buildCustomNestedComparator,
  NETWORK_SORT_MODE_COMPARATORS,
  type NetworkSortMode,
} from '../../data/network-sort-modes';
import { COLUMN_DEFS, type ColumnDef } from './columns';
import { NetworkSortMenu } from './NetworkSortMenu';
import { NetworkViewMenu } from './NetworkViewMenu';
import { sortCompare, type SortDir, type SortTarget } from './sort';

export interface NetworkViewApi {
  /** `'compact'` layout — columns fit the panel width without scrolling. */
  compact: boolean;
  showFireDots: boolean;
  /** When the active timeline metric's value chip shows on the bar. */
  waterfallValues: DevpanelNetworkWaterfallValuesSetting;
  /** Relative-offset vs absolute-timestamp form for the timeline value. */
  waterfallValueFormat: DevpanelNetworkWaterfallValueFormatSetting;
  /** Timezone for the timestamp value form. */
  waterfallTimestampTz: DevpanelNetworkWaterfallTimestampTzSetting;
  sortKey: SortTarget;
  sortDir: SortDir;
  /** Active Waterfall sub-metric — drives the Waterfall sort key and header label. */
  waterfallMetric: WaterfallMetric;
  /** Set the displayed waterfall metric directly (no sort change) — for the column-header menu. */
  setWaterfallMetric: (metric: WaterfallMetric) => void;
  /** Whether a column-header sort (vs. a sort mode / custom nesting) is active. */
  columnSortActive: boolean;
  /** The assembled view-options menu node (layout, fire dots) for the panel header. */
  viewMenu: ReactNode;
  /** The assembled sort menu node for the panel header. */
  sortMenu: ReactNode;
  /** Sort by a column-header target, toggling direction on repeat. */
  handleSortTarget: (target: SortTarget) => void;
  /** Sort by a sortable column (no-op for non-sortable columns). */
  handleSort: (col: ColumnDef) => void;
  /** Apply the active sort to a filtered row list. */
  sortRows: (rows: readonly InspectorRowWithFires[]) => InspectorRowWithFires[];
}

/**
 * The network view-options axis: layout (compact), the sort selection
 * (column / mode / custom-nested), and the fire-dot toggle — all of which
 * feed the view menu. Bundles the persisted settings, the menu node, and
 * the sort application so the table component stays a thin orchestrator.
 */
export function useNetworkView(): NetworkViewApi {
  const [layout, setLayout] = useSetting('devpanelNetwork.layout');
  const [sortKind, setSortKind] = useSetting('devpanelNetwork.sortKind');
  const [sortMode, setSortMode] = useSetting('devpanelNetwork.sortMode');
  const [sortKey, setSortKey] = useSetting('devpanelNetwork.sortBy');
  const [sortDir, setSortDir] = useSetting('devpanelNetwork.sortDir');
  const [waterfallMetric, setWaterfallMetric] = useSetting('devpanelNetwork.waterfallMetric');
  const [showFireDots, setShowFireDots] = useSetting('devpanelNetwork.showFireDots');
  const [waterfallValues, setWaterfallValues] = useSetting('devpanelNetwork.waterfallValues');
  const [waterfallValueFormat, setWaterfallValueFormat] = useSetting('devpanelNetwork.waterfallValueFormat');
  const [waterfallTimestampTz, setWaterfallTimestampTz] = useSetting('devpanelNetwork.waterfallTimestampTz');
  // Custom-nested levels are session-scoped scratch state.
  const [customNested, setCustomNested] = useState<NetworkCustomNestedLevel[]>([]);
  const compact = layout === 'compact';

  // Per-menu "Reset to default" — restores each setting to its registered
  // default (no hardcoded values). View owns the display axis; Sort owns the
  // sort selection. Both restore the shared Waterfall metric to its default.
  const resetLayout = useResetSetting('devpanelNetwork.layout');
  const resetWaterfallMetric = useResetSetting('devpanelNetwork.waterfallMetric');
  const resetWaterfallValues = useResetSetting('devpanelNetwork.waterfallValues');
  const resetWaterfallValueFormat = useResetSetting('devpanelNetwork.waterfallValueFormat');
  const resetWaterfallTimestampTz = useResetSetting('devpanelNetwork.waterfallTimestampTz');
  const resetShowFireDots = useResetSetting('devpanelNetwork.showFireDots');
  const resetSortKind = useResetSetting('devpanelNetwork.sortKind');
  const resetSortMode = useResetSetting('devpanelNetwork.sortMode');
  const resetSortBy = useResetSetting('devpanelNetwork.sortBy');
  const resetSortDir = useResetSetting('devpanelNetwork.sortDir');

  const resetView = useCallback(() => {
    resetLayout();
    resetWaterfallMetric();
    resetWaterfallValues();
    resetWaterfallValueFormat();
    resetWaterfallTimestampTz();
    resetShowFireDots();
  }, [
    resetLayout,
    resetWaterfallMetric,
    resetWaterfallValues,
    resetWaterfallValueFormat,
    resetWaterfallTimestampTz,
    resetShowFireDots,
  ]);

  const resetSort = useCallback(() => {
    resetSortKind();
    resetSortMode();
    resetSortBy();
    resetSortDir();
    resetWaterfallMetric();
    setCustomNested([]);
  }, [resetSortKind, resetSortMode, resetSortBy, resetSortDir, resetWaterfallMetric]);

  const toggleShowFireDots = useCallback(() => setShowFireDots(!showFireDots), [showFireDots, setShowFireDots]);
  const handleSortModeChange = useCallback(
    (m: NetworkSortMode) => {
      setSortKind('mode');
      setSortMode(m);
    },
    [setSortKind, setSortMode],
  );
  const handleUseColumnSort = useCallback(() => setSortKind('column'), [setSortKind]);
  const handleUseCustomNested = useCallback(() => setSortKind('customNested'), [setSortKind]);
  const sortByLabel =
    sortKey === 'waterfall' ? `Waterfall (${WATERFALL_METRIC_LABELS[waterfallMetric]})` : COLUMN_DEFS[sortKey].label;

  // Picking a Waterfall metric makes Waterfall the active column sort. Switching
  // into Waterfall from another sort resets to ascending; re-picking while already
  // sorting by Waterfall keeps the current direction (header-click toggles it).
  const handleWaterfallMetricChange = useCallback(
    (m: WaterfallMetric) => {
      const wasWaterfall = sortKind === 'column' && sortKey === 'waterfall';
      setSortKind('column');
      setSortKey('waterfall');
      setWaterfallMetric(m);
      if (!wasWaterfall) setSortDir('asc');
    },
    [sortKind, sortKey, setSortKind, setSortKey, setWaterfallMetric, setSortDir],
  );

  const handleSortTarget = useCallback(
    (target: SortTarget) => {
      setSortKind('column');
      if (sortKind === 'column' && target === sortKey) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(target);
        setSortDir('asc');
      }
    },
    [sortKind, sortKey, sortDir, setSortKind, setSortDir, setSortKey],
  );
  const handleSort = useCallback(
    (col: ColumnDef) => {
      if (col.sortable) handleSortTarget(col.key);
    },
    [handleSortTarget],
  );

  const sortRows = useCallback(
    (input: readonly InspectorRowWithFires[]): InspectorRowWithFires[] => {
      const arr = [...input];
      if (sortKind === 'column') {
        arr.sort((a, b) => sortCompare(a, b, sortKey, sortDir, waterfallMetric));
      } else if (sortKind === 'customNested' && customNested.length > 0) {
        arr.sort(buildCustomNestedComparator(customNested));
      } else {
        arr.sort(NETWORK_SORT_MODE_COMPARATORS[sortMode]);
      }
      return arr;
    },
    [sortKind, sortKey, sortDir, waterfallMetric, sortMode, customNested],
  );

  const sortMenu = useMemo(
    () => (
      <NetworkSortMenu
        sortKind={sortKind}
        sortMode={sortMode}
        sortBy={sortKey}
        sortDir={sortDir}
        waterfallMetric={waterfallMetric}
        customNested={customNested}
        sortByLabel={sortByLabel}
        onSortModeChange={handleSortModeChange}
        onUseColumnSort={handleUseColumnSort}
        onWaterfallMetricChange={handleWaterfallMetricChange}
        onCustomNestedChange={setCustomNested}
        onUseCustomNested={handleUseCustomNested}
        onReset={resetSort}
      />
    ),
    [
      sortKind,
      sortMode,
      sortKey,
      sortDir,
      waterfallMetric,
      customNested,
      sortByLabel,
      handleSortModeChange,
      handleUseColumnSort,
      handleWaterfallMetricChange,
      handleUseCustomNested,
      resetSort,
    ],
  );

  const viewMenu = useMemo(
    () => (
      <NetworkViewMenu
        layout={layout}
        waterfallMetric={waterfallMetric}
        waterfallValues={waterfallValues}
        waterfallValueFormat={waterfallValueFormat}
        waterfallTimestampTz={waterfallTimestampTz}
        showFireDots={showFireDots}
        onLayoutChange={setLayout}
        onWaterfallMetricChange={setWaterfallMetric}
        onWaterfallValuesChange={setWaterfallValues}
        onWaterfallValueFormatChange={setWaterfallValueFormat}
        onWaterfallTimestampTzChange={setWaterfallTimestampTz}
        onToggleShowFireDots={toggleShowFireDots}
        onReset={resetView}
      />
    ),
    [
      layout,
      waterfallMetric,
      waterfallValues,
      waterfallValueFormat,
      waterfallTimestampTz,
      showFireDots,
      setLayout,
      setWaterfallMetric,
      setWaterfallValues,
      setWaterfallValueFormat,
      setWaterfallTimestampTz,
      toggleShowFireDots,
      resetView,
    ],
  );

  return {
    compact,
    showFireDots,
    waterfallValues,
    waterfallValueFormat,
    waterfallTimestampTz,
    sortKey,
    sortDir,
    waterfallMetric,
    setWaterfallMetric,
    columnSortActive: sortKind === 'column',
    viewMenu,
    sortMenu,
    handleSortTarget,
    handleSort,
    sortRows,
  };
}
