/**
 * Plain-English rule summary for the workspace-export preview modal
 * (design §5.2).
 *
 * Lives in core as a pure transform: `(rule) → SummaryFragments`. Both
 * the extension preview modal and (later) the desktop preview consume
 * the same shape. UI is the only render surface that knows about
 * Ant typography; this helper stays platform-free so tests can pin
 * exact strings.
 *
 * Security framing: the summary lists what fires + when it fires + the
 * exact target bytes. A malicious `inject` against `bank.com` should be
 * obvious from one glance — the `targets` field surfaces every domain
 * the conditions match, and the `payload` field surfaces the action's
 * literal target (script source URL, redirect URL, header name+value,
 * mock status code, etc.).
 */

import type {
  BlockRule,
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  QueryParamRule,
  RedirectRule,
  Rule,
  RuleCondition,
} from '../types/index';

/**
 * Structured summary fragments. The renderer composes these into a
 * one-line preview row + (optional) detail bullets.
 *
 * `verb` — what the action does, plain English ("Modify request headers").
 * `targets` — domains/URLs the rule matches, pulled from conditions.
 *   Empty array means the rule fires on every request the browser sees.
 * `payload` — concrete details the recipient must see to judge intent
 *   (e.g. `Set Authorization → Bearer …`, `Redirect to https://…`,
 *   `Inject script (12 KB inline JS)`, `Block`).
 * `caveats` — hard-coded warnings that fall out of the rule's shape
 *   (e.g. inject from URL, body=dynamic with embedded JS).
 */
export interface RuleSummary {
  verb: string;
  targets: string[];
  payload: string;
  caveats: string[];
}

const ACTION_VERB: Record<Rule['type'], string> = {
  header: 'Modify request/response headers',
  redirect: 'Redirect requests',
  body: 'Rewrite response body',
  inject: 'Inject code into matching pages',
  block: 'Block requests',
  delay: 'Delay requests',
  mock: 'Return a mocked response',
  'query-param': 'Modify query parameters',
};

/**
 * Conditions that scope a rule to one or more domains/URLs. Returned
 * verbatim so the preview can show exactly the strings the recipient
 * is about to install. The order of preference matches §5.2's "spot a
 * malicious inject against bank.com": domain-list conditions first
 * (most specific), URL filters / regex second.
 */
function extractTargets(conditions: readonly RuleCondition[]): string[] {
  const out: string[] = [];
  for (const c of conditions) {
    if (
      c.type === 'request-domains' ||
      c.type === 'initiator-domains' ||
      c.type === 'url-filter' ||
      c.type === 'url-regex'
    ) {
      for (const v of c.values) out.push(v);
    }
  }
  return out;
}

function summarizeHeader(rule: HeaderRule): string {
  const total = rule.action.requestHeaders.length + rule.action.responseHeaders.length;
  if (total === 0) return 'No header changes configured';
  // Show the first 2 names + count to keep the row terse.
  const first = [...rule.action.requestHeaders, ...rule.action.responseHeaders]
    .slice(0, 2)
    .map((h) => `${h.operation} ${h.headerName}${h.operation === 'remove' ? '' : ` = ${truncate(h.value ?? '', 40)}`}`);
  const suffix = total > 2 ? ` (+${total - 2} more)` : '';
  return `${first.join('; ')}${suffix}`;
}

function summarizeRedirect(rule: RedirectRule): string {
  return `Redirect to ${rule.action.redirectTo}`;
}

function summarizeInject(rule: InjectRule): string {
  const kind = rule.action.injectType === 'script' ? 'JavaScript' : 'CSS';
  if (rule.action.source === 'url' && rule.action.sourceUrl) {
    return `Load ${kind} from ${rule.action.sourceUrl}`;
  }
  const bytes = byteLength(rule.action.code);
  return `Inline ${kind} (${formatBytes(bytes)})`;
}

function summarizeBlock(_rule: BlockRule): string {
  return 'Net::ERR_BLOCKED_BY_CLIENT';
}

function summarizeDelay(rule: DelayRule): string {
  return `Delay ${rule.action.delayMs}ms before forwarding`;
}

function summarizeMock(rule: MockRule): string {
  const bytes = byteLength(rule.action.responseBody);
  return `Return ${rule.action.statusCode} (${formatBytes(bytes)} body, ${rule.action.contentType})`;
}

function summarizeBody(rule: BodyRule): string {
  const bytes = byteLength(rule.action.body);
  const resource = rule.action.resourceType === 'graphql' ? 'GraphQL' : 'REST';
  return `Replace ${resource} response body (${rule.action.bodyType}, ${formatBytes(bytes)})`;
}

function summarizeQueryParam(rule: QueryParamRule): string {
  const ops = rule.action.params.map((p) =>
    p.operation === 'remove-all' ? 'remove all' : `${p.operation} ${p.param}`,
  );
  if (ops.length === 0) return 'No query-param changes configured';
  const first = ops.slice(0, 2).join('; ');
  const suffix = ops.length > 2 ? ` (+${ops.length - 2} more)` : '';
  return `${first}${suffix}`;
}

function payloadFor(rule: Rule): string {
  switch (rule.type) {
    case 'header':
      return summarizeHeader(rule);
    case 'redirect':
      return summarizeRedirect(rule);
    case 'inject':
      return summarizeInject(rule);
    case 'block':
      return summarizeBlock(rule);
    case 'delay':
      return summarizeDelay(rule);
    case 'mock':
      return summarizeMock(rule);
    case 'body':
      return summarizeBody(rule);
    case 'query-param':
      return summarizeQueryParam(rule);
  }
}

function caveatsFor(rule: Rule): string[] {
  const out: string[] = [];
  if (rule.type === 'inject') {
    if (rule.action.source === 'url') {
      out.push('Loads code from a remote URL — review the URL host carefully.');
    } else {
      out.push('Executes inline JavaScript on every matching page.');
    }
    if (rule.action.bypassCSP) {
      out.push('Bypasses page Content-Security-Policy.');
    }
  }
  if (rule.type === 'body' && rule.action.bodyType === 'dynamic') {
    out.push('Body is computed dynamically — may execute embedded expressions.');
  }
  if (rule.type === 'mock' && rule.action.bodyType === 'dynamic') {
    out.push('Mock body is computed dynamically — may execute embedded expressions.');
  }
  return out;
}

export function summarizeRule(rule: Rule): RuleSummary {
  return {
    verb: ACTION_VERB[rule.type],
    targets: extractTargets(rule.conditions),
    payload: payloadFor(rule),
    caveats: caveatsFor(rule),
  };
}

// ── Local helpers ───────────────────────────────────────────────────

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
