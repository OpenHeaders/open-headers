import type { RuleCondition } from '../../types/rule';
import { validateHeaderName } from '../headers';

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
