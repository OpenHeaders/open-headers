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

declare module '@openheaders/ui/workbench/settings/types' {
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
    'rulesEngine.liveRulesMode': boolean;
    'rulesEngine.bypassHttpCache': boolean;
    'rulesEngine.variableAutocomplete': boolean;
  }
}

registerSetting({
  key: 'rulesEngine.paused',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.rulesEngine.paused.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.paused.description',
  category: 'rulesEngine',
  tags: ['pause', 'disable', 'kill switch', 'global'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.evaluationStrategy',
  type: 'enum',
  default: 'closest-match',
  schema: evaluationStrategySchema,
  labelKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.description',
  category: 'rulesEngine',
  tags: ['match', 'priority', 'arbitration'],
  scope: 'user',
  enumOptions: [
    {
      value: 'first-match',
      labelKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description',
    },
    {
      value: 'closest-match',
      labelKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description',
    },
    {
      value: 'all-matching',
      labelKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description',
    },
  ],
});

registerSetting({
  key: 'rulesEngine.updateDebounceMs',
  type: 'number',
  default: 150,
  schema: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2000)),
  labelKey: 'workbench.settings.def.rulesEngine.updateDebounceMs.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.updateDebounceMs.description',
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
  labelKey: 'workbench.settings.def.rulesEngine.maxActiveRules.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.maxActiveRules.description',
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
  labelKey: 'workbench.settings.def.rulesEngine.visibleResourceTypes.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.visibleResourceTypes.description',
  category: 'rulesEngine',
  tags: ['resource', 'filter', 'popup', 'visible', 'display'],
  scope: 'user',
  // Option labels are DevTools Type-column parity vocabulary — they
  // stay English (plan §3), matching the popup's resource-type tags.
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
  labelKey: 'workbench.settings.def.rulesEngine.showShadowWarnings.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.showShadowWarnings.description',
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
  labelKey: 'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description',
  category: 'rulesEngine',
  tags: ['warning', 'dnr', 'limit'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.largeRuleSetThreshold',
  type: 'number',
  default: 4000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(30000)),
  labelKey: 'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description',
  category: 'rulesEngine',
  tags: ['warning', 'threshold', 'dnr'],
  scope: 'user',
  numberRange: { min: 100, max: 30000, step: 100 },
  when: (get) => get('rulesEngine.warnOnLargeRuleSets'),
});

registerSetting({
  key: 'rulesEngine.liveRulesMode',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.rulesEngine.liveRulesMode.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.liveRulesMode.description',
  category: 'rulesEngine',
  tags: ['cache', 'freshness', 'no-cache', 'live', 'token'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.bypassHttpCache',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.rulesEngine.bypassHttpCache.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.bypassHttpCache.description',
  category: 'rulesEngine',
  tags: ['cache', 'bypass', 'devtools', 'http', 'debugging'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.variableAutocomplete',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.rulesEngine.variableAutocomplete.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.variableAutocomplete.description',
  category: 'rulesEngine',
  tags: ['autocomplete', 'variables', 'suggestions', 'template', 'picker'],
  scope: 'user',
});

registerSetting({
  key: 'rulesEngine.draftUrlStrategy',
  type: 'enum',
  default: 'exact',
  schema: draftUrlStrategySchema,
  labelKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.label',
  descriptionKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.description',
  category: 'rulesEngine',
  tags: ['draft', 'devtools', 'inspector', 'url', 'pattern'],
  scope: 'user',
  enumOptions: [
    {
      value: 'exact',
      labelKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description',
    },
    {
      value: 'path-wildcard',
      labelKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description',
    },
    {
      value: 'host-only',
      labelKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description',
    },
    {
      value: 'raw',
      labelKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label',
      descriptionKey: 'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description',
    },
  ],
});
