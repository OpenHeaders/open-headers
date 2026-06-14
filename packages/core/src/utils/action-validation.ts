/**
 * Pure per-type validation for `Rule.action` fields.
 *
 * Mirrors `condition-validation.ts` for the action side:
 *
 *   - `error` — Chrome's DNR / scriptable layer will reject this. Gates
 *     `isRuleComplete` so the compiler skips the rule rather than
 *     atomically failing the `updateDynamicRules` batch.
 *   - `warning` — the rule will load and run, but the value is
 *     out of spec, ignored, or commonly wrong (status code outside
 *     100-599, content-type without subtype, delay over the platform
 *     cap). Advisory only.
 *
 * Pure / platform-agnostic: no DOM, no Chrome API. The editor renders
 * the issues inline; `isRuleComplete` consults them for save-state
 * gating; future SW-side gates can refuse to compile broken values.
 *
 * Dispatch is by `rule.type`. New rule types add a case + helper here
 * and a tests block — every consumer (editor banner, isRuleComplete,
 * observability) picks the new validation up automatically.
 */

import type {
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  QueryParamRule,
  RedirectRule,
  Rule,
  SseRule,
  WsRule,
} from '../types/rule';
import { getHeaderOperationCapability, type HeaderDirection, validateHeaderName, validateHeaderValue } from './headers';

// ── Public types ────────────────────────────────────────────────

export type ActionValueIssueKind =
  | 'invalid-header-name'
  | 'invalid-header-value'
  | 'invalid-header-operation'
  | 'invalid-url'
  | 'invalid-status-code'
  | 'invalid-param-name'
  | 'delay-out-of-range'
  | 'invalid-content-type'
  | 'invalid-graphql-filter'
  | 'invalid-message-filter';

export type ActionValueSeverity = 'error' | 'warning';

export interface ActionValueIssue {
  /**
   * Stable dotted path identifier into the `action` object so editors
   * can attach issues to the right input. Examples:
   *   - `requestHeaders[0].headerName`
   *   - `responseHeaders[3].value`
   *   - `redirectTo`
   *   - `params[2].param`
   *   - `delayMs`
   *   - `responseHeaders.X-Foo`
   *   - `graphqlFilter.key`
   */
  path: string;
  /** Convenience field for list paths — index in the underlying array. */
  index?: number;
  /** Raw value as authored, useful for the banner display. */
  raw: string;
  kind: ActionValueIssueKind;
  severity: ActionValueSeverity;
  /** Human-readable explanation suitable for inline display. */
  message: string;
}

// ── Public dispatch ─────────────────────────────────────────────

/**
 * Validate every authored action field on a rule. Pure dispatch by
 * `rule.type` — adding a rule type means adding a case + helper.
 *
 * The function takes a full or partial rule shape (`uid`/`path` may
 * be missing during draft authoring). Validators read only `action`
 * and, where cross-validation is meaningful, `conditions`.
 */
export function validateActionValues(rule: Rule | Omit<Rule, 'uid' | 'path'>): ActionValueIssue[] {
  switch (rule.type) {
    case 'header':
      return validateHeaderAction(rule as HeaderRule);
    case 'redirect':
      return validateRedirectAction(rule as RedirectRule);
    case 'block':
      // Block actions have no fields — nothing to validate.
      return [];
    case 'delay':
      return validateDelayAction(rule as DelayRule);
    case 'inject':
      return validateInjectAction(rule as InjectRule);
    case 'mock':
      return validateMockAction(rule as MockRule);
    case 'body':
      return validateBodyAction(rule as BodyRule);
    case 'query-param':
      return validateQueryParamAction(rule as QueryParamRule);
    case 'ws':
    case 'sse':
      return validateMessageAction((rule as WsRule | SseRule).action);
    default:
      return [];
  }
}

// ── header ──────────────────────────────────────────────────────
//
// Header rules are the most demanding: every modification has a name,
// an operation, and (sometimes) a value, and Chrome rejects invalid
// combinations atomically. The capability check is shared with the
// editor's existing inline warning, so placing it here too means
// `isRuleComplete` and the inline warning never disagree.

function validateHeaderAction(rule: HeaderRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  const groups: Array<{
    mods: HeaderRule['action']['requestHeaders'];
    field: 'requestHeaders' | 'responseHeaders';
    isResponse: boolean;
  }> = [
    { mods: rule.action.requestHeaders ?? [], field: 'requestHeaders', isResponse: false },
    { mods: rule.action.responseHeaders ?? [], field: 'responseHeaders', isResponse: true },
  ];

  for (const { mods, field, isResponse } of groups) {
    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i];
      const direction: HeaderDirection = isResponse ? 'response' : 'request';
      const headerName = (mod.headerName ?? '').trim();

      // Empty name is structural — caught by isRuleComplete elsewhere.
      // Skip template-laced names; they may resolve to anything at
      // runtime and Chrome's DNR rejects the literal `{{}}`, not the
      // resolved form. The compiler's `buildMod` skips them too.
      if (headerName && !headerName.includes('{{')) {
        const nameValidation = validateHeaderName(headerName, isResponse);
        if (!nameValidation.valid) {
          out.push({
            path: `${field}[${i}].headerName`,
            index: i,
            raw: headerName,
            kind: 'invalid-header-name',
            severity: 'error',
            message: nameValidation.message ?? 'Invalid header name.',
          });
        }
      }

      // Capability check — `append` on a non-allowlisted header,
      // `set` on a forbidden header, etc. Chrome rejects these.
      const capability = getHeaderOperationCapability(direction, mod.operation, headerName);
      if (!capability.allowed) {
        out.push({
          path: `${field}[${i}].operation`,
          index: i,
          raw: mod.operation,
          kind: 'invalid-header-operation',
          severity: 'error',
          message: capability.reason ?? `Operation '${mod.operation}' is not allowed for "${headerName}".`,
        });
      }

      // Value validation — only when the operation actually carries a
      // value. `remove` carries none. Templates pass through.
      if (mod.operation !== 'remove') {
        const value = mod.value ?? '';
        if (value.trim() && !value.includes('{{')) {
          const valueValidation = validateHeaderValue(value, headerName);
          if (!valueValidation.valid) {
            out.push({
              path: `${field}[${i}].value`,
              index: i,
              raw: value,
              kind: 'invalid-header-value',
              severity: 'error',
              message: valueValidation.message ?? 'Invalid header value.',
            });
          }
        }
      }
    }
  }

  return out;
}

// ── redirect ────────────────────────────────────────────────────
//
// `redirectTo` semantics depend on the rule's URL-matching condition:
//
//   - With a `url-regex` condition, Chrome treats the target as a regex
//     substitution, where `\0`, `\1`, … reference matched groups. We
//     don't validate substitution syntax beyond "no whitespace" because
//     RE2's substitution language differs subtly from JS's.
//   - With anything else, it must be a fully qualified http(s) URL,
//     a `chrome-extension://` URL, or a path starting with `/`.

function validateRedirectAction(rule: RedirectRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  const target = (rule.action.redirectTo ?? '').trim();
  if (!target) return out; // empty is structural — gated by isRuleComplete
  if (target.includes('{{')) return out; // template

  const hasRegexCondition = (rule.conditions ?? []).some(
    (c) => c.type === 'url-regex' && c.values.some((v) => v.trim()),
  );

  if (/\s/.test(target)) {
    out.push({
      path: 'redirectTo',
      raw: target,
      kind: 'invalid-url',
      severity: 'error',
      message: 'Redirect target cannot contain whitespace.',
    });
    return out;
  }

  if (!hasRegexCondition && !isAcceptableRedirectUrl(target)) {
    out.push({
      path: 'redirectTo',
      raw: target,
      kind: 'invalid-url',
      severity: 'error',
      message: 'Redirect target must be a full URL (http://, https://, chrome-extension://) or a path starting with /.',
    });
  }
  return out;
}

function isAcceptableRedirectUrl(target: string): boolean {
  if (target.startsWith('/')) return true;
  try {
    const u = new URL(target);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'chrome-extension:';
  } catch {
    return false;
  }
}

// ── query-param ─────────────────────────────────────────────────
//
// Param NAMES are the only validatable surface — values can legitimately
// be anything (including URL-encoded strings). The reserved characters
// `& = # ?` and whitespace are unambiguous mistakes; if a user typed
// them they almost certainly meant something else.

function validateQueryParamAction(rule: QueryParamRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  const params = rule.action.params ?? [];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p.operation === 'remove-all') continue; // no key for remove-all
    const param = (p.param ?? '').trim();
    if (!param) continue; // structural — caught by isRuleComplete
    if (param.includes('{{')) continue;
    if (/[&=#?\s]/.test(param)) {
      out.push({
        path: `params[${i}].param`,
        index: i,
        raw: param,
        kind: 'invalid-param-name',
        severity: 'error',
        message: 'Param name cannot contain `&`, `=`, `#`, `?`, or whitespace.',
      });
    }
  }
  return out;
}

// ── inject ──────────────────────────────────────────────────────
//
// Code-mode injections are arbitrary user JS/CSS — we don't try to
// parse them. URL-mode injections need a parseable absolute URL.

function validateInjectAction(rule: InjectRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  if (rule.action.source !== 'url') return out;
  const url = (rule.action.sourceUrl ?? '').trim();
  if (!url || url.includes('{{')) return out;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'chrome-extension:') {
      out.push({
        path: 'sourceUrl',
        raw: url,
        kind: 'invalid-url',
        severity: 'error',
        message: 'Source URL must use http://, https://, or chrome-extension://.',
      });
    }
  } catch {
    out.push({
      path: 'sourceUrl',
      raw: url,
      kind: 'invalid-url',
      severity: 'error',
      message: 'Source URL is not a valid URL.',
    });
  }
  return out;
}

// ── delay ───────────────────────────────────────────────────────
//
// Two execution paths with different caps:
//   - main_frame DNR redirect → 30s ceiling (`DNR_DELAY_MAX_MS`)
//   - JS XHR/fetch monkey-patch → 5s ceiling (avoids HTTP
//     connection-pool starvation)
// We warn rather than error because the compiler clamps anyway.

const DNR_DELAY_MAX_MS = 30_000;
const SCRIPTABLE_DELAY_MAX_MS = 5_000;

function validateDelayAction(rule: DelayRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  const ms = rule.action.delayMs;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return out;
  if (ms <= 0) return out; // structural — gated by isRuleComplete
  if (ms > DNR_DELAY_MAX_MS) {
    out.push({
      path: 'delayMs',
      raw: String(ms),
      kind: 'delay-out-of-range',
      severity: 'warning',
      message: `Main-frame delay is capped at ${DNR_DELAY_MAX_MS}ms; values above are clamped on the wire.`,
    });
  } else if (ms > SCRIPTABLE_DELAY_MAX_MS) {
    out.push({
      path: 'delayMs',
      raw: String(ms),
      kind: 'delay-out-of-range',
      severity: 'warning',
      message: `XHR/fetch monkey-patch caps delays at ${SCRIPTABLE_DELAY_MAX_MS}ms to avoid HTTP connection-pool starvation. Main-frame redirects honor up to ${DNR_DELAY_MAX_MS}ms.`,
    });
  }
  return out;
}

// ── mock ────────────────────────────────────────────────────────
//
// Mock has the most fields: status code, headers map, content type,
// body, optional graphql filter. We validate everything Chrome's
// scriptable response handler treats as structurally meaningful.

const CONTENT_TYPE_PATTERN = /^[a-z]+\/[a-z0-9.+-]+(?:\s*;\s*[\w.-]+\s*=\s*[\w."'.\-/+]+)*$/i;

function validateMockAction(rule: MockRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];

  const sc = rule.action.statusCode;
  // `0` is the "keep original status code" sentinel — the response keeps
  // whatever the real server returned, so it is not a wire status code.
  if (typeof sc === 'number' && Number.isFinite(sc) && sc !== 0 && (sc < 100 || sc > 599 || !Number.isInteger(sc))) {
    out.push({
      path: 'statusCode',
      raw: String(sc),
      kind: 'invalid-status-code',
      severity: 'error',
      message: 'Status code must be an integer 100-599.',
    });
  }

  const ct = (rule.action.contentType ?? '').trim();
  if (ct && !ct.includes('{{') && !CONTENT_TYPE_PATTERN.test(ct)) {
    out.push({
      path: 'contentType',
      raw: ct,
      kind: 'invalid-content-type',
      severity: 'warning',
      message: 'Content type should look like "type/subtype" (e.g. application/json).',
    });
  }

  const headers = rule.action.responseHeaders ?? {};
  for (const [name] of Object.entries(headers)) {
    if (!name) continue;
    if (name.includes('{{')) continue;
    const v = validateHeaderName(name, true);
    if (!v.valid) {
      out.push({
        path: `responseHeaders.${name}`,
        raw: name,
        kind: 'invalid-header-name',
        severity: 'error',
        message: v.message ?? 'Invalid response header name.',
      });
    }
  }

  if (rule.action.resourceType === 'graphql' && rule.action.graphqlFilter) {
    const f = rule.action.graphqlFilter;
    if (!f.key?.trim()) {
      out.push({
        path: 'graphqlFilter.key',
        raw: '',
        kind: 'invalid-graphql-filter',
        severity: 'error',
        message: 'GraphQL filter key is required.',
      });
    }
  }

  return out;
}

// ── ws / sse ────────────────────────────────────────────────────
//
// Payload content is opaque (any frame/event data is legal). The
// validatable surfaces are the message filter — a 'regex' filter the
// page-side wrapper can't compile means the rule silently never fires —
// and the inject trigger: 'message' without a filter has no frame to
// react to.

function validateMessageAction(action: WsRule['action'] | SseRule['action']): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];

  const filter = action.messageFilter;
  if (filter) {
    const value = (filter.value ?? '').trim();
    if (!value) {
      out.push({
        path: 'messageFilter.value',
        raw: '',
        kind: 'invalid-message-filter',
        severity: 'error',
        message: 'Message filter value is required when a filter is configured.',
      });
    } else if (filter.matchType === 'regex' && !value.includes('{{')) {
      try {
        new RegExp(value, 'i');
      } catch {
        out.push({
          path: 'messageFilter.value',
          raw: value,
          kind: 'invalid-message-filter',
          severity: 'error',
          message: 'Message filter is not a valid regular expression.',
        });
      }
    }
  }

  if (action.operation === 'inject' && action.injectTrigger === 'message' && !filter) {
    out.push({
      path: 'injectTrigger',
      raw: 'message',
      kind: 'invalid-message-filter',
      severity: 'error',
      message: 'Injecting after a matching message requires a message filter.',
    });
  }

  return out;
}

// ── body ────────────────────────────────────────────────────────
//
// Body content is opaque to us. The only validatable surface is the
// optional graphql filter shape.

function validateBodyAction(rule: BodyRule): ActionValueIssue[] {
  const out: ActionValueIssue[] = [];
  if (rule.action.resourceType === 'graphql' && rule.action.graphqlFilter) {
    const f = rule.action.graphqlFilter;
    if (!f.key?.trim()) {
      out.push({
        path: 'graphqlFilter.key',
        raw: '',
        kind: 'invalid-graphql-filter',
        severity: 'error',
        message: 'GraphQL filter key is required.',
      });
    }
  }
  return out;
}
