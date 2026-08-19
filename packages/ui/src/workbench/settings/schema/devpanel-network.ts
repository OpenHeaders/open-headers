/**
 * DevPanel Network category — defaults for the Network requests table
 * inside the browser DevTools panel. Persisted via the shared settings
 * store so preferences carry across panel close/reopen.
 *
 * The filter text input, resource-type filter, column visibility, and
 * per-session column widths are NOT settings — they're request-list
 * scratch state owned by each TrafficList instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const layoutSchema = v.picklist(['wide', 'compact']);
export type DevpanelNetworkLayoutSetting = v.InferOutput<typeof layoutSchema>;

const sortKindSchema = v.picklist(['mode', 'column', 'customNested']);
export type DevpanelNetworkSortKindSetting = v.InferOutput<typeof sortKindSchema>;

const sortModeSchema = v.picklist([
  'failures',
  'slowest',
  'largest',
  'browserPriority',
  'byType',
  'byDomain',
  'ruleModified',
]);
export type DevpanelNetworkSortModeSetting = v.InferOutput<typeof sortModeSchema>;

const sortBySchema = v.picklist([
  'requestNumber',
  'method',
  'name',
  'path',
  'url',
  'status',
  'protocol',
  'scheme',
  'domain',
  'remoteAddress',
  'type',
  'initiator',
  'cookies',
  'setCookies',
  'size',
  'time',
  'priority',
  'waterfall',
]);
export type DevpanelNetworkSortBySetting = v.InferOutput<typeof sortBySchema>;

const sortDirSchema = v.picklist(['asc', 'desc']);
export type DevpanelNetworkSortDirSetting = v.InferOutput<typeof sortDirSchema>;

/**
 * Waterfall sub-metric. The Waterfall column is overloaded: one column,
 * five time keys it can sort and visualize by. `startTime` / `responseTime`
 * / `endTime` lay bars on an absolute timeline; `duration` / `latency`
 * zero-align the bars so durations compare directly. The column header
 * surfaces the active metric — `Waterfall (Start time)` — so the axis is
 * never ambiguous.
 */
const waterfallMetricSchema = v.picklist(['startTime', 'responseTime', 'endTime', 'duration', 'latency']);
export type DevpanelNetworkWaterfallMetricSetting = v.InferOutput<typeof waterfallMetricSchema>;

/**
 * When the active Waterfall metric's value shows on the bar — `always` pins it,
 * `hover` reveals it on row hover, `off` hides it. Governs both the timeline
 * metric chip (Start / Response / End time) and the Total duration / Latency
 * waiting + download labels.
 */
const waterfallValuesSchema = v.picklist(['off', 'always', 'hover']);
export type DevpanelNetworkWaterfallValuesSetting = v.InferOutput<typeof waterfallValuesSchema>;

/**
 * How a timeline metric's value chip reads: `relative` is the offset from the
 * first request in view (the timeline zero); `timestamp` is the absolute
 * wall-clock instant. Durations (Total duration / Latency) ignore this — they
 * are always durations.
 */
const waterfallValueFormatSchema = v.picklist(['relative', 'timestamp']);
export type DevpanelNetworkWaterfallValueFormatSetting = v.InferOutput<typeof waterfallValueFormatSchema>;

/** Timezone for the `timestamp` value format. */
const waterfallTimestampTzSchema = v.picklist(['local', 'utc']);
export type DevpanelNetworkWaterfallTimestampTzSetting = v.InferOutput<typeof waterfallTimestampTzSchema>;

/**
 * Orientation of the Waterfall hover timing-ladder popover. `vertical` stacks
 * the rungs down the popover; `horizontal` lays the same ladder on the X axis
 * (better for a wide panel); `auto` picks by panel width — horizontal when the
 * panel is wide (docked along the bottom), vertical when narrow (docked to a
 * side). Both orientations render the identical ladder, so they never disagree.
 */
const waterfallPopoverLayoutSchema = v.picklist(['vertical', 'horizontal', 'auto']);
export type DevpanelNetworkWaterfallPopoverLayoutSetting = v.InferOutput<typeof waterfallPopoverLayoutSchema>;

/**
 * The Custom (nested) sort level list is NOT persisted via the
 * settings registry — the registry's value layer is typed-scalar, not
 * arbitrary JSON. The list lives in TrafficList's local state alongside
 * the per-session column widths, matching the same "session-scoped
 * scratch" pattern. If we later want it durable, switch to a
 * JSON-serialized `string` setting + parse/validate at boundaries.
 */
export interface NetworkCustomNestedLevel {
  key: DevpanelNetworkSortBySetting;
  dir: DevpanelNetworkSortDirSetting;
}

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelNetwork.layout': DevpanelNetworkLayoutSetting;
    'devpanelNetwork.messagesLayout': DevpanelNetworkLayoutSetting;
    'devpanelNetwork.messagesShowPreview': boolean;
    'devpanelNetwork.sortKind': DevpanelNetworkSortKindSetting;
    'devpanelNetwork.sortMode': DevpanelNetworkSortModeSetting;
    'devpanelNetwork.sortBy': DevpanelNetworkSortBySetting;
    'devpanelNetwork.sortDir': DevpanelNetworkSortDirSetting;
    'devpanelNetwork.waterfallMetric': DevpanelNetworkWaterfallMetricSetting;
    'devpanelNetwork.showFireDots': boolean;
    'devpanelNetwork.waterfallValues': DevpanelNetworkWaterfallValuesSetting;
    'devpanelNetwork.waterfallValueFormat': DevpanelNetworkWaterfallValueFormatSetting;
    'devpanelNetwork.waterfallTimestampTz': DevpanelNetworkWaterfallTimestampTzSetting;
    'devpanelNetwork.waterfallExplainValue': boolean;
    'devpanelNetwork.waterfallPopoverLayout': DevpanelNetworkWaterfallPopoverLayoutSetting;
  }
}

registerSetting({
  key: 'devpanelNetwork.layout',
  type: 'enum',
  default: 'compact',
  schema: layoutSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.layout.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.layout.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'layout', 'compact', 'fit', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'compact',
      labelKey: 'workbench.settings.def.devpanelNetwork.layout.option.compact.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.layout.option.compact.description',
    },
    {
      value: 'wide',
      labelKey: 'workbench.settings.def.devpanelNetwork.layout.option.wide.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.layout.option.wide.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.messagesLayout',
  type: 'enum',
  default: 'compact',
  schema: layoutSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['messages', 'websocket', 'layout', 'compact', 'fit', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'compact',
      labelKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description',
    },
    {
      value: 'wide',
      labelKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.messagesShowPreview',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelNetwork.messagesShowPreview.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.messagesShowPreview.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['messages', 'websocket', 'sse', 'preview', 'payload', 'split', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelNetwork.sortKind',
  type: 'enum',
  default: 'column',
  schema: sortKindSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.sortKind.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.sortKind.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'mode', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'mode',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description',
    },
    {
      value: 'column',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.column.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.column.description',
    },
    {
      value: 'customNested',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortMode',
  type: 'enum',
  default: 'failures',
  schema: sortModeSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'mode', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'failures',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description',
    },
    {
      value: 'slowest',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description',
    },
    {
      value: 'largest',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description',
    },
    {
      value: 'browserPriority',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description',
    },
    {
      value: 'byType',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description',
    },
    {
      value: 'byDomain',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description',
    },
    {
      value: 'ruleModified',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortBy',
  type: 'enum',
  default: 'waterfall',
  schema: sortBySchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'waterfall',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description',
    },
    {
      value: 'requestNumber',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description',
    },
    {
      value: 'method',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.method.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.method.description',
    },
    {
      value: 'name',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.name.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.name.description',
    },
    {
      value: 'path',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.path.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.path.description',
    },
    {
      value: 'url',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.url.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.url.description',
    },
    {
      value: 'status',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.status.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.status.description',
    },
    {
      value: 'protocol',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description',
    },
    {
      value: 'scheme',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description',
    },
    {
      value: 'domain',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description',
    },
    {
      value: 'remoteAddress',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description',
    },
    {
      value: 'type',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.type.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.type.description',
    },
    {
      value: 'initiator',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description',
    },
    {
      value: 'cookies',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description',
    },
    {
      value: 'setCookies',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description',
    },
    {
      value: 'size',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.size.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.size.description',
    },
    {
      value: 'time',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.time.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.time.description',
    },
    {
      value: 'priority',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortDir',
  type: 'enum',
  default: 'asc',
  schema: sortDirSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.sortDir.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.sortDir.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'direction', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'asc',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description',
    },
    {
      value: 'desc',
      labelKey: 'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallMetric',
  type: 'enum',
  default: 'startTime',
  schema: waterfallMetricSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'sort', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'startTime',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description',
    },
    {
      value: 'responseTime',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description',
    },
    {
      value: 'endTime',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description',
    },
    {
      value: 'duration',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description',
    },
    {
      value: 'latency',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.showFireDots',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelNetwork.showFireDots.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.showFireDots.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'rules', 'dot', 'indicator', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelNetwork.waterfallValues',
  type: 'enum',
  default: 'always',
  schema: waterfallValuesSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'label', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'always',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description',
    },
    {
      value: 'hover',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description',
    },
    {
      value: 'off',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallValueFormat',
  type: 'enum',
  default: 'relative',
  schema: waterfallValueFormatSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'timestamp', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'relative',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description',
    },
    {
      value: 'timestamp',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallTimestampTz',
  type: 'enum',
  default: 'local',
  schema: waterfallTimestampTzSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timestamp', 'timezone', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'local',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description',
    },
    {
      value: 'utc',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description',
    },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallExplainValue',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'breakdown', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelNetwork.waterfallPopoverLayout',
  type: 'enum',
  default: 'vertical',
  schema: waterfallPopoverLayoutSchema,
  labelKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label',
  descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'popover', 'layout', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'vertical',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description',
    },
    {
      value: 'horizontal',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description',
    },
    {
      value: 'auto',
      labelKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label',
      descriptionKey: 'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description',
    },
  ],
});
