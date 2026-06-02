import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { NetworkCustomNestedLevel } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import {
  buildCustomNestedComparator,
  NETWORK_SORT_MODE_COMPARATORS,
  type NetworkSortMode,
} from '../../data/network-sort-modes';
import { COLUMN_DEFS, type ColumnDef } from './columns';
import { NetworkViewMenu } from './NetworkViewMenu';
import { sortCompare, type SortDir, type SortTarget } from './sort';

export interface NetworkViewApi {
  /** `'compact'` layout — columns fit the panel width without scrolling. */
  compact: boolean;
  showFireDots: boolean;
  sortKey: SortTarget;
  sortDir: SortDir;
  /** Active Waterfall sub-metric — drives the Waterfall sort key and header label. */
  waterfallMetric: WaterfallMetric;
  /** Whether a column-header sort (vs. a sort mode / custom nesting) is active. */
  columnSortActive: boolean;
  /** The assembled view-options menu node for the panel header. */
  viewMenu: ReactNode;
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
  // Custom-nested levels are session-scoped scratch state.
  const [customNested, setCustomNested] = useState<NetworkCustomNestedLevel[]>([]);
  const compact = layout === 'compact';

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
    sortKey === 'id'
      ? '#'
      : sortKey === 'waterfall'
        ? `Waterfall (${WATERFALL_METRIC_LABELS[waterfallMetric]})`
        : COLUMN_DEFS[sortKey].label;

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

  const viewMenu = useMemo(
    () => (
      <NetworkViewMenu
        layout={layout}
        sortKind={sortKind}
        sortMode={sortMode}
        sortBy={sortKey}
        sortDir={sortDir}
        waterfallMetric={waterfallMetric}
        customNested={customNested}
        showFireDots={showFireDots}
        sortByLabel={sortByLabel}
        onLayoutChange={setLayout}
        onSortModeChange={handleSortModeChange}
        onUseColumnSort={handleUseColumnSort}
        onWaterfallMetricChange={handleWaterfallMetricChange}
        onCustomNestedChange={setCustomNested}
        onUseCustomNested={handleUseCustomNested}
        onToggleShowFireDots={toggleShowFireDots}
      />
    ),
    [
      layout,
      sortKind,
      sortMode,
      sortKey,
      sortDir,
      waterfallMetric,
      customNested,
      showFireDots,
      sortByLabel,
      setLayout,
      handleSortModeChange,
      handleUseColumnSort,
      handleWaterfallMetricChange,
      handleUseCustomNested,
      toggleShowFireDots,
    ],
  );

  return {
    compact,
    showFireDots,
    sortKey,
    sortDir,
    waterfallMetric,
    columnSortActive: sortKind === 'column',
    viewMenu,
    handleSortTarget,
    handleSort,
    sortRows,
  };
}
