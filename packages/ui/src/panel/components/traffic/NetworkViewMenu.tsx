import type {
  DevpanelNetworkLayoutSetting,
  DevpanelNetworkWaterfallPopoverLayoutSetting,
  DevpanelNetworkWaterfallTimestampTzSetting,
  DevpanelNetworkWaterfallValueFormatSetting,
  DevpanelNetworkWaterfallValuesSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../ToolbarMenuPopover';

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

/** Settings behind the `View ▾` menu — its badge and dots derive from
 *  these. The Timezone select is deliberately absent: it only appears
 *  while `waterfallValueFormat` is `timestamp` (itself non-default), so
 *  badging it would double-count one visible choice. */
export const NETWORK_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelNetwork.layout',
  'devpanelNetwork.waterfallMetric',
  'devpanelNetwork.waterfallValues',
  'devpanelNetwork.waterfallValueFormat',
  'devpanelNetwork.waterfallExplainValue',
  'devpanelNetwork.waterfallPopoverLayout',
  'devpanelNetwork.showFireDots',
];

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
const POPOVER_LAYOUT_OPTIONS: ReadonlyArray<{ value: DevpanelNetworkWaterfallPopoverLayoutSetting; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'vertical', label: 'Compact' },
  { value: 'horizontal', label: 'Wide' },
];

export function NetworkViewMenu({
  layout,
  waterfallMetric,
  waterfallValues,
  waterfallValueFormat,
  waterfallTimestampTz,
  waterfallExplainValue,
  waterfallPopoverLayout,
  showFireDots,
  onLayoutChange,
  onWaterfallMetricChange,
  onWaterfallValuesChange,
  onWaterfallValueFormatChange,
  onWaterfallTimestampTzChange,
  onToggleExplainValue,
  onWaterfallPopoverLayoutChange,
  onToggleShowFireDots,
  onReset,
  modified,
}: {
  layout: DevpanelNetworkLayoutSetting;
  waterfallMetric: WaterfallMetric;
  waterfallValues: DevpanelNetworkWaterfallValuesSetting;
  waterfallValueFormat: DevpanelNetworkWaterfallValueFormatSetting;
  waterfallTimestampTz: DevpanelNetworkWaterfallTimestampTzSetting;
  waterfallExplainValue: boolean;
  waterfallPopoverLayout: DevpanelNetworkWaterfallPopoverLayoutSetting;
  showFireDots: boolean;
  onLayoutChange: (mode: DevpanelNetworkLayoutSetting) => void;
  /** Change only the displayed Waterfall metric — no sort change. */
  onWaterfallMetricChange: (metric: WaterfallMetric) => void;
  onWaterfallValuesChange: (mode: DevpanelNetworkWaterfallValuesSetting) => void;
  onWaterfallValueFormatChange: (format: DevpanelNetworkWaterfallValueFormatSetting) => void;
  onWaterfallTimestampTzChange: (tz: DevpanelNetworkWaterfallTimestampTzSetting) => void;
  onToggleExplainValue: () => void;
  onWaterfallPopoverLayoutChange: (layout: DevpanelNetworkWaterfallPopoverLayoutSetting) => void;
  onToggleShowFireDots: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
}) {
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover label="View" activeCount={activeCount} menuClassName="dt-network-view-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          Layout
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.layout')} />
        </span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <div className="dt-sortmode-heading">Waterfall</div>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          Value number
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallMetric')} />
        </span>
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
        <span className="dt-morefilters-item-label">
          Show value
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallValues')} />
        </span>
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
        <span className="dt-morefilters-item-label">
          Value format
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallValueFormat')} />
        </span>
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
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallExplainValue')} />
      </label>
      <label
        className="dt-morefilters-item dt-morefilters-item--select"
        title="Orientation of the hover timing breakdown. Auto picks by panel width — horizontal when wide, vertical when narrow."
      >
        <span className="dt-morefilters-item-label">
          Popover
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallPopoverLayout')} />
        </span>
        <select
          value={waterfallPopoverLayout}
          onChange={(e) =>
            onWaterfallPopoverLayoutChange(e.target.value as DevpanelNetworkWaterfallPopoverLayoutSetting)
          }
        >
          {POPOVER_LAYOUT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFireDots} onChange={onToggleShowFireDots} />
        Show rule-fire dots
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.showFireDots')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        Reset to default
      </button>
    </ToolbarMenuPopover>
  );
}
