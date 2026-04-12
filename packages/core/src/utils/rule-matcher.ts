/**
 * Rule Matcher — single source of truth for the question
 * "does a URL match this rule?".
 *
 * This module is platform-agnostic. Both the browser extension and the
 * desktop app's proxy/rule engine should use these primitives so a rule
 * authored in either UI has identical matching semantics everywhere.
 *
 * Layers:
 *
 *   1. `formatUrlPattern(raw)` — normalizes user-entered patterns (e.g.
 *      'example.com' → '*://example.com/*') into canonical Chrome MV3
 *      `urlFilter` form. Matches chrome.declarativeNetRequest semantics.
 *
 *   2. `compilePatternToRegexSource(pattern)` — turns a urlFilter into a
 *      plain regex source string suitable for `new RegExp(src, 'i')`. The
 *      resulting regex is anchored at start only (prefix match), matching
 *      Chrome's urlFilter semantics.
 *
 *   3. `getRuleMatchPatterns(rule)` — walks a rule's conditions and
 *      produces a typed `MatchPattern[]` (covers 'request-domains',
 *      'url-filter', 'url-regex'). Domains are normalized to urlFilter
 *      form on extraction so downstream code sees one shape.
 *
 *   4. `doesUrlMatchEntry(url, entry)` — tests a normalized URL against a
 *      single `MatchPattern`. Uncached — callers that need caching (e.g.
 *      the extension's per-rule-store cache) wrap this.
 *
 *   5. `doesUrlMatchRule(url, rule)` — convenience: rule has no URL
 *      conditions → returns false (callers decide the "match everything"
 *      default). Otherwise returns true if ANY pattern matches.
 *
 *   6. `compileRuleForInjection(rule)` — returns the rule's regex sources
 *      as a `string[]` ready to be serialized into a content-script
 *      injection payload. The injection function then does
 *      `regexSources.map(s => new RegExp(s, 'i')).some(r => r.test(url))`.
 *
 * Note: none of this depends on the Chrome APIs. All inputs are raw
 * strings and typed rule objects. Perfect-fit for core.
 */

import type { V5 } from '../types';

// ── Types ────────────────────────────────────────────────────────

export type MatchPatternKind = 'url-filter' | 'url-regex';

export interface MatchPattern {
  /**
   * For 'url-filter' kind: a canonical urlFilter string (already run
   * through `formatUrlPattern`).
   * For 'url-regex' kind: the raw regex source as authored.
   */
  pattern: string;
  kind: MatchPatternKind;
}

// ── Pattern normalization ────────────────────────────────────────

/**
 * Convert a user-entered domain/URL pattern into the canonical MV3
 * declarativeNetRequest urlFilter string. This is the single
 * normalization function — both DNR rule construction and in-memory
 * matching use it so they stay in sync.
 *
 * Supported inputs:
 *   "example.com"             → "*://example.com/*"
 *   "*.example.com"           → "*://*.example.com/*"
 *   "example.com/api"         → "*://example.com/api"
 *   "example.com/api/*"       → "*://example.com/api/*"
 *   "localhost:3000"          → "*://localhost:3000/*"
 *   "192.168.1.1:8080"        → "*://192.168.1.1:8080/*"
 *   "https://example.com/*"   → "https://example.com/*"
 *   "*"                       → "*"
 */
export function formatUrlPattern(domain: string): string {
  let urlFilter = domain.trim();

  if (urlFilter === '*') return '*';

  if (urlFilter.includes('://')) {
    const protocolEnd = urlFilter.indexOf('://') + 3;
    const afterProtocol = urlFilter.substring(protocolEnd);
    if (!afterProtocol.includes('/')) {
      urlFilter = `${urlFilter}/*`;
    }
    return urlFilter;
  }

  urlFilter = `*://${urlFilter}`;
  const protocolEnd = urlFilter.indexOf('://') + 3;
  const afterProtocol = urlFilter.substring(protocolEnd);
  if (!afterProtocol.includes('/')) {
    urlFilter = `${urlFilter}/*`;
  }

  return urlFilter;
}

// ── Pattern → regex source ───────────────────────────────────────

/**
 * Compile a urlFilter pattern into a regex source string (no flags)
 * whose semantics match Chrome's declarativeNetRequest urlFilter:
 *
 *   - `*` wildcards become `.*`
 *   - Special regex characters are escaped
 *   - Anchored at start only (`^`) — urlFilter is a prefix match, not
 *     a full match: '*://example.com/api' matches
 *     'https://example.com/api/v2/users'
 *   - Case-insensitive matching is the caller's responsibility via the
 *     'i' flag on `new RegExp(src, 'i')`
 *
 * Returns `null` for the match-all `'*'` sentinel — callers should
 * treat null as "matches every URL".
 */
export function compilePatternToRegexSource(pattern: string): string | null {
  const trimmed = pattern.trim().toLowerCase();
  if (trimmed === '*') return null;

  let urlFilter = formatUrlPattern(trimmed);

  // IDN normalization — if pattern contains non-ASCII, parse it as a
  // URL and re-emit the normalized hostname.
  try {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — detecting non-ASCII for IDN normalization
    if (/[^\x00-\x7F]/.test(urlFilter)) {
      const patternUrl = new URL(urlFilter.replace('*://', 'http://'));
      urlFilter = formatUrlPattern(patternUrl.hostname.toLowerCase());
    }
  } catch {
    // Pattern is not a valid URL — fall through with original.
  }

  // Normalize default ports (match the normalization applied to URLs
  // being tested, so a pattern with :80 still matches a URL stripped of :80).
  urlFilter = urlFilter.replace(/:80\//, '/').replace(/:443\//, '/');

  // Escape regex specials, then expand `*` to `.*`.
  const regexSource = urlFilter.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return `^${regexSource}`;
}

// ── Rule condition → MatchPattern[] ──────────────────────────────

/**
 * Walk a rule's conditions and extract every URL-shaped pattern as a
 * typed `MatchPattern`. Covers:
 *
 *   - 'request-domains' — each domain is normalized via `formatUrlPattern`
 *     so downstream code sees consistent urlFilter shape.
 *   - 'url-filter'      — taken as-authored (already urlFilter form).
 *   - 'url-regex'       — taken as-authored regex source.
 *
 * Empty result means "no URL conditions". Callers decide whether that
 * represents "match everything" or "match nothing" — semantics differ
 * between the badge display (match everything) and the injection
 * targeting (match nothing, to avoid injecting into every page).
 */
export function getRuleMatchPatterns(rule: V5.Rule): MatchPattern[] {
  const patterns: MatchPattern[] = [];
  for (const c of rule.conditions) {
    if (c.type === 'request-domains') {
      for (const v of c.values) {
        const trimmed = v.trim();
        if (trimmed) patterns.push({ pattern: formatUrlPattern(trimmed), kind: 'url-filter' });
      }
    } else if (c.type === 'url-filter') {
      for (const v of c.values) {
        const trimmed = v.trim();
        if (trimmed) patterns.push({ pattern: trimmed, kind: 'url-filter' });
      }
    } else if (c.type === 'url-regex') {
      for (const v of c.values) {
        const trimmed = v.trim();
        if (trimmed) patterns.push({ pattern: trimmed, kind: 'url-regex' });
      }
    }
  }
  return patterns;
}

// ── URL matching ─────────────────────────────────────────────────

/**
 * Test a URL against a single MatchPattern. Uncached — callers that
 * want caching should wrap this. The URL is expected to already be
 * normalized (lowercase host, no fragment, default ports removed).
 */
export function doesUrlMatchEntry(url: string, entry: MatchPattern): boolean {
  if (entry.kind === 'url-regex') {
    try {
      return new RegExp(entry.pattern, 'i').test(url);
    } catch {
      return false;
    }
  }
  const source = compilePatternToRegexSource(entry.pattern);
  if (source === null) return true; // match-all
  try {
    return new RegExp(source, 'i').test(url);
  } catch {
    return false;
  }
}

/**
 * Test a URL against a rule. Returns false for rules with no URL
 * conditions — callers that want the "no conditions = match everything"
 * semantic must check `getRuleMatchPatterns(rule).length === 0` and
 * apply their own default.
 */
export function doesUrlMatchRule(url: string, rule: V5.Rule): boolean {
  const patterns = getRuleMatchPatterns(rule);
  for (const entry of patterns) {
    if (doesUrlMatchEntry(url, entry)) return true;
  }
  return false;
}

// ── Injection compilation ────────────────────────────────────────

/**
 * Pre-compile a rule's URL conditions into regex source strings ready
 * to be serialized into a content-script injection payload.
 *
 * The in-page injection function reconstitutes them with
 *   `cfg.regexSources.map(s => new RegExp(s, 'i'))`
 * and tests each intercepted fetch/XHR URL with `r.test(url)`.
 *
 * This eliminates the need for a hand-rolled glob matcher inside every
 * injection function — Chrome's urlFilter semantics (including `|`/`||`
 * anchors as they're added) live in ONE place: this module.
 */
export function compileRuleForInjection(rule: V5.Rule): string[] {
  const sources: string[] = [];
  for (const entry of getRuleMatchPatterns(rule)) {
    if (entry.kind === 'url-regex') {
      sources.push(entry.pattern);
      continue;
    }
    const source = compilePatternToRegexSource(entry.pattern);
    // Match-all ('*') compiles to null — use a regex that matches anything.
    sources.push(source ?? '.*');
  }
  return sources;
}
