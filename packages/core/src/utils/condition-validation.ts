/**
 * Pure validators for `RuleCondition` values.
 *
 * Chrome's declarativeNetRequest is strict about what each condition
 * field accepts, but the rejections are atomic (a single bad value in
 * a `requestDomains` list trips the whole `updateDynamicRules` call,
 * which leaves the prior compiled ruleset stuck in place — no partial
 * apply, no rule-level error). The user has no way to see why their
 * new rule isn't matching unless we surface the issue at edit time.
 *
 * This module catches the four mistakes we've seen most:
 *   1. literal `*` wildcards in domain values  (Chrome rejects)
 *   2. `:port` suffixes in domain values        (Chrome ignores ports
 *      anyway — the value is rejected as invalid)
 *   3. scheme prefixes (`http://`, `https://`)  (rejected as invalid)
 *   4. uppercase / non-ASCII characters         (rejected as invalid;
 *      the canonical form is lowercase ASCII)
 *
 * Each issue carries a `cleaned` field — the suggested fix — so the
 * UI can offer a one-click cleanup without inventing the rule itself.
 *
 * Pure / platform-agnostic: imported by the renderer for inline
 * warnings + by future SW gates that want to refuse to compile a
 * rule with structurally-invalid domain values.
 */

import type { ConditionType, RuleCondition } from '../types/v5/rule';

/** Condition types where the value list IS a domain list. */
const DOMAIN_CONDITION_TYPES: ReadonlySet<ConditionType> = new Set([
  'request-domains',
  'exclude-request-domains',
  'initiator-domains',
  'exclude-initiator-domains',
]);

export type DomainIssueKind = 'wildcard' | 'port' | 'scheme' | 'uppercase' | 'non-ascii' | 'empty';

export interface DomainValueIssue {
  /** Index in the condition's `values` array. */
  valueIndex: number;
  /** The raw value as the user typed it. */
  raw: string;
  /** Suggested replacement after stripping the offending bits. Empty
   *  string means "no salvageable hostname — drop the entry". */
  cleaned: string;
  kind: DomainIssueKind;
  /** Human-readable explanation suitable for inline display. */
  message: string;
}

/**
 * Inspect every value in a domain-typed condition. Returns an empty
 * array for non-domain condition types (regex / url-filter validation
 * lives elsewhere) and for values that are already canonical.
 *
 * Order: one issue per value (the first issue encountered). Multiple
 * problems on a single value are reported as the most-severe-first
 * (wildcard > scheme > port > uppercase / non-ascii) so the cleanup
 * suggestion strips them in dependency order.
 */
export function validateDomainValues(condition: RuleCondition): DomainValueIssue[] {
  if (!DOMAIN_CONDITION_TYPES.has(condition.type)) return [];
  const issues: DomainValueIssue[] = [];
  for (let i = 0; i < condition.values.length; i++) {
    const issue = inspectDomainValue(condition.values[i], i);
    if (issue) issues.push(issue);
  }
  return issues;
}

function inspectDomainValue(raw: string, valueIndex: number): DomainValueIssue | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Skip values that carry a `{{...}}` template reference — we can't
  // judge the resolved hostname at edit time, and the rule resolver
  // expands list-shaped variables (e.g. `{{DOMAINS}}`) into multiple
  // entries before they hit Chrome. Validating the literal template
  // would falsely flag the `{` / `}` characters as non-ASCII and
  // offer a "cleanup" that mangles the template tag.
  if (trimmed.includes('{{') && trimmed.includes('}}')) return null;

  // Strip in dependency order so the cleaned suggestion is canonical
  // even when the input has multiple problems (e.g. `HTTPS://*.foo.com:443`).
  let working = trimmed;
  let kind: DomainIssueKind | null = null;
  let message = '';

  // 1. Scheme — must be stripped before anything else can be parsed.
  const schemeMatch = working.match(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//);
  if (schemeMatch) {
    working = working.slice(schemeMatch[0].length);
    kind = 'scheme';
    message = "Drop the scheme — Chrome's requestDomains takes hostnames only, not URLs.";
  }

  // 2. Path — silently strip; not technically an error but no part of
  // a hostname. Done after scheme so `https://foo/bar` → `foo`.
  const slashIdx = working.indexOf('/');
  if (slashIdx >= 0) working = working.slice(0, slashIdx);

  // 3. Wildcard — `*.foo.com` is the most common mistake; the leading
  // `*.` is always redundant because requestDomains auto-matches
  // subdomains. Any other `*` makes the value structurally invalid.
  if (working.includes('*')) {
    const stripped = working.replace(/^\*+\./, '').replace(/\*/g, '');
    if (kind === null) {
      kind = 'wildcard';
      message =
        "Drop the wildcard — requestDomains matches all subdomains automatically, so '*.foo.com' is just 'foo.com'.";
    }
    working = stripped;
  }

  // 4. Port — Chrome ignores the port for hostname matching; carrying
  // a `:port` makes the value invalid.
  const portIdx = working.lastIndexOf(':');
  // A port is the LAST `:` followed only by digits — distinguishes
  // from IPv6 brackets which we don't claim to support here.
  if (portIdx >= 0 && /^\d+$/.test(working.slice(portIdx + 1))) {
    working = working.slice(0, portIdx);
    if (kind === null) {
      kind = 'port';
      message = 'Drop the port — requestDomains matches by hostname only; the rule covers every port automatically.';
    }
  }

  // 5. Uppercase — Chrome wants lowercase ASCII.
  const lower = working.toLowerCase();
  if (lower !== working) {
    working = lower;
    if (kind === null) {
      kind = 'uppercase';
      message = 'Lowercase the hostname — Chrome only accepts lowercase ASCII in requestDomains.';
    }
  }

  // 6. Non-hostname characters — Chrome's requestDomains accepts only
  // lowercase ASCII letters, digits, `.`, and `-`. Anything else (IDN
  // characters, underscores, escaped chars) is rejected; punycode is
  // the canonical form for IDNs.
  if (!/^[a-z0-9.-]*$/.test(working)) {
    if (kind === null) {
      kind = 'non-ascii';
      message =
        'Hostname contains characters Chrome rejects in requestDomains (likely a non-ASCII / IDN entry). Use the punycode (xn--…) form.';
    }
    // No automatic fix — punycode encoding lives outside this layer.
  }

  // 7. Anything left after cleanup must not be empty (`*.` alone, for
  // example, cleans to '').
  if (working.length === 0 && kind === null) {
    kind = 'empty';
    message = 'Empty hostname — remove this row.';
  }

  if (kind === null) return null;
  return { valueIndex, raw, cleaned: working, kind, message };
}

/**
 * Apply every issue's `cleaned` suggestion to a condition's value
 * list. Empty cleaned values are dropped. Returns a new condition
 * (does not mutate the input).
 *
 * Used by the editor's one-click "Clean up" action.
 */
export function applyDomainValueCleanup(condition: RuleCondition, issues: readonly DomainValueIssue[]): RuleCondition {
  if (issues.length === 0) return condition;
  const fixByIndex = new Map<number, string>();
  for (const issue of issues) fixByIndex.set(issue.valueIndex, issue.cleaned);
  const next: string[] = [];
  for (let i = 0; i < condition.values.length; i++) {
    const replacement = fixByIndex.has(i) ? fixByIndex.get(i)! : condition.values[i];
    if (replacement.length > 0) next.push(replacement);
  }
  return { ...condition, values: next };
}
