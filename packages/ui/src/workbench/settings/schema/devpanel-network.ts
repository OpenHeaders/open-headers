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
  }
}

registerSetting({
  key: 'devpanelNetwork.layout',
  type: 'enum',
  default: 'compact',
  schema: layoutSchema,
  label: 'Network Layout',
  description:
    'How the Network table absorbs horizontal space. Compact lets stretchy columns (Name, Waterfall) flex to fit the panel width so the table never scrolls horizontally; Wide caps those columns and scrolls horizontally for the rest.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'layout', 'compact', 'fit', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'compact', label: 'Compact', description: 'Stretchy columns absorb panel width.' },
    { value: 'wide', label: 'Wide', description: 'Capped widths, scrolls horizontally when needed.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortKind',
  type: 'enum',
  default: 'column',
  schema: sortKindSchema,
  label: 'Network Sort Source',
  description:
    'Which side of the sort state is active. `mode` runs one of the named compound sort modes (Failures first / Slowest first / …). `column` runs the single-column sort the user picked by clicking a column header. The panel switches automatically — clicking a column header sets this to `column`; picking a mode in the View menu sets it to `mode`.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'mode', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'mode', label: 'Mode', description: 'Use a named compound sort mode.' },
    { value: 'column', label: 'Column', description: 'Use the single-column sort the user clicked.' },
    { value: 'customNested', label: 'Custom (nested)', description: 'Use the user-built multi-key sort chain.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortMode',
  type: 'enum',
  default: 'failures',
  schema: sortModeSchema,
  label: 'Network Sort Mode',
  description: 'Named compound sort order — primary axis then arrival as tiebreak. Active when sort source = `mode`.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'mode', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'failures', label: 'Failures first', description: 'Failed → pending → redirected → success.' },
    { value: 'slowest', label: 'Slowest first', description: 'Longest duration first.' },
    { value: 'largest', label: 'Largest first', description: 'Biggest wire bytes first.' },
    { value: 'browserPriority', label: 'Browser priority', description: 'Highest → Lowest reported priority.' },
    { value: 'byType', label: 'By resource type', description: 'Grouped by resource type, arrival within.' },
    { value: 'byDomain', label: 'By domain', description: 'Grouped by hostname, arrival within.' },
    { value: 'ruleModified', label: 'Rule-modified first', description: 'Applied rules first, arrival within.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortBy',
  type: 'enum',
  default: 'waterfall',
  schema: sortBySchema,
  label: 'Network Sort By',
  description:
    'Which column drives the column-click sort. Active when sort source = `column`. Clicking a column header updates this value.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    {
      value: 'waterfall',
      label: 'Waterfall',
      description: 'Timeline by the active Waterfall metric (start time by default).',
    },
    { value: 'requestNumber', label: 'Request #', description: 'Request number — the order requests were discovered.' },
    { value: 'method', label: 'Method', description: 'HTTP method.' },
    { value: 'name', label: 'Name', description: 'Final segment of the URL.' },
    { value: 'path', label: 'Path', description: 'Pathname + query.' },
    { value: 'url', label: 'URL', description: 'Full URL.' },
    { value: 'status', label: 'Status', description: 'Response status code.' },
    { value: 'protocol', label: 'Protocol', description: 'HTTP version.' },
    { value: 'scheme', label: 'Scheme', description: 'http / https.' },
    { value: 'domain', label: 'Domain', description: 'Host portion of the URL.' },
    { value: 'remoteAddress', label: 'Remote address', description: 'Server IP.' },
    { value: 'type', label: 'Type', description: 'Resource type.' },
    { value: 'initiator', label: 'Initiator', description: 'What triggered the request.' },
    { value: 'cookies', label: 'Cookies', description: 'Request-cookie count.' },
    { value: 'setCookies', label: 'Set Cookies', description: 'Response Set-Cookie count.' },
    { value: 'size', label: 'Size', description: 'Wire bytes.' },
    { value: 'time', label: 'Time', description: 'Total request duration.' },
    { value: 'priority', label: 'Priority', description: 'Browser-assigned priority.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.sortDir',
  type: 'enum',
  default: 'asc',
  schema: sortDirSchema,
  label: 'Network Sort Direction',
  description: 'Ascending or descending order for the current Network sort column.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'sort', 'direction', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'asc', label: 'Ascending', description: 'Lowest first.' },
    { value: 'desc', label: 'Descending', description: 'Highest first.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallMetric',
  type: 'enum',
  default: 'startTime',
  schema: waterfallMetricSchema,
  label: 'Waterfall Metric',
  description:
    'Which time the Waterfall column sorts and draws by. Start / Response / End time place bars on an absolute timeline; Total duration and Latency zero-align the bars so lengths compare directly.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'sort', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'startTime', label: 'Start time', description: 'When the request started.' },
    { value: 'responseTime', label: 'Response time', description: 'When the first response byte arrived.' },
    { value: 'endTime', label: 'End time', description: 'When the request finished.' },
    { value: 'duration', label: 'Total duration', description: 'How long the request took end to end.' },
    { value: 'latency', label: 'Latency', description: 'Time to the first response byte.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.showFireDots',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Rule-fire Dots',
  description:
    'Show the leading 14px column carrying the colored dot that marks rule matches (filled = a rule actually applied, hollow = inferred). Turn off to reclaim the horizontal pixels on dense panes.',
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
  label: 'Waterfall Values',
  description:
    'When to print the active Waterfall metric’s value(s) on the bar — the Start / Response / End time chip for the timeline metrics, or the waiting / download labels for Total duration and Latency.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'label', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'always', label: 'Always', description: 'Keep the value chip visible.' },
    { value: 'hover', label: 'On hover', description: 'Reveal the value chip on row hover.' },
    { value: 'off', label: 'Off', description: 'Hide the value chip.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallValueFormat',
  type: 'enum',
  default: 'relative',
  schema: waterfallValueFormatSchema,
  label: 'Waterfall Value Format',
  description:
    'How a timeline metric’s value reads: Relative is the offset from the first request in view; Timestamp is the absolute wall-clock instant. Total duration and Latency are always durations regardless.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'timestamp', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'relative', label: 'Relative', description: 'Offset from the first request in view.' },
    { value: 'timestamp', label: 'Timestamp', description: 'Absolute wall-clock instant.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallTimestampTz',
  type: 'enum',
  default: 'local',
  schema: waterfallTimestampTzSchema,
  label: 'Waterfall Timestamp Timezone',
  description: 'Timezone for the Timestamp value format — local time or UTC.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timestamp', 'timezone', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'local', label: 'Local', description: 'Your local timezone.' },
    { value: 'utc', label: 'UTC', description: 'Coordinated Universal Time.' },
  ],
});

registerSetting({
  key: 'devpanelNetwork.waterfallExplainValue',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Explain Waterfall Value',
  description:
    'In the Waterfall hover popover, badge and highlight the phase rows that make up the total and show their sum as a formula. Purely a visual aid — it changes no values.',
  category: 'devpanelNetwork',
  subcategory: 'View',
  tags: ['network', 'waterfall', 'timing', 'breakdown', 'devtools'],
  scope: 'user',
});
