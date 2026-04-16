/**
 * Rules Engine category — behavior of the background rule engine that
 * compiles rules into declarativeNetRequest entries and arbitrates
 * shadowed matches.
 */

import { DRAFT_URL_STRATEGIES, type DraftUrlStrategy } from '@openheaders/core/utils';
import * as v from 'valibot';
import { registerSetting } from '../registry';

const evaluationStrategySchema = v.picklist(['first-match', 'closest-match', 'all-matching']);
const draftUrlStrategySchema = v.picklist(DRAFT_URL_STRATEGIES);

const resourceTypeSchema = v.picklist([
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'ping',
  'other',
]);

export type EvaluationStrategy = v.InferOutput<typeof evaluationStrategySchema>;
export type TrackedResourceType = v.InferOutput<typeof resourceTypeSchema>;

/**
 * Default is every resource type — the engine collects everything
 * universally, and this setting is a *display* filter that narrows
 * what the "This Page" popup shows. Users who only care about XHR
 * can narrow here without losing collection data.
 */
const DEFAULT_VISIBLE_RESOURCE_TYPES: readonly TrackedResourceType[] = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'ping',
  'other',
];

declare module '../types' {
  interface SettingsMap {
    'rulesEngine.paused': boolean;
    'rulesEngine.evaluationStrategy': EvaluationStrategy;
    'rulesEngine.updateDebounceMs': number;
    'rulesEngine.maxActiveRules': number;
    'rulesEngine.visibleResourceTypes': readonly TrackedResourceType[];
    'rulesEngine.showShadowWarnings': boolean;
    'rulesEngine.warnOnLargeRuleSets': boolean;
    'rulesEngine.largeRuleSetThreshold': number;
    'rulesEngine.draftUrlStrategy': DraftUrlStrategy;
  }
}

registerSetting({
  key: 'rulesEngine.paused',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Pause Rule Execution',
  description: 'Stop applying rules to live network requests. Rules remain editable.',
  category: 'rulesEngine',
  tags: ['pause', 'disable', 'kill switch', 'global'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.evaluationStrategy',
  type: 'enum',
  default: 'closest-match',
  schema: evaluationStrategySchema,
  label: 'Evaluation Strategy',
  description: 'How the engine chooses between rules when several match the same request.',
  category: 'rulesEngine',
  tags: ['match', 'priority', 'arbitration'],
  scope: 'user',
  enumOptions: [
    { value: 'first-match', label: 'First match', description: 'Use the first rule in priority order' },
    {
      value: 'closest-match',
      label: 'Closest match',
      description: 'Prefer the most specific matching rule',
    },
    { value: 'all-matching', label: 'All matching', description: 'Apply every matching rule in order' },
  ],
});

registerSetting({
  key: 'rulesEngine.updateDebounceMs',
  type: 'number',
  default: 150,
  schema: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2000)),
  label: 'Update Debounce',
  description: 'Delay (ms) before rule edits are pushed to declarativeNetRequest.',
  category: 'rulesEngine',
  tags: ['debounce', 'update', 'performance'],
  scope: 'user',
  numberRange: { min: 0, max: 2000, step: 10 },
});

registerSetting({
  key: 'rulesEngine.maxActiveRules',
  type: 'number',
  default: 5000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(30000)),
  label: 'Max Active Rules',
  description: 'Maximum number of rules compiled into the dynamic rule set at once.',
  category: 'rulesEngine',
  tags: ['limit', 'dnr', 'capacity'],
  scope: 'user',
  numberRange: { min: 100, max: 30000, step: 100 },
});

registerSetting({
  key: 'rulesEngine.visibleResourceTypes',
  type: 'multi-select',
  default: DEFAULT_VISIBLE_RESOURCE_TYPES,
  schema: v.array(resourceTypeSchema),
  label: 'Visible Resource Types',
  description:
    "Which request resource types appear in the popup's This Page view. Everything is always collected; this only changes what the UI shows. The inline chip row on the popup writes to the same setting.",
  category: 'rulesEngine',
  tags: ['resource', 'filter', 'popup', 'visible', 'display'],
  scope: 'user',
  enumOptions: [
    { value: 'main_frame', label: 'Main frame' },
    { value: 'sub_frame', label: 'Sub frame' },
    { value: 'xmlhttprequest', label: 'XHR / fetch' },
    { value: 'script', label: 'Scripts' },
    { value: 'stylesheet', label: 'Stylesheets' },
    { value: 'image', label: 'Images' },
    { value: 'font', label: 'Fonts' },
    { value: 'media', label: 'Media' },
    { value: 'websocket', label: 'WebSockets' },
    { value: 'ping', label: 'Beacons / ping' },
    { value: 'other', label: 'Other' },
  ],
});

registerSetting({
  key: 'rulesEngine.showShadowWarnings',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Show Shadow Warnings',
  description:
    'Highlight rules whose effect is shadowed by a higher-priority rule (block, redirect, mock, delay, or header stacking conflict).',
  category: 'rulesEngine',
  tags: ['shadow', 'conflict', 'priority', 'warning'],
  scope: 'user',
  experimental: true,
});

registerSetting({
  key: 'rulesEngine.warnOnLargeRuleSets',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Warn On Large Rule Sets',
  description: 'Surface a warning when the active rule count nears the browser cap.',
  category: 'rulesEngine',
  tags: ['warning', 'dnr', 'limit'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.largeRuleSetThreshold',
  type: 'number',
  default: 4000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(30000)),
  label: 'Large Rule Set Threshold',
  description: 'Active rule count at which the warning fires.',
  category: 'rulesEngine',
  tags: ['warning', 'threshold', 'dnr'],
  scope: 'user',
  numberRange: { min: 100, max: 30000, step: 100 },
  when: (get) => get('rulesEngine.warnOnLargeRuleSets'),
});

registerSetting({
  key: 'rulesEngine.draftUrlStrategy',
  type: 'enum',
  default: 'path-wildcard',
  schema: draftUrlStrategySchema,
  label: 'Draft URL Strategy',
  description:
    'How pre-filled rules from the DevTools Inspector turn a captured URL into a url-filter pattern. Path wildcard (default) replaces the last path segment with * so sibling resources match. Host-only widens to the whole domain. Exact/raw keep the URL verbatim.',
  category: 'rulesEngine',
  tags: ['draft', 'devtools', 'inspector', 'url', 'pattern'],
  scope: 'user',
  enumOptions: [
    { value: 'path-wildcard', label: 'Path wildcard', description: 'Wildcard the last path segment (recommended)' },
    { value: 'host-only', label: 'Host only', description: 'Match every request on the host' },
    { value: 'exact', label: 'Exact URL', description: 'Match this URL verbatim (normalized)' },
    { value: 'raw', label: 'Raw URL', description: 'Match this URL verbatim without normalization' },
  ],
});
