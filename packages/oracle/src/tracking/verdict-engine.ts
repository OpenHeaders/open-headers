/**
 * Verdict engine — pure function that renders a categorical verdict on
 * whether a rule is active on a tab, aggregating every observation
 * source (webRequest, PerformanceObserver, tab-telemetry counters).
 *
 * Extracted from request-tracker so it can be:
 *   - Unit-tested in isolation (no tab-telemetry / rule-store mocks needed).
 *   - Reused by the DevTools inspector panel and any future workspace
 *     "rules-on-this-page" view without duplicating the ranking logic.
 *
 * Input is fully explicit: callers pass the rule, its compiled match
 * patterns, the tab URL, the observed resources, and the "did this rule
 * already fire on this tab?" boolean. No global state is touched here.
 *
 * See `RuleVerdict` in `@openheaders/core/types` for the semantic
 * definitions of the five verdict values.
 */

import type { Rule, RuleVerdict, SilentMatchRecord, TrackedResource } from '@openheaders/core/types';
import { doesUrlMatchEntry, type MatchPattern } from '@openheaders/core/utils';

/**
 * Result of the verdict engine's evaluation.
 *
 *   - `verdict`        — the categorical ruling.
 *   - `reason`         — human-readable explanation for the tooltip.
 *   - `silentRecords`  — every tracked URL matching the rule whose
 *                        observation indicates the action could not
 *                        have run (cache / SW / bfcache). Always
 *                        present; empty when the rule has no silent
 *                        matches. Independent of `verdict` — a
 *                        firing rule can also have silent records
 *                        (it fired on some requests and silently
 *                        matched others on the same page).
 *
 * Returning `null` means the rule is idle with no signal to surface —
 * callers typically filter these out of the popup (future UIs may
 * choose to list idle rules explicitly).
 */
export interface VerdictResult {
  verdict: RuleVerdict;
  reason: string;
  silentRecords: SilentMatchRecord[];
}

/**
 * Cheap eTLD+1 approximation. Extracts the last two dot-delimited
 * labels of the hostname, which is correct for most common TLDs
 * (`.com`, `.org`, `.io`, `.dev`). Known to misbehave on compound TLDs
 * like `.co.uk` or `.com.br` — we accept that for a popup hint that
 * only drives the `related` grouping. Not worth bundling a full
 * public-suffix list for this use.
 *
 * Exported because both the tab-domain extraction (from the tab URL)
 * and the rule-domain extraction (from each rule's request-domains
 * condition) use the same heuristic — keeping them in one place means
 * a future PSL upgrade only touches this module.
 */
export function registrableDomainOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return null;
    const labels = host.split('.').filter(Boolean);
    if (labels.length <= 2) return host;
    return labels.slice(-2).join('.');
  } catch {
    return null;
  }
}

export interface VerdictInput {
  rule: Rule;
  patterns: MatchPattern[];
  /** Pre-normalized tab URL — caller owns normalization. */
  normalizedTabUrl: string;
  /**
   * Pre-normalized URL → TrackedResource map for this tab. Keys must
   * already be normalized to match how the engine searches (the engine
   * re-normalizes defensively but relies on the caller for correctness).
   */
  trackedResources: ReadonlyMap<string, TrackedResource>;
  /** True when tab-telemetry has already counted a fire for this rule. */
  firing: boolean;
  /**
   * URL-normalization hook the caller supplies — typically
   * `normalizeUrlForTracking` from `background/modules/url-utils`. The
   * engine keeps it pluggable so core (no browser globals) can supply
   * a stub in test harnesses.
   */
  normalizeUrl: (url: string) => string;
}

/**
 * Render the engine's verdict for a single rule on a single tab.
 *
 * Priority order (strongest signal first):
 *   1. `firing`   — telemetry already counts a fire for this rule.
 *   2. `silent`   — pattern matches an observed URL AND that URL was
 *                   either cache-served or observed only via
 *                   PerformanceObserver (webRequest missed it).
 *   3. `page`     — pattern matches the tab URL directly.
 *   4. `related`  — pattern's registrable domain equals the tab's.
 *   5. `null`     — no signal; caller decides whether to emit an `idle`
 *                   row or omit the rule entirely.
 *
 * Returns `null` instead of `{ verdict: 'idle' }` to keep the "nothing
 * to surface" decision at the call site — the popup omits, but a
 * debug view may want to render idle rules explicitly.
 */
export function computeVerdict(input: VerdictInput): VerdictResult | null {
  const { rule, patterns, normalizedTabUrl, trackedResources, firing, normalizeUrl } = input;

  // Walk every tracked URL once, collecting:
  //   - `anyUrlMatch`   — whether any tracked URL matched the pattern
  //                       (used for page-verdict fallback below)
  //   - `silentRecords` — every match that couldn't have run the
  //                       action (cache / perf-only). Returned even
  //                       on firing / page verdicts so the popup can
  //                       show them in the sub-table.
  //
  // Walking once up front (instead of short-circuiting the first
  // silent match) is O(trackedResources × patterns) regardless, and
  // the walk lets the popup render the full list of silently-matched
  // URLs per rule.
  const silentRecords: SilentMatchRecord[] = [];
  let anyUrlMatch = false;
  for (const [url, resource] of trackedResources) {
    const normalized = normalizeUrl(url);
    let matchedPattern: MatchPattern | null = null;
    for (const entry of patterns) {
      if (doesUrlMatchEntry(normalized, entry)) {
        matchedPattern = entry;
        break;
      }
    }
    if (!matchedPattern) continue;
    anyUrlMatch = true;
    const perfOnly = resource.sources.size === 1 && resource.sources.has('perfObserver');
    const servedFromCache = resource.servedFromCache ?? false;
    if (servedFromCache || perfOnly) {
      silentRecords.push({
        url: normalized,
        pattern: matchedPattern.pattern,
        resourceType: resource.resourceType,
        t: resource.lastSeenTs,
        servedFromCache,
        perfOnly,
      });
    }
  }

  if (firing) {
    return { verdict: 'firing', reason: 'Rule has fired on this page', silentRecords };
  }

  // Silent records take precedence over page-verdict: a cached
  // subresource match is stronger signal than "pattern matches tab URL
  // with no observations yet."
  if (silentRecords.length > 0) {
    const cached = silentRecords.find((r) => r.servedFromCache);
    const reason = cached
      ? "Matched cached subresource — DNR can't modify cache-served responses"
      : 'Matched a subresource observed only via Resource Timing (webRequest missed it — likely SW-intercepted or bfcache)';
    return { verdict: 'silent', reason, silentRecords };
  }

  // Tab URL itself matches — classic "this rule targets this page".
  for (const entry of patterns) {
    if (doesUrlMatchEntry(normalizedTabUrl, entry)) {
      if (anyUrlMatch) {
        return { verdict: 'page', reason: 'Matches this page — requests in flight', silentRecords };
      }
      return { verdict: 'page', reason: 'Matches this page URL — no subresources yet', silentRecords };
    }
  }

  // Any subresource match we didn't classify as silent still counts as
  // a page-verdict (network-observed). Cache and perf-only cases were
  // handled above.
  if (anyUrlMatch) {
    return { verdict: 'page', reason: 'Matched a subresource on this page', silentRecords };
  }

  // Weakest signal — rule's registrable domain matches the tab's but
  // no specific URL match. Useful for power users with many rules
  // targeting the same site.
  const tabDomain = registrableDomainOf(normalizedTabUrl);
  if (tabDomain) {
    for (const c of rule.conditions) {
      if (c.type !== 'request-domains') continue;
      for (const value of c.values) {
        const ruleDomain = registrableDomainOf(`https://${value.replace(/^\*\.?/, '')}`);
        if (ruleDomain && ruleDomain === tabDomain) {
          return {
            verdict: 'related',
            reason: `Targets the same domain (${tabDomain})`,
            silentRecords,
          };
        }
      }
    }
  }

  return null;
}
