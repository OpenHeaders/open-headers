/**
 * Compile debug-tier rules into CDP `Fetch.enable` URL patterns (Phase D).
 *
 * Pure and host-neutral in spirit, but typed against the oracle
 * {@link CdpFetchPattern} — so it lives in the host, not `@openheaders/rule-engine`
 * (which depends only on `@openheaders/core` and cannot reference oracle
 * types). The host is the meeting point of core, rule-engine, and oracle.
 *
 * Only {@link isDebugTierRule} rules contribute patterns; the standard-tier
 * rules ride DNR / page-context injection unchanged. A rule's URL conditions
 * become `urlPattern` globs: our canonical `urlFilter` strings (via
 * `getRuleMatchPatterns`) already use only `*` wildcards, the same grammar
 * CDP's `urlPattern` accepts — so the mapping is a near-identity, escaping
 * only the two extra metacharacters CDP treats specially (`?` = one char,
 * `\` = escape).
 *
 * Coarse pre-filter, not the authoritative match: a `urlPattern` narrows
 * which requests pause; the paused-request handler re-checks the rule's full
 * conditions (domains, methods, resource-types) before acting. Two coverage
 * notes, deliberately broad rather than silently dropped (plan §4.4 "never
 * silent"):
 *   - a debug-tier rule with NO url-filter pattern (only `url-regex`, which
 *     CDP `Fetch` has no equivalent for, or no URL condition at all) emits a
 *     match-all `*` so it still pauses; the handler's full-condition re-check
 *     keeps it correct.
 */

import type { Rule } from '@openheaders/core/types';
import { getRuleMatchPatterns, isDebugTierRule } from '@openheaders/core/utils';
import type { CdpFetchPattern } from '@openheaders/oracle/correlator-cdp';

const MATCH_ALL: CdpFetchPattern = { urlPattern: '*' };

/**
 * The CDP `Fetch.enable` patterns for the debug-tier rules among `rules`.
 * De-duplicated by `urlPattern` (multiple rules / domains often coincide).
 * Callers pass already-effective rules; the debug-tier filter is applied
 * here so "which rules contribute Fetch patterns" stays in one place.
 */
export function compileFetchPatterns(rules: readonly Rule[]): CdpFetchPattern[] {
  const byPattern = new Map<string, CdpFetchPattern>();
  for (const rule of rules) {
    if (!isDebugTierRule(rule)) continue;
    const globPatterns = getRuleMatchPatterns(rule)
      .filter((mp) => mp.kind === 'url-filter')
      .map((mp) => ({ urlPattern: toCdpUrlPattern(mp.pattern) }));
    const contributed = globPatterns.length > 0 ? globPatterns : [MATCH_ALL];
    for (const pattern of contributed) byPattern.set(pattern.urlPattern, pattern);
  }
  return [...byPattern.values()];
}

/**
 * A canonical `urlFilter` (only `*` wildcards) → a CDP `Fetch` `urlPattern`.
 * `*` carries through unchanged; escape any literal `?` / `\` so CDP does not
 * read them as its single-char-wildcard / escape metacharacters.
 */
function toCdpUrlPattern(urlFilter: string): string {
  return urlFilter.replace(/[\\?]/g, '\\$&');
}
