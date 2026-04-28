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
import { CONDITION_META, getConditionSlotKey, isDomainListConditionType } from './condition-metadata';
import { validateHeaderName } from './headers';

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

// ── Structural validation across the condition list ─────────────
//
// The per-value `validateDomainValues` above looks inside one row.
// `validateConditionStructure` looks at the SHAPE of the rows together.
// The model is "one row per DNR slot" (see `condition-metadata.ts`):
//
//   - duplicate-slot: two rows whose slot keys are equal. For most types
//     that means same type; for header types, same `(type, headerName)`
//     pair. Only the last row's value reaches Chrome — the duplicate is
//     dead weight.
//   - mutex-conflict: two rows of DIFFERENT types that share a slot key
//     via their mutex group (today only `url-filter` + `url-regex` share
//     the `'url-pattern'` slot). Same outcome as duplicate-slot but the
//     message tells the user to pick ONE rather than merge.
//   - unsupported-by-dnr: condition types Chrome MV3 DNR has no matching
//     field for. The compiler drops them silently; the validator
//     surfaces the issue so the user knows the row ships nothing.
//
// Same contract as the domain-value validator: pure, platform-agnostic,
// suitable for the editor (inline warnings) and the SW (compile-time
// observability log + future hard gates).

export type ConditionStructuralIssueKind = 'duplicate-slot' | 'mutex-conflict' | 'unsupported-by-dnr';

export interface ConditionStructuralIssue {
  /** Row index in the condition list. */
  index: number;
  /** Index of the row that "wins" — the one whose value reaches Chrome. */
  winningIndex: number;
  type: ConditionType;
  kind: ConditionStructuralIssueKind;
  /**
   * For `duplicate-slot` and `mutex-conflict`: the slot key the rows
   * share. For header types, the key includes the lowercased header name
   * (`'response-header::set-cookie'`). For `unsupported-by-dnr`:
   * `undefined`.
   */
  slotKey?: string;
  /** Human-readable explanation suitable for inline display. */
  message: string;
}

/**
 * Walk the condition list and report every structural issue.
 *
 * Slot-conflict semantics match the compiler's `buildDnrCondition`:
 * later rows overwrite earlier rows for any given slot, so the LAST row
 * of a conflicting slot is the winner; every earlier row of the same
 * slot is reported as the loser.
 */
export function validateConditionStructure(conditions: readonly RuleCondition[]): ConditionStructuralIssue[] {
  const issues: ConditionStructuralIssue[] = [];

  // Walk once to find the last CONTRIBUTING index per slot key — that's
  // the winner. Rows that haven't claimed a slot yet (empty values, or
  // header rows with no header name) cannot be winners or losers; they're
  // mid-edit states. Otherwise an empty second row would falsely flag
  // the prior real row as overwritten.
  const lastIndexBySlot = new Map<string, number>();
  for (let i = 0; i < conditions.length; i++) {
    if (!contributesToSlot(conditions[i])) continue;
    const key = getConditionSlotKey(conditions[i]);
    if (key) lastIndexBySlot.set(key, i);
  }

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const meta = CONDITION_META[cond.type];

    // 1. Unsupported by DNR — independent of slot identity and value
    // emptiness. The user authored the row; tell them it ships nothing.
    if (meta && !meta.supportedByDnr) {
      issues.push({
        index: i,
        winningIndex: i,
        type: cond.type,
        kind: 'unsupported-by-dnr',
        message:
          'This condition type is not supported by Chrome DNR yet — the rule still saves but this row ships nothing on the wire.',
      });
      continue;
    }

    // 2. Slot conflict — same slot key as a later row. Empty rows are
    // not contestants; they can never be the loser of a slot they didn't
    // try to claim.
    if (!contributesToSlot(cond)) continue;
    const key = getConditionSlotKey(cond);
    if (!key) continue;
    const winningIndex = lastIndexBySlot.get(key);
    if (winningIndex === undefined || winningIndex === i) continue;

    const winningType = conditions[winningIndex]?.type;
    const isSameType = winningType === cond.type;
    issues.push({
      index: i,
      winningIndex,
      type: cond.type,
      slotKey: key,
      kind: isSameType ? 'duplicate-slot' : 'mutex-conflict',
      message: isSameType
        ? `Only the last ${cond.type} row applies — this row's value won't reach Chrome. Remove this row, or move its values into the row that wins.`
        : `${cond.type} and ${winningType} share a DNR slot — only the last one applies. Pick one.`,
    });
  }

  return issues;
}

/**
 * Mirror the compiler's "skip empty values" behavior. A row with no
 * non-blank values doesn't write anything to its DNR slot. Header
 * conditions also need a non-empty `headerName` to claim a slot —
 * a row with values but no name has no identity to collide on.
 */
function contributesToSlot(cond: RuleCondition): boolean {
  if (CONDITION_META[cond.type]?.perHeader && !cond.headerName?.trim()) return false;
  return cond.values.some((v) => v.trim());
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

// ── Per-type input validation ────────────────────────────────────
//
// Pre-validation of what the user types into each condition's value
// inputs. Catches mistakes Chrome would silently swallow (a url-filter
// that's actually a regex pattern; a method that doesn't exist; a regex
// that uses an RE2-incompatible feature) and surfaces them inline.
//
// Two severities:
//
//   - `error` — Chrome will reject the rule outright. The user MUST
//     fix this for the rule to apply.
//   - `warning` — the rule will compile and load, but it almost
//     certainly won't match what the user intended (typed a hostname
//     into url-filter without anchors; used a lookbehind in a regex).
//
// Out of scope: `validateDomainValues` already covers the four
// domain-list types; this validator delegates there for those rather
// than duplicating the rules.

export type ConditionValueIssueKind =
  | 'empty'
  | 'invalid-url-filter'
  | 'invalid-url-regex'
  | 'unsupported-regex-feature'
  | 'invalid-method'
  | 'invalid-resource-type'
  | 'invalid-domain-type'
  | 'invalid-header-name'
  | 'header-name-required';

export type ConditionValueSeverity = 'error' | 'warning';

export interface ConditionValueIssue {
  /**
   * Index into `condition.values` for issues that target a specific
   * value, or `-1` for issues that target the row's `headerName`.
   */
  valueIndex: number;
  /** Raw input as the user typed it. Empty string for `header-name-required`. */
  raw: string;
  kind: ConditionValueIssueKind;
  severity: ConditionValueSeverity;
  /** Human-readable message suitable for inline display. */
  message: string;
}

const VALID_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'CONNECT',
  'TRACE',
]);

const VALID_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'page',
  'xhr',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'other',
  // Chrome DNR canonical names — also accepted to avoid false flags
  // when imports use the underlying name instead of our display name.
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'object',
]);

const VALID_DOMAIN_TYPES: ReadonlySet<string> = new Set(['firstParty', 'thirdParty']);

/**
 * Validate every value in a condition's input(s). Returns issues with
 * stable indexing so the editor can spot which value drew which message.
 *
 * The dispatch is by type. Domain-list types delegate to
 * `validateDomainValues` (already covers wildcards/ports/scheme/etc.) so
 * the editor only needs one banner pipeline regardless of which type
 * the row holds.
 */
export function validateConditionValues(condition: RuleCondition): ConditionValueIssue[] {
  switch (condition.type) {
    case 'url-filter':
      return validateUrlFilter(condition.values);
    case 'url-regex':
      return validateUrlRegex(condition.values);
    case 'request-methods':
    case 'exclude-request-methods':
      return validateMethods(condition.values);
    case 'resource-types':
    case 'exclude-resource-types':
      return validateResourceTypes(condition.values);
    case 'domain-type':
      return validateDomainTypeValue(condition.values);
    case 'response-header':
    case 'exclude-response-header':
      return validateHeaderCondition(condition);
    case 'request-domains':
    case 'exclude-request-domains':
    case 'initiator-domains':
    case 'exclude-initiator-domains':
      // Already covered by `validateDomainValues` — surfaced via the
      // editor's separate `DomainIssueBanner` (with auto-cleanup),
      // so we don't double-report here.
      return [];
    default:
      return [];
  }
}

// ── url-filter ───────────────────────────────────────────────────
//
// Chrome DNR url-filter grammar (https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest):
//   * any-character wildcard
//   |  start/end anchor (single)
//   || domain anchor (paired at start)
//   ^  separator placeholder
//   everything else is literal
//
// Common mistakes we flag:
//   - empty
//   - whitespace inside (Chrome rejects)
//   - non-ASCII (Chrome rejects)
//   - looks like a regex (regex meta-chars in suspicious positions)

function validateUrlFilter(values: readonly string[]): ConditionValueIssue[] {
  const out: ConditionValueIssue[] = [];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      out.push({ valueIndex: i, raw, kind: 'empty', severity: 'error', message: 'URL pattern cannot be empty.' });
      continue;
    }
    // Templates may resolve to anything at runtime — skip lexical checks.
    if (trimmed.includes('{{') && trimmed.includes('}}')) continue;
    if (/\s/.test(trimmed)) {
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-url-filter',
        severity: 'error',
        message: 'URL pattern cannot contain whitespace — Chrome rejects rules with spaces in url-filter.',
      });
      continue;
    }
    if (/[^\x20-\x7e]/.test(trimmed)) {
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-url-filter',
        severity: 'error',
        message:
          'URL pattern contains non-ASCII characters — Chrome rejects them. Use punycode (xn--…) for IDN hostnames.',
      });
      continue;
    }
    // Soft warning: regex-looking syntax inside url-filter is a
    // very common mistake — `(`, `)`, `[`, `]`, `\d`, `+`, `?` are all
    // LITERALS in url-filter, not regex meta-chars. Flag the obvious
    // tells so the user knows to switch to URL Regex.
    if (/[()[\]+?]|\\[dwsbDWSB]/.test(trimmed)) {
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-url-filter',
        severity: 'warning',
        message:
          'This looks like a regex — in URL Pattern, characters like `(`, `[`, `+`, `?`, `\\d` are matched literally. Switch to URL Regex if you need regex syntax.',
      });
    }
  }
  return out;
}

// ── url-regex ────────────────────────────────────────────────────

const RE2_UNSUPPORTED: Array<{ probe: RegExp; label: string }> = [
  { probe: /\(\?<[=!]/, label: 'lookbehind assertions ((?<=…), (?<!…))' },
  { probe: /\(\?P</, label: 'Python-style named groups ((?P<name>…))' },
];

function validateUrlRegex(values: readonly string[]): ConditionValueIssue[] {
  const out: ConditionValueIssue[] = [];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      out.push({ valueIndex: i, raw, kind: 'empty', severity: 'error', message: 'URL regex cannot be empty.' });
      continue;
    }
    if (trimmed.includes('{{') && trimmed.includes('}}')) continue;

    // Check RE2-unsupported features BEFORE compiling. Some of them
    // (e.g. Python-style `(?P<name>…)`) also fail JS's RegExp parser,
    // so we'd otherwise lose the informative message under a generic
    // "invalid regex" error. Reporting the RE2-specific message is more
    // actionable. Lookbehinds compile under modern JS but still trip
    // RE2 — that branch isn't masked by JS, only by ordering.
    let flaggedRe2 = false;
    for (const { probe, label } of RE2_UNSUPPORTED) {
      if (probe.test(trimmed)) {
        out.push({
          valueIndex: i,
          raw,
          kind: 'unsupported-regex-feature',
          severity: 'warning',
          message: `Chrome's regex engine (RE2) does not support ${label}. The rule may fail to load.`,
        });
        flaggedRe2 = true;
        break;
      }
    }
    if (flaggedRe2) continue;

    // Hard error: doesn't compile as a regex at all. JS RegExp is mostly
    // a superset of RE2 syntax for non-lookbehind cases; if this fails,
    // RE2 will fail too.
    try {
      new RegExp(trimmed);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'invalid pattern';
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-url-regex',
        severity: 'error',
        message: `Invalid regex: ${reason}`,
      });
    }
  }
  return out;
}

// ── methods ──────────────────────────────────────────────────────

function validateMethods(values: readonly string[]): ConditionValueIssue[] {
  const out: ConditionValueIssue[] = [];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.includes('{{') && trimmed.includes('}}')) continue;
    if (!VALID_METHODS.has(trimmed.toUpperCase())) {
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-method',
        severity: 'error',
        message: `"${trimmed}" is not a valid HTTP method. Allowed: ${[...VALID_METHODS].join(', ')}.`,
      });
    }
  }
  return out;
}

// ── resource types ───────────────────────────────────────────────

function validateResourceTypes(values: readonly string[]): ConditionValueIssue[] {
  const out: ConditionValueIssue[] = [];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.includes('{{') && trimmed.includes('}}')) continue;
    if (!VALID_RESOURCE_TYPES.has(trimmed)) {
      out.push({
        valueIndex: i,
        raw,
        kind: 'invalid-resource-type',
        severity: 'error',
        message: `"${trimmed}" is not a valid resource type. Pick from the dropdown.`,
      });
    }
  }
  return out;
}

// ── domain-type ─────────────────────────────────────────────────

function validateDomainTypeValue(values: readonly string[]): ConditionValueIssue[] {
  const raw = values[0];
  if (!raw) return [];
  if (raw.includes('{{') && raw.includes('}}')) return [];
  if (!VALID_DOMAIN_TYPES.has(raw)) {
    return [
      {
        valueIndex: 0,
        raw,
        kind: 'invalid-domain-type',
        severity: 'error',
        message: `"${raw}" is not a valid domain type. Use "firstParty" or "thirdParty".`,
      },
    ];
  }
  return [];
}

// ── response-header / exclude-response-header ────────────────────

function validateHeaderCondition(cond: RuleCondition): ConditionValueIssue[] {
  const out: ConditionValueIssue[] = [];
  const headerName = (cond.headerName ?? '').trim();
  // Header NAME is required for a header condition to mean anything.
  if (!headerName) {
    out.push({
      valueIndex: -1,
      raw: '',
      kind: 'header-name-required',
      severity: 'error',
      message: 'Header name is required.',
    });
  } else if (!headerName.includes('{{')) {
    // Use the existing core/utils header-name validator — Chrome's
    // RFC 7230 token rules. Response-side conditions match incoming
    // headers, so the validator runs in `isResponse=true` mode.
    const validation = validateHeaderName(headerName, true);
    if (!validation.valid) {
      out.push({
        valueIndex: -1,
        raw: headerName,
        kind: 'invalid-header-name',
        severity: 'error',
        message: validation.message ?? 'Invalid header name.',
      });
    }
  }
  // Header VALUES are matched as substrings by Chrome and accept any
  // printable ASCII; nothing to validate beyond emptiness, which is
  // not actually an error here (an empty values array means "any value").
  return out;
}
