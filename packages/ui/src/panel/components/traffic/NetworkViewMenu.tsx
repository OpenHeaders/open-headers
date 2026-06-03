import { Popover } from 'antd';
import type {
  DevpanelNetworkLayoutSetting,
  DevpanelNetworkWaterfallTimestampTzSetting,
  DevpanelNetworkWaterfallValueFormatSetting,
  DevpanelNetworkWaterfallValuesSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';

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
  showFireDots,
  onLayoutChange,
  onWaterfallMetricChange,
  onWaterfallValuesChange,
  onWaterfallValueFormatChange,
  onWaterfallTimestampTzChange,
  onToggleShowFireDots,
}: {
  layout: DevpanelNetworkLayoutSetting;
  waterfallMetric: WaterfallMetric;
  waterfallValues: DevpanelNetworkWaterfallValuesSetting;
  waterfallValueFormat: DevpanelNetworkWaterfallValueFormatSetting;
  waterfallTimestampTz: DevpanelNetworkWaterfallTimestampTzSetting;
  showFireDots: boolean;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  /** Change only the displayed Waterfall metric — no sort change. */
  onWaterfallMetricChange: (metric: WaterfallMetric) => void;
  onWaterfallValuesChange: (mode: DevpanelNetworkWaterfallValuesSetting) => void;
  onWaterfallValueFormatChange: (format: DevpanelNetworkWaterfallValueFormatSetting) => void;
  onWaterfallTimestampTzChange: (tz: DevpanelNetworkWaterfallTimestampTzSetting) => void;
  onToggleShowFireDots: () => void;
}) {
  const activeBadgeCount =
    (layout !== 'compact' ? 1 : 0) +
    (waterfallMetric !== 'startTime' ? 1 : 0) +
    (waterfallValues !== 'always' ? 1 : 0) +
    (waterfallValueFormat !== 'relative' ? 1 : 0) +
    (!showFireDots ? 1 : 0);

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
