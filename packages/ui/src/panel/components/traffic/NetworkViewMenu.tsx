import type {
  DevpanelNetworkLayoutSetting,
  DevpanelNetworkWaterfallTimestampTzSetting,
  DevpanelNetworkWaterfallValueFormatSetting,
  DevpanelNetworkWaterfallValuesSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
import { ToolbarMenuPopover } from '../ToolbarMenuPopover';

/**
 * `View ▾` dropdown for the Network requests table — display options that
 * aren't sorting: the table layout (compact / wide), the Waterfall metric the
 * column shows, when the metric's value chip appears, and the rule-fire dot
 * toggle. Picking a Waterfall metric here changes only what the column
 * displays (it does not force a sort) — the same control the column-header
 * context menu offers. Sorting lives in its own `Sort ▾` menu
 * ([[NetworkSortMenu]]) and column visibility on the column-header context
 * menu, so this stays small.
 */

const WATERFALL_METRICS: readonly WaterfallMetric[] = ['startTime', 'responseTime', 'endTime', 'duration', 'latency'];
const WATERFALL_VALUES_OPTIONS: ReadonlyArray<{ value: DevpanelNetworkWaterfallValuesSetting; label: string }> = [
  { value: 'always', label: 'Always' },
  { value: 'hover', label: 'On hover' },
  { value: 'off', label: 'Off' },
];
const VALUE_FORMAT_OPTIONS: ReadonlyArray<{ value: DevpanelNetworkWaterfallValueFormatSetting; label: string }> = [
  { value: 'relative', label: 'Relative' },
  { value: 'timestamp', label: 'Timestamp' },
];
const TIMESTAMP_TZ_OPTIONS: ReadonlyArray<{ value: DevpanelNetworkWaterfallTimestampTzSetting; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'utc', label: 'UTC' },
];

export function NetworkViewMenu({
  layout,
  waterfallMetric,
  waterfallValues,
  waterfallValueFormat,
  waterfallTimestampTz,
  waterfallExplainValue,
  showFireDots,
  onLayoutChange,
  onWaterfallMetricChange,
  onWaterfallValuesChange,
  onWaterfallValueFormatChange,
  onWaterfallTimestampTzChange,
  onToggleExplainValue,
  onToggleShowFireDots,
  onReset,
}: {
  layout: DevpanelNetworkLayoutSetting;
  waterfallMetric: WaterfallMetric;
  waterfallValues: DevpanelNetworkWaterfallValuesSetting;
  waterfallValueFormat: DevpanelNetworkWaterfallValueFormatSetting;
  waterfallTimestampTz: DevpanelNetworkWaterfallTimestampTzSetting;
  waterfallExplainValue: boolean;
  showFireDots: boolean;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  /** Change only the displayed Waterfall metric — no sort change. */
  onWaterfallMetricChange: (metric: WaterfallMetric) => void;
  onWaterfallValuesChange: (mode: DevpanelNetworkWaterfallValuesSetting) => void;
  onWaterfallValueFormatChange: (format: DevpanelNetworkWaterfallValueFormatSetting) => void;
  onWaterfallTimestampTzChange: (tz: DevpanelNetworkWaterfallTimestampTzSetting) => void;
  onToggleExplainValue: () => void;
  onToggleShowFireDots: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const activeBadgeCount =
    (layout !== 'compact' ? 1 : 0) +
    (waterfallMetric !== 'startTime' ? 1 : 0) +
    (waterfallValues !== 'always' ? 1 : 0) +
    (waterfallValueFormat !== 'relative' ? 1 : 0) +
    (!waterfallExplainValue ? 1 : 0) +
    (!showFireDots ? 1 : 0);

  return (
    <ToolbarMenuPopover label="View" activeCount={activeBadgeCount} menuClassName="dt-network-view-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Layout</span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <div className="dt-sortmode-heading">Waterfall</div>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Value number</span>
        <select
          value={waterfallMetric}
          onChange={(e) => onWaterfallMetricChange(e.target.value as WaterfallMetric)}
        >
          {WATERFALL_METRICS.map((m) => (
            <option key={m} value={m}>
              {WATERFALL_METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Show value</span>
        <select
          value={waterfallValues}
          onChange={(e) => onWaterfallValuesChange(e.target.value as DevpanelNetworkWaterfallValuesSetting)}
        >
          {WATERFALL_VALUES_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Value format</span>
        <select
          value={waterfallValueFormat}
          onChange={(e) => onWaterfallValueFormatChange(e.target.value as DevpanelNetworkWaterfallValueFormatSetting)}
        >
          {VALUE_FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {waterfallValueFormat === 'timestamp' && (
        <label className="dt-morefilters-item dt-morefilters-item--select">
          <span className="dt-morefilters-item-label">Timezone</span>
          <select
            value={waterfallTimestampTz}
            onChange={(e) => onWaterfallTimestampTzChange(e.target.value as DevpanelNetworkWaterfallTimestampTzSetting)}
          >
            {TIMESTAMP_TZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="dt-morefilters-item" title="In the hover popover, highlight the rows that make up the total and show their sum.">
        <input type="checkbox" checked={waterfallExplainValue} onChange={onToggleExplainValue} />
        Explain value
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFireDots} onChange={onToggleShowFireDots} />
        Show rule-fire dots
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeBadgeCount === 0}>
        Reset to default
      </button>
    </ToolbarMenuPopover>
  );
}
