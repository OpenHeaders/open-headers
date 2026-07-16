import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
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
const WATERFALL_VALUES_OPTIONS: ReadonlyArray<{
  value: DevpanelNetworkWaterfallValuesSetting;
  labelKey: MessageKey;
}> = [
  { value: 'always', labelKey: 'panel.network.view.valuesAlways' },
  { value: 'hover', labelKey: 'panel.network.view.valuesHover' },
  { value: 'off', labelKey: 'panel.network.view.valuesOff' },
];
const VALUE_FORMAT_OPTIONS: ReadonlyArray<{
  value: DevpanelNetworkWaterfallValueFormatSetting;
  labelKey: MessageKey;
}> = [
  { value: 'relative', labelKey: 'panel.network.view.formatRelative' },
  { value: 'timestamp', labelKey: 'panel.network.view.formatTimestamp' },
];
const TIMESTAMP_TZ_OPTIONS: ReadonlyArray<{
  value: DevpanelNetworkWaterfallTimestampTzSetting;
  labelKey: MessageKey;
}> = [
  { value: 'local', labelKey: 'panel.network.view.tzLocal' },
  { value: 'utc', labelKey: 'panel.network.view.tzUtc' },
];
const POPOVER_LAYOUT_OPTIONS: ReadonlyArray<{
  value: DevpanelNetworkWaterfallPopoverLayoutSetting;
  labelKey: MessageKey;
}> = [
  { value: 'auto', labelKey: 'panel.network.view.popoverAuto' },
  { value: 'vertical', labelKey: 'panel.network.view.popoverCompact' },
  { value: 'horizontal', labelKey: 'panel.network.view.popoverWide' },
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
  const t = useT();
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover
      label={t('panel.network.view.label')}
      activeCount={activeCount}
      menuClassName="dt-network-view-menu"
    >
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.network.view.layout')}
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.layout')} />
        </span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as DevpanelNetworkLayoutSetting)}>
          <option value="compact">{t('panel.network.view.layoutCompact')}</option>
          <option value="wide">{t('panel.network.view.layoutWide')}</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      {/* Parity vocabulary — the Waterfall column name stays raw (I18N_PLAN §3). */}
      <div className="dt-sortmode-heading">Waterfall</div>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.network.view.valueNumber')}
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
          {t('panel.network.view.showValue')}
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallValues')} />
        </span>
        <select
          value={waterfallValues}
          onChange={(e) => onWaterfallValuesChange(e.target.value as DevpanelNetworkWaterfallValuesSetting)}
        >
          {WATERFALL_VALUES_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">
          {t('panel.network.view.valueFormat')}
          <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallValueFormat')} />
        </span>
        <select
          value={waterfallValueFormat}
          onChange={(e) => onWaterfallValueFormatChange(e.target.value as DevpanelNetworkWaterfallValueFormatSetting)}
        >
          {VALUE_FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </label>
      {waterfallValueFormat === 'timestamp' && (
        <label className="dt-morefilters-item dt-morefilters-item--select">
          <span className="dt-morefilters-item-label">{t('panel.network.view.timezone')}</span>
          <select
            value={waterfallTimestampTz}
            onChange={(e) => onWaterfallTimestampTzChange(e.target.value as DevpanelNetworkWaterfallTimestampTzSetting)}
          >
            {TIMESTAMP_TZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="dt-morefilters-item" title={t('panel.network.view.explainValueTitle')}>
        <input type="checkbox" checked={waterfallExplainValue} onChange={onToggleExplainValue} />
        {t('panel.network.view.explainValue')}
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.waterfallExplainValue')} />
      </label>
      <label
        className="dt-morefilters-item dt-morefilters-item--select"
        title={t('panel.network.view.popoverTitle')}
      >
        <span className="dt-morefilters-item-label">
          {t('panel.network.view.popover')}
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
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFireDots} onChange={onToggleShowFireDots} />
        {t('panel.network.view.showFireDots')}
        <MenuNonDefaultDot show={modified.has('devpanelNetwork.showFireDots')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}
