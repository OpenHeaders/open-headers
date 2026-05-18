/**
 * DevPanel Cookies category — defaults for the Cookies tab inside the
 * browser DevTools panel. Persisted via the shared settings store so
 * preferences carry across panel close/reopen and every request opened
 * in the panel inherits the same defaults.
 *
 * The filter text input is NOT a setting — it's request-specific
 * scratch state owned by each CookiesView instance.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const sortSchema = v.picklist(['original', 'az', 'size', 'expires']);
export type DevpanelCookiesSortSetting = v.InferOutput<typeof sortSchema>;

const expiresFormatSchema = v.picklist(['relative', 'absolute']);
export type DevpanelCookiesExpiresFormatSetting = v.InferOutput<typeof expiresFormatSchema>;

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'devpanelCookies.sortMode': DevpanelCookiesSortSetting;
    'devpanelCookies.expiresFormat': DevpanelCookiesExpiresFormatSetting;
    'devpanelCookies.showInsights': boolean;
    'devpanelCookies.showFilteredOut': boolean;
    'devpanelCookies.decodeValues': boolean;
    'devpanelCookies.problemsOnly': boolean;
    'devpanelCookies.thirdPartyOnly': boolean;
    'devpanelCookies.ruleOnly': boolean;
    'devpanelCookies.groupByRole': boolean;
    'devpanelCookies.showChips': boolean;
  }
}

// ── Sort / format ───────────────────────────────────────────────────

registerSetting({
  key: 'devpanelCookies.sortMode',
  type: 'enum',
  default: 'az',
  schema: sortSchema,
  label: 'Cookies Sort',
  description:
    'Row ordering inside each cookies section. Original preserves the order the server / request used; A → Z sorts by name; Size sorts by serialized cookie size; Expires sorts soonest-expiring first (Session last).',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'sort', 'order', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'original', label: 'Original', description: 'As sent / set.' },
    { value: 'az', label: 'A → Z', description: 'Alphabetical by name.' },
    { value: 'size', label: 'Size', description: 'Largest cookie first.' },
    { value: 'expires', label: 'Expires', description: 'Soonest expiry first.' },
  ],
});

registerSetting({
  key: 'devpanelCookies.expiresFormat',
  type: 'enum',
  default: 'relative',
  schema: expiresFormatSchema,
  label: 'Expires Format',
  description:
    'How cookie expiry is rendered. Relative shows "in 2d", "30s ago", "Session"; Absolute shows the parsed UTC date.',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'expires', 'format', 'devtools'],
  scope: 'user',
  enumOptions: [
    { value: 'relative', label: 'Relative', description: 'in 2d / 30s ago / Session.' },
    { value: 'absolute', label: 'Absolute', description: 'UTC date.' },
  ],
});

registerSetting({
  key: 'devpanelCookies.showChips',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Tags',
  description:
    'Show the role / lifecycle / context tags next to each cookie name (auth? / tracking? / pref / just set / dropped / 3rd-party / partitioned / …). Turn off for a tight, columns-only view.',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'tags', 'chips', 'view', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.showInsights',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Show Suggestions',
  description:
    'Display the actionable warning cards at the top of the Cookies tab (SameSite=None without Secure, __Host- / __Secure- prefix violations, oversized cookies, expired-but-sent, …).',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'insights', 'suggestions', 'warnings', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.decodeValues',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Decode URL-encoded Values',
  description:
    'Show cookie values with percent-encoding decoded ("Europe%2FMadrid" → "Europe/Madrid"). Hover the value to see the raw form.',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'decode', 'url-encoding', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.groupByRole',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Group by Role',
  description:
    'Group cookies by their inferred role inside each section — Auth & session first, then Functional, Preferences, Analytics & tracking. Heuristic-driven; the role chips (auth? / tracking? / pref) carry the question mark as a reminder.',
  category: 'devpanelCookies',
  subcategory: 'View',
  tags: ['cookies', 'group', 'role', 'auth', 'tracking', 'devtools'],
  scope: 'user',
});

// ── Filter defaults ─────────────────────────────────────────────────

registerSetting({
  key: 'devpanelCookies.showFilteredOut',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Show Filtered-out Request Cookies',
  description:
    'Mirror Chrome\'s "show filtered out request cookies" toggle — also list jar cookies that were not sent on this request because of path / Secure / SameSite / expiry mismatch.',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'filtered-out', 'jar', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.problemsOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Problems Only',
  description: 'Show only cookies that triggered a warning — missing Secure, prefix violation, expired-but-sent, …',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'problems', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.thirdPartyOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: '3rd-party Only',
  description: 'Show only cookies whose domain is cross-site to the top-frame origin.',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'third-party', 'filter', 'devtools'],
  scope: 'user',
});

registerSetting({
  key: 'devpanelCookies.ruleOnly',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Rule-modified Only',
  description: 'Show only cookies whose Cookie / Set-Cookie line was added, modified, or removed by a rule.',
  category: 'devpanelCookies',
  subcategory: 'Filters',
  tags: ['cookies', 'rule', 'filter', 'devtools'],
  scope: 'user',
});
