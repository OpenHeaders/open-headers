import type { RuleCondition } from '../../types/rule';
import { isDomainListConditionType } from '../condition-metadata';

export type DomainIssueKind = 'wildcard' | 'port' | 'scheme' | 'uppercase' | 'non-ascii' | 'empty' | 'whitespace';

/**
 * One-line phrase describing each domain issue kind, suitable for
 * inline summary use ("Variable resolved to a value Chrome rejects in
 * this slot — <phrase>"). Kept colocated with `DomainIssueKind` so the
 * pre-resolve UI message and the post-resolve diagnostic stay in sync
 * — never edit one without updating the other.
 */
export const DOMAIN_ISSUE_SUMMARY: Readonly<Record<DomainIssueKind, string>> = Object.freeze({
  whitespace: 'contains whitespace (separate hostnames with commas)',
  scheme: 'contains a scheme — drop the protocol prefix',
  wildcard: 'contains a wildcard — requestDomains auto-matches subdomains',
  port: 'contains a port — requestDomains matches by hostname only',
  uppercase: 'contains uppercase characters — requestDomains is lowercase ASCII',
  'non-ascii': 'contains characters Chrome rejects (use punycode for IDN names)',
  empty: 'is empty after sanitization',
});

/**
 * Most-informative-first summary across a set of domain issues. Used
 * by post-resolve diagnostics to enrich the `invalid-resolved-value`
 * hint with the specific shape problem found. Order matches the
 * dependency order of strips inside `inspectDomainValue`.
 */
export function summarizeDomainIssues(issues: ReadonlyArray<{ kind: DomainIssueKind }>): string {
  const kinds = new Set(issues.map((i) => i.kind));
  const order: DomainIssueKind[] = ['whitespace', 'scheme', 'wildcard', 'port', 'uppercase', 'non-ascii', 'empty'];
  for (const k of order) {
    if (kinds.has(k)) return DOMAIN_ISSUE_SUMMARY[k];
  }
  return 'is not a valid bare hostname';
}

export interface DomainValueIssue {
  /** Index in the condition's `values` array. */
  valueIndex: number;
  /** The raw value as the user typed it. */
  raw: string;
  /** Suggested replacement after stripping the offending bits. Empty
   *  string means "no salvageable hostname — drop the entry". When
   *  `cleanedSplit` is set the cleanup expands one entry into many
   *  and `cleaned` carries the first chunk for callers that want a
   *  single-string preview. */
  cleaned: string;
  /**
   * Multi-entry cleanup. Set for whitespace issues where one user-typed
   * value should expand into several bare hostnames after the fix.
   * `applyDomainValueCleanup` substitutes the source entry with these
   * in order; an empty array means "drop the source entry".
   */
  cleanedSplit?: string[];
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
  if (!isDomainListConditionType(condition.type)) return [];
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

  // 0. Whitespace inside the value — caught BEFORE scheme/wildcard/etc.
  // so users who paste `a.com b.com c.com` get the right message ("split
  // with commas") instead of "non-ASCII / use punycode". This is the
  // single most common variable-driven mistake — a `DEV_DOMAINS` env
  // value with space separators resolves to one whitespace-laced string
  // which Chrome rejects atomically.
  //
  // Cleanup: split on any whitespace run and recursively sanitize each
  // chunk so the user gets canonical bare hostnames in one click. Empty
  // chunks (from leading/trailing/double whitespace) drop out. If a
  // chunk still has its own issue (port, scheme, …), inspectDomainValue
  // strips that too — the cleaned preview line stays canonical.
  if (/\s/.test(trimmed)) {
    const chunks = trimmed
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const sanitizedChunks: string[] = [];
    for (const chunk of chunks) {
      const chunkIssue = inspectDomainValue(chunk, valueIndex);
      // No issue → already canonical. Issue with cleaned → cleaned form.
      // Issue with empty cleaned → drop. cleanedSplit on a chunk should
      // never happen (chunks no longer contain whitespace) but is
      // handled defensively.
      if (!chunkIssue) sanitizedChunks.push(chunk);
      else if (chunkIssue.cleanedSplit) sanitizedChunks.push(...chunkIssue.cleanedSplit);
      else if (chunkIssue.cleaned) sanitizedChunks.push(chunkIssue.cleaned);
    }
    return {
      valueIndex,
      raw,
      kind: 'whitespace',
      cleaned: sanitizedChunks[0] ?? '',
      cleanedSplit: sanitizedChunks,
      message:
        'Whitespace inside the value — separate hostnames with a comma. requestDomains takes one bare hostname per entry.',
    };
  }

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
 * Apply every issue's cleanup suggestion to a condition's value list.
 * Issues with `cleanedSplit` expand the source entry into multiple
 * canonical hostnames; otherwise a single-string `cleaned` replacement
 * is used. Empty results drop the entry entirely. Returns a new
 * condition (does not mutate the input).
 *
 * Used by the editor's one-click "Clean up" action.
 */
export function applyDomainValueCleanup(condition: RuleCondition, issues: readonly DomainValueIssue[]): RuleCondition {
  if (issues.length === 0) return condition;
  const fixByIndex = new Map<number, string[]>();
  for (const issue of issues) {
    if (issue.cleanedSplit) fixByIndex.set(issue.valueIndex, issue.cleanedSplit);
    else fixByIndex.set(issue.valueIndex, issue.cleaned ? [issue.cleaned] : []);
  }
  const next: string[] = [];
  for (let i = 0; i < condition.values.length; i++) {
    const replacement = fixByIndex.get(i);
    if (replacement !== undefined) {
      for (const piece of replacement) {
        if (piece.length > 0) next.push(piece);
      }
    } else {
      next.push(condition.values[i]);
    }
  }
  return { ...condition, values: next };
}
