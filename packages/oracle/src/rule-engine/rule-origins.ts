/**
 * Rule origin extraction — pure function from Rule to the set of
 * origins its URL patterns cover.
 *
 * Used by the rule-state observer to compute the scope of cache
 * eviction when a rule transitions state (enabled ↔ disabled, paused
 * ↔ unpaused, added, deleted, edited). The origin strings it emits
 * conform to `chrome.browsingData.remove({ origins: [...] })` semantics:
 * scheme + host [+ optional port], no path, no trailing slash.
 *
 * Unlike `@openheaders/core/utils/getRuleMatchPatterns`, which just
 * lists the patterns, this module interprets them: walks each pattern,
 * peels off the host and scheme, and emits concrete origin strings
 * that `browsingData.remove` will accept.
 *
 * Patterns that can't be reduced to a finite origin set — wildcard
 * subdomains, wildcard hosts, regex patterns whose host isn't a
 * trivial literal — return `broad: true` so the caller falls back to
 * a global cache wipe instead of emitting a malformed origin list.
 */

import type { Rule } from '@openheaders/core/types';
import { getRuleMatchPatterns } from '@openheaders/core/utils';

export interface RuleOriginSet {
  /**
   * Concrete origins this rule covers. Ready to pass to
   * `chrome.browsingData.remove({ origins })`. Deduplicated.
   */
  origins: string[];
  /**
   * True when at least one of the rule's patterns couldn't be reduced
   * to a finite origin set — caller should treat this rule as "broad"
   * and fall back to a global cache wipe covering every origin.
   */
  broad: boolean;
}

const EMPTY: RuleOriginSet = { origins: [], broad: false };

/**
 * Extract the origin set from a single rule's URL conditions.
 *
 *   - Rules with no URL conditions → `{ origins: [], broad: false }`.
 *     Caller decides whether that means "affects no cache" or
 *     "affects everything" — for cache eviction both readings are
 *     safe: if the rule has no URL scope, no cache is stale.
 *
 *   - A pattern like `*://api.example.com/*` → emits `http://api.example.com`
 *     and `https://api.example.com`.
 *
 *   - A pattern like `https://api.example.com:8443/*` → emits
 *     `https://api.example.com:8443` (scheme + port preserved).
 *
 *   - A pattern with a wildcard subdomain (`*://*.example.com/*`) can't
 *     be expanded without enumerating every subdomain the page ever
 *     loaded; sets `broad: true` so the caller does a global wipe.
 *
 *   - A `url-regex` pattern: tried for a trivial literal host prefix
 *     (anchored regex whose first component is a bare host); anything
 *     more complex sets `broad: true`.
 */
export function extractRuleOrigins(rule: Rule): RuleOriginSet {
  const patterns = getRuleMatchPatterns(rule);
  if (patterns.length === 0) return EMPTY;

  const origins = new Set<string>();
  let broad = false;

  for (const entry of patterns) {
    if (entry.kind === 'url-regex') {
      const extracted = originFromRegexSource(entry.pattern);
      if (extracted === 'broad') {
        broad = true;
      } else {
        for (const origin of extracted) origins.add(origin);
      }
      continue;
    }
    // url-filter kind.
    const extracted = originsFromUrlFilter(entry.pattern);
    if (extracted === 'broad') {
      broad = true;
    } else {
      for (const origin of extracted) origins.add(origin);
    }
  }

  return { origins: [...origins], broad };
}

/**
 * Batch form. Aggregates origins across a list of rules. A single rule
 * flagged `broad` makes the whole set broad; the caller should treat
 * that as "wipe the HTTP cache globally."
 */
export function extractOriginsFromRules(rules: readonly Rule[]): RuleOriginSet {
  const origins = new Set<string>();
  let broad = false;
  for (const rule of rules) {
    const extracted = extractRuleOrigins(rule);
    if (extracted.broad) broad = true;
    for (const origin of extracted.origins) origins.add(origin);
  }
  return { origins: [...origins], broad };
}

// ── url-filter origin extraction ─────────────────────────────────

/**
 * Parse a `urlFilter` pattern (Chrome MV3 DNR form) and return the set
 * of origin strings it covers. Returns `'broad'` when the pattern is
 * too permissive to enumerate.
 *
 * Recognized shapes (after `formatUrlPattern` normalization has already
 * run):
 *
 *   `*`                          — match-all, broad.
 *   `*://host[:port]/...`        — both http and https variants.
 *   `https://host[:port]/...`    — single scheme.
 *   `http://host[:port]/...`     — single scheme.
 *   wildcard-subdomain form     — broad.
 *   wildcard-host form           — broad.
 *
 * Path / query parts are ignored — origin is scheme + host[:port] only.
 */
export function originsFromUrlFilter(pattern: string): string[] | 'broad' {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed === '*') return 'broad';

  // Split scheme :// rest. Accept *, http, https, or anything else with ://.
  const schemeIdx = trimmed.indexOf('://');
  if (schemeIdx < 0) return 'broad';

  const schemePart = trimmed.substring(0, schemeIdx);
  const afterScheme = trimmed.substring(schemeIdx + 3);

  // Take up to the first `/` or `?` as the authority.
  const authorityEnd = afterScheme.search(/[/?]/);
  const authority = authorityEnd >= 0 ? afterScheme.substring(0, authorityEnd) : afterScheme;

  if (!authority) return 'broad';
  if (authority === '*' || authority.startsWith('*.')) return 'broad';
  if (authority.includes('*')) return 'broad';

  // Port is allowed (numeric after the last colon). Host must otherwise
  // be a bare dotted name or IP.
  if (!isPlausibleHost(authority)) return 'broad';

  const schemes = schemePart === '*' ? ['http', 'https'] : [schemePart];
  return schemes.map((s) => `${s}://${authority}`);
}

// ── url-regex origin extraction ──────────────────────────────────

// Match ONLY simple anchored regexes of the form
//    ^https?://host[:port][/...]
//    ^https://host[:port][/...]
//    ^http://host[:port][/...]
// where host is a literal (escaped dots allowed, slashes NOT escaped —
// users who escape their slashes fall into the broad-wipe branch, which
// is the safe over-eviction default).
const REGEX_ORIGIN_RE = /^\^(https\?|http|https):\/\/([A-Za-z0-9\\.-]+?(?::\d+)?)(?:\/|$)/;

function originFromRegexSource(source: string): string[] | 'broad' {
  const m = source.match(REGEX_ORIGIN_RE);
  if (!m) return 'broad';
  const schemePart = m[1]!;
  const hostEscaped = m[2]!;
  const host = hostEscaped.replace(/\\\./g, '.');
  if (!isPlausibleHost(host)) return 'broad';
  const schemes = schemePart === 'https?' ? ['http', 'https'] : [schemePart];
  return schemes.map((s) => `${s}://${host}`);
}

// ── Host sanity check ────────────────────────────────────────────

/**
 * True when `host` looks like a literal hostname or IP with an optional
 * port — the shape `chrome.browsingData.remove({ origins })` accepts.
 * Rejects wildcards, empty strings, and anything containing characters
 * that have no business in an origin.
 */
function isPlausibleHost(host: string): boolean {
  if (!host) return false;
  if (host.includes('*')) return false;
  // Allow letters, digits, dots, hyphens, colons (for port), and
  // brackets (IPv6 literals like [::1]:8080).
  if (!/^[A-Za-z0-9.\-:[\]]+$/.test(host)) return false;
  return true;
}
