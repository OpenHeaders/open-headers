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
 * response status code, etc.).
 */

import type {
  AuthRule,
  BlockRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RedirectRule,
  RequestBodyRule,
  ResponseRule,
  Rule,
  RuleCondition,
  SseRule,
  WsRule,
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
  'request-body': 'Rewrite request body',
  inject: 'Inject code into matching pages',
  block: 'Block requests',
  delay: 'Delay requests',
  response: 'Modify the response',
  'query-param': 'Modify query parameters',
  ws: 'Modify WebSocket messages',
  sse: 'Modify server-sent events',
  auth: 'Answer authentication challenges',
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

function summarizeResponse(rule: ResponseRule): string {
  const isMock = rule.action.responseSource === 'mock';
  if (rule.action.bodyType === 'dynamic') {
    return isMock ? 'Return a synthetic response computed by JavaScript' : 'Modify the real response with JavaScript';
  }
  const bytes = formatBytes(byteLength(rule.action.responseBody));
  if (isMock) {
    return `Return ${rule.action.statusCode} (${bytes} body, ${rule.action.contentType})`;
  }
  // network + statusCode 0 keeps the real status — no number to show.
  const status = rule.action.statusCode !== 0 ? `${rule.action.statusCode} ` : '';
  return `Modify the real response → ${status}(${bytes} body)`;
}

function summarizeRequestBody(rule: RequestBodyRule): string {
  const bytes = byteLength(rule.action.requestBody);
  const resource = rule.action.resourceType === 'graphql' ? 'GraphQL' : 'REST';
  return `Replace ${resource} request body (${rule.action.bodyType}, ${formatBytes(bytes)})`;
}

function summarizeWs(rule: WsRule): string {
  const dir = rule.action.direction === 'send' ? 'outgoing' : 'incoming';
  const scope = rule.action.messageFilter ? `matching ${dir} frames` : `every ${dir} frame`;
  switch (rule.action.operation) {
    case 'drop':
      return `Drop ${scope}`;
    case 'inject':
      return `Inject ${dir} frame (${formatBytes(byteLength(rule.action.payload ?? ''))}) on ${
        rule.action.injectTrigger === 'message' ? 'matching message' : 'connection open'
      }`;
    case 'modify':
      return `Replace ${scope} with ${formatBytes(byteLength(rule.action.payload ?? ''))} payload`;
  }
}

function summarizeSse(rule: SseRule): string {
  const kind = rule.action.eventName ? `"${rule.action.eventName}" events` : 'events';
  const scope = rule.action.messageFilter ? `matching ${kind}` : `every ${kind.replace('events', 'event')}`;
  switch (rule.action.operation) {
    case 'drop':
      return `Drop ${scope}`;
    case 'inject':
      return `Inject event (${formatBytes(byteLength(rule.action.payload ?? ''))}) on ${
        rule.action.injectTrigger === 'message' ? 'matching event' : 'stream open'
      }`;
    case 'modify':
      return `Replace ${scope} with ${formatBytes(byteLength(rule.action.payload ?? ''))} payload`;
  }
}

function summarizeAuth(rule: AuthRule): string {
  // The username is identity, not secret, so it is shown; the password is
  // never surfaced — the recipient judges intent from the target domains.
  const user = rule.action.username.trim();
  return user ? `Provide credentials as "${user}"` : 'Provide credentials';
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
    case 'response':
      return summarizeResponse(rule);
    case 'request-body':
      return summarizeRequestBody(rule);
    case 'query-param':
      return summarizeQueryParam(rule);
    case 'ws':
      return summarizeWs(rule);
    case 'sse':
      return summarizeSse(rule);
    case 'auth':
      return summarizeAuth(rule);
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
  if (rule.type === 'request-body' && rule.action.bodyType === 'dynamic') {
    out.push('Request body is computed dynamically — may execute embedded expressions.');
  }
  if (rule.type === 'response' && rule.action.bodyType === 'dynamic') {
    out.push('Response body is computed dynamically — may execute embedded expressions.');
  }
  if (rule.type === 'auth') {
    out.push('Sends credentials to answer authentication challenges on matching requests.');
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
