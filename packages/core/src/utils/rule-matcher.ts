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

import type { Rule } from '../types';
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

  // Chrome's urlFilter is a SUBSTRING match unless anchored. A pattern
  // starting with '/' is a path fragment ('/api/echo') — the domain
  // normalization below would mint '*:///api/echo', which no URL
  // contains, so the wire plane (raw urlFilter → DNR) would match while
  // every projection built on this compiler denied it. Compile path
  // fragments as the unanchored substring Chrome matches.
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  }

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
export function getRuleMatchPatterns(rule: Rule): MatchPattern[] {
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
export function doesUrlMatchRule(url: string, rule: Rule): boolean {
  const patterns = getRuleMatchPatterns(rule);
  for (const entry of patterns) {
    if (doesUrlMatchEntry(url, entry)) return true;
  }
  return false;
}

// ── Method matching ──────────────────────────────────────────────

/**
 * Test an HTTP method against a rule's `request-methods` /
 * `exclude-request-methods` conditions. Mirrors Chrome DNR semantics:
 * a rule with no method condition matches every method; comparison is
 * case-insensitive. Conditions AND together — an include list the
 * method is absent from, or an exclude list it appears in, rejects.
 */
export function doesMethodMatchRule(method: string, rule: Rule): boolean {
  const m = method.trim().toLowerCase();
  if (!m) return true;
  for (const c of rule.conditions) {
    if (c.type === 'request-methods') {
      if (!c.values.some((v) => v.trim().toLowerCase() === m)) return false;
    } else if (c.type === 'exclude-request-methods') {
      if (c.values.some((v) => v.trim().toLowerCase() === m)) return false;
    }
  }
  return true;
}

// ── Resource-type matching ───────────────────────────────────────

/**
 * Resource-type vocabulary map: the model's names → Chrome DNR names.
 * Single source of truth — both DNR rule compilation and attribution
 * matching use it so a resource-type condition gates identically on
 * the wire and in the fire ledger.
 */
export const MODEL_TO_DNR_RESOURCE_TYPE: Record<string, string> = {
  page: 'main_frame',
  xhr: 'xmlhttprequest',
  script: 'script',
  stylesheet: 'stylesheet',
  image: 'image',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  other: 'other',
};

/**
 * Test an observed request's resource type (Chrome DNR/webRequest vocab,
 * e.g. 'xmlhttprequest', 'image') against a rule's `resource-types` /
 * `exclude-resource-types` conditions (model vocab, e.g. 'xhr', 'image').
 * No resource-type condition → matches every type. Values already in DNR
 * vocab pass through unmapped.
 */
export function doesResourceTypeMatchRule(resourceType: string, rule: Rule): boolean {
  const toDnr = (v: string): string => {
    const trimmed = v.trim();
    return MODEL_TO_DNR_RESOURCE_TYPE[trimmed] ?? trimmed;
  };
  for (const c of rule.conditions) {
    if (c.type === 'resource-types') {
      if (!c.values.some((v) => toDnr(v) === resourceType)) return false;
    } else if (c.type === 'exclude-resource-types') {
      if (c.values.some((v) => toDnr(v) === resourceType)) return false;
    }
  }
  return true;
}

// ── Initiator-domain matching ────────────────────────────────────

/**
 * Test a hostname against a DNR-style domain list: a domain matches the
 * host itself and every subdomain (`openheaders.com` matches both
 * `openheaders.com` and `app.openheaders.com`). Mirrors Chrome's
 * `initiatorDomains` / `excludedInitiatorDomains` semantics.
 */
export function doesHostMatchDomains(host: string, domains: string[]): boolean {
  const h = host.toLowerCase();
  for (const d of domains) {
    const domain = d.trim().toLowerCase();
    if (!domain) continue;
    if (h === domain || h.endsWith(`.${domain}`)) return true;
  }
  return false;
}

// ── Domain-condition matching ────────────────────────────────────

/**
 * Test a request URL against a rule's `request-domains` /
 * `exclude-request-domains` conditions. DNR ANDs `requestDomains` with
 * the URL filter, while pattern extraction ORs them — this predicate
 * restores the AND, and enforces the exclusion the pattern walk never
 * sees. A domain value matches when the URL matches its urlFilter form
 * (which supports `*.` wildcards) or when the hostname falls under it
 * with DNR's subdomain semantics. No domain condition → matches every
 * URL.
 */
export function doesRequestDomainMatchRule(url: string, rule: Rule): boolean {
  let host: string | undefined;
  try {
    host = new URL(url).hostname;
  } catch {
    host = undefined;
  }
  const domainMatches = (v: string): boolean => {
    const trimmed = v.trim();
    if (!trimmed) return false;
    if (doesUrlMatchEntry(url, { pattern: formatUrlPattern(trimmed), kind: 'url-filter' })) return true;
    return host !== undefined && doesHostMatchDomains(host, [trimmed]);
  };
  for (const c of rule.conditions) {
    if (c.type === 'request-domains') {
      if (!c.values.some(domainMatches)) return false;
    } else if (c.type === 'exclude-request-domains') {
      if (c.values.some(domainMatches)) return false;
    }
  }
  return true;
}

/**
 * Test a request's initiator hostname against a rule's
 * `initiator-domains` / `exclude-initiator-domains` conditions. Same
 * subdomain semantics as {@link doesHostMatchDomains}. No initiator
 * condition → matches every initiator.
 */
export function doesInitiatorMatchRule(initiatorHost: string, rule: Rule): boolean {
  for (const c of rule.conditions) {
    if (c.type === 'initiator-domains') {
      if (!doesHostMatchDomains(initiatorHost, c.values)) return false;
    } else if (c.type === 'exclude-initiator-domains') {
      if (doesHostMatchDomains(initiatorHost, c.values)) return false;
    }
  }
  return true;
}

// ── Response-header matching ─────────────────────────────────────

/**
 * True when the rule carries a configured `response-header` /
 * `exclude-response-header` condition — a gate Chrome judges only when
 * the response arrives, so a request-start observation cannot prove the
 * rule acted. Rows without a header name are unconfigured and ship no
 * DNR field, so they don't gate.
 */
export function isResponseGatedRule(rule: Rule): boolean {
  return rule.conditions.some(
    (c) => (c.type === 'response-header' || c.type === 'exclude-response-header') && (c.headerName ?? '').trim() !== '',
  );
}

/**
 * Test observed response headers against a rule's `response-header` /
 * `exclude-response-header` conditions, mirroring Chrome DNR semantics:
 *
 *   - Header names compare case-insensitively; a condition with values
 *     matches when ANY instance of the header matches ANY value pattern
 *     (full-value, case-insensitive, `*` = any run, `?` = at most one
 *     character, `\` escapes). No values = presence alone matches.
 *   - Multiple `response-header` rows OR together (Chrome's
 *     `responseHeaders[]` array matches on any entry); any matching
 *     `exclude-response-header` row rejects.
 *   - No configured response-header conditions → matches every response.
 */
export function doesResponseHeaderMatchRule(headers: readonly { name: string; value: string }[], rule: Rule): boolean {
  let hasInclude = false;
  let includeMatched = false;
  for (const c of rule.conditions) {
    if (c.type !== 'response-header' && c.type !== 'exclude-response-header') continue;
    const name = (c.headerName ?? '').trim();
    if (!name) continue;
    const matched = headerConditionMatches(headers, name, c.values);
    if (c.type === 'response-header') {
      hasInclude = true;
      if (matched) includeMatched = true;
    } else if (matched) {
      return false;
    }
  }
  return hasInclude ? includeMatched : true;
}

function headerConditionMatches(
  headers: readonly { name: string; value: string }[],
  headerName: string,
  values: string[],
): boolean {
  const target = headerName.toLowerCase();
  const instances = headers.filter((h) => h.name.toLowerCase() === target);
  if (instances.length === 0) return false;
  const patterns = values.map((v) => v.trim()).filter(Boolean);
  if (patterns.length === 0) return true;
  return instances.some((h) => patterns.some((p) => matchesHeaderValuePattern(h.value, p)));
}

function matchesHeaderValuePattern(value: string, pattern: string): boolean {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      source += escapeRegexChar(pattern[i + 1]);
      i++;
    } else if (ch === '*') {
      source += '.*';
    } else if (ch === '?') {
      source += '.?';
    } else {
      source += escapeRegexChar(ch);
    }
  }
  try {
    return new RegExp(`^${source}$`, 'i').test(value);
  } catch {
    return false;
  }
}

function escapeRegexChar(ch: string): string {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

// ── GraphQL body gate ────────────────────────────────────────────

/**
 * The GraphQL-filter surface of a body-touching action — structurally
 * satisfied by both `RequestBodyAction` and `ResponseAction`, so every
 * enforcement plane (CDP `Fetch` reaction, proxy MITM path) judges the
 * gate through this one function.
 */
export interface GraphqlBodyGate {
  readonly resourceType?: 'rest' | 'graphql';
  readonly graphqlFilter?: { readonly key: string; readonly operator: 'Equals' | 'Contains'; readonly value: string };
}

/**
 * True unless a GraphQL filter is active and the request body fails it.
 *
 * `bodyText === undefined` means the observing plane could not read the
 * body (too large for its inline bound, or absent) — the gate then sees
 * no body and a filtered rule does NOT fire, the same documented bound
 * on every plane.
 */
export function doesGraphqlBodyGatePass(action: GraphqlBodyGate, bodyText: string | undefined): boolean {
  if (action.resourceType !== 'graphql' || !action.graphqlFilter?.key) return true;
  const filter = action.graphqlFilter;
  const bodyStr = bodyText ?? '';
  if (bodyStr.length === 0) return false;
  try {
    const parsed: unknown = JSON.parse(bodyStr);
    if (parsed == null || typeof parsed !== 'object') return false;
    const value = (parsed as Record<string, unknown>)[filter.key];
    if (typeof value !== 'string') return false;
    return filter.operator === 'Contains' ? value.includes(filter.value) : value === filter.value;
  } catch {
    return false;
  }
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
export function compileRuleForInjection(rule: Rule): string[] {
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
