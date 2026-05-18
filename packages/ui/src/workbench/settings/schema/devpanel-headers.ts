/**
 * DevPanel Headers category — defaults for the Headers tab inside the
 * browser DevTools panel. Persisted via the shared settings store so
 * preferences carry across panel close/reopen and every request opened
 * in the panel inherits the same defaults (Chrome Network's pattern).
 *
 * The filter text input is deliberately NOT a setting — it's request-
 * specific scratch state owned by each `HeadersView` instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const layoutSchema = v.picklist(['grouped', 'flat']);
export type DevpanelHeadersLayoutSetting = v.InferOutput<typeof layoutSchema>;

const sortSchema = v.picklist(['original', 'az', 'rule-first']);
export type DevpanelHeadersSortSetting = v.InferOutput<typeof sortSchema>;

const nameCaseSchema = v.picklist(['train', 'original']);
export type DevpanelHeadersNameCaseSetting = v.InferOutput<typeof nameCaseSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelHeaders.layout': DevpanelHeadersLayoutSetting;
    'devpanelHeaders.sortMode': DevpanelHeadersSortSetting;
    'devpanelHeaders.nameCase': DevpanelHeadersNameCaseSetting;
    'devpanelHeaders.showInsights': boolean;
    'devpanelHeaders.hideNoise': boolean;
    'devpanelHeaders.ruleOnly': boolean;
    'devpanelHeaders.securityOnly': boolean;
    'devpanelHeaders.overridableOnly': boolean;
    'devpanelHeaders.showChips': boolean;
  }
}

// ── Layout / sort ────────────────────────────────────────────────────

registerSetting({
  key: 'devpanelHeaders.layout',
  type: 'enum',
  default: 'grouped',
  schema: layoutSchema,
  label: 'Headers Layout',
  description:
    'How header rows are organised inside Request/Response sections. Grouped buckets rows by category (Auth, CORS, Caching, …); Flat renders one list in the chosen sort order.',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'layout', 'grouped', 'flat', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'grouped', label: 'Grouped', description: 'Rows bucketed by category.' },
    { value: 'flat', label: 'Flat', description: 'Single list, no category headings (Chrome-style).' },
  ],
});

registerSetting({
  key: 'devpanelHeaders.sortMode',
  type: 'enum',
  default: 'original',
  schema: sortSchema,
  label: 'Headers Sort',
  description:
    'Row ordering within each list (and within each group, when grouped). Original preserves the order the server sent the headers (HAR order); A → Z sorts by name; Rule-modified first floats rule-modified rows to the top.',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'original', label: 'Original', description: 'HAR order.' },
    { value: 'az', label: 'A → Z', description: 'Alphabetical.' },
    { value: 'rule-first', label: 'Rule-modified first', description: 'Rule-modified rows on top.' },
  ],
});

registerSetting({
  key: 'devpanelHeaders.nameCase',
  type: 'enum',
  default: 'train',
  schema: nameCaseSchema,
  label: 'Header Name Case',
  description:
    'How header names are displayed. Train-Case canonicalises every name (`Content-Type`, `Set-Cookie`, `ETag`) to match Chrome/Firefox DevTools — easier to scan. Original keeps the raw casing the server sent (HTTP/2+ lowercases everything on the wire).',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'case', 'train-case', 'display', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'train', label: 'Train-Case', description: 'Content-Type, Set-Cookie, ETag (Chrome-style).' },
    { value: 'original', label: 'Original', description: 'Exactly what the server sent (often lowercase on HTTP/2+).' },
  ],
});

registerSetting({
  key: 'devpanelHeaders.showChips',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Value Tags',
  description:
    'Show the per-value tags on header rows (Cache-Control / Set-Cookie / HSTS / JWT decode, …). Turn off for a tight, value-only view.',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'tags', 'chips', 'view', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.showInsights',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Suggestions',
  description:
    'Display the actionable warning cards at the top of the Headers tab (CORS misconfigs, missing CSP/HSTS, insecure cookies, expired JWT, …).',
  category: 'devpanelHeaders',
  subcategory: 'View',
  tags: ['headers', 'insights', 'suggestions', 'warnings', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ─────────────────────────────────────────────────

registerSetting({
  key: 'devpanelHeaders.hideNoise',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Hide Noise Headers',
  description:
    'Fold low-signal headers (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). The hint below each section lists the hidden names on hover.',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'noise', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.ruleOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Rule-modified Only',
  description: 'Show only headers added, modified, or removed by an Open Headers rule.',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'rule', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.securityOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Security Headers Only',
  description: 'Show only security-related headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'security', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelHeaders.overridableOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Overridable Headers Only',
  description: 'Hide protected headers the browser will not let rules override (host, content-length, sec-ch-ua, …).',
  category: 'devpanelHeaders',
  subcategory: 'Filters',
  tags: ['headers', 'overridable', 'protected', 'filter', 'devtools'],
  scope: 'user',
});
