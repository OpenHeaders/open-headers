/**
 * Rule draft handoff — builds a `RuleDraft` from a lifecycle,
 * stashes it in the background via `createRuleDraft`, and opens the
 * workspace at `#/create/<type>/draft-<nonce>`.
 *
 * The header/redirect/delay/block CTAs scaffold from URL and method
 * only. The response and request-body CTAs additionally carry the
 * captured body (and, for responses, status + content-type), so
 * "Override Response" / "Override request body" open pre-filled with the
 * real payload the user is looking at rather than a blank mock.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type {
  ApiResourceType,
  BlockRuleDraft,
  DelayRuleDraft,
  HeaderRuleDraft,
  QueryParamRuleDraft,
  RedirectRuleDraft,
  RequestBodyRuleDraft,
  ResponseRuleDraft,
  RuleDraft,
  SseRuleDraft,
  WsRuleDraft,
} from '@openheaders/core/types';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';

/** Build a RuleDraft for a header rule pre-filled from a lifecycle. */
export function buildHeaderDraftFromRequest(
  lc: RequestLifecycle,
  header: { direction: 'request' | 'response'; headerName: string; value?: string } | undefined,
): HeaderRuleDraft {
  const method = lc.method ? [lc.method.toUpperCase()] : undefined;
  const base: HeaderRuleDraft = {
    type: 'header',
    url: lc.url,
    ...(method ? { requestMethods: method } : {}),
  };
  if (!header) return base;
  const mod = {
    operation: 'override' as const,
    headerName: header.headerName,
    value: header.value ?? '',
  };
  if (header.direction === 'request') {
    return { ...base, requestHeaders: [mod] };
  }
  return { ...base, responseHeaders: [mod] };
}

/** Build a draft for a redirect rule pointing at the SAME url — the
 *  redirectTo field opens empty so the popover's variant-aware seeding
 *  (`seedRedirectQuickDraft`) injects the domain-scoped variable
 *  reference for both the Redirect URL and Replace host CTAs. */
export function buildRedirectDraftFromRequest(lc: RequestLifecycle): RedirectRuleDraft {
  return { type: 'redirect', url: lc.url, redirectTo: '' };
}

export function buildDelayDraftFromRequest(lc: RequestLifecycle, delayMs = 1000): DelayRuleDraft {
  return { type: 'delay', url: lc.url, delayMs };
}

export function buildBlockDraftFromRequest(lc: RequestLifecycle): BlockRuleDraft {
  return { type: 'block', url: lc.url };
}

/** Pretty-print a JSON body so the editor opens already formatted —
 *  non-JSON (and unparseable) bodies pass through untouched. */
function formatDraftBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return body;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return body;
  }
}

/** Build an "override response" draft seeded from the captured response —
 *  the editor opens in network mode (the real request is still sent; only
 *  the reply is replaced), keeps the original status code (`0` sentinel),
 *  and pre-fills the real content-type and body as static data. */
export function buildResponseDraftFromRequest(
  lc: RequestLifecycle,
  captured: { responseBody?: string; contentType?: string; resourceType?: ApiResourceType },
): ResponseRuleDraft {
  const method = lc.method ? [lc.method.toUpperCase()] : undefined;
  return {
    type: 'response',
    url: lc.url,
    ...(method ? { requestMethods: method } : {}),
    responseSource: 'network',
    bodyType: 'static',
    statusCode: 0,
    responseBody: formatDraftBody(captured.responseBody ?? ''),
    contentType: captured.contentType ?? '',
    resourceType: captured.resourceType ?? 'rest',
  };
}

/** Build an "override request body" draft seeded from the captured
 *  outgoing body — the editor opens with the real payload pre-filled as
 *  a static body the user can edit in place. */
export function buildRequestBodyDraftFromRequest(
  lc: RequestLifecycle,
  captured: { requestBody?: string; resourceType?: ApiResourceType },
): RequestBodyRuleDraft {
  const method = lc.method ? [lc.method.toUpperCase()] : undefined;
  return {
    type: 'request-body',
    url: lc.url,
    ...(method ? { requestMethods: method } : {}),
    bodyType: 'static',
    requestBody: formatDraftBody(captured.requestBody ?? ''),
    resourceType: captured.resourceType ?? 'rest',
  };
}

/** Build an "override query params" draft seeded from the captured query
 *  string — each observed param becomes an `override` entry pre-filled
 *  with its current value, so the editor opens ready to retune them. */
export function buildQueryParamDraftFromRequest(
  lc: RequestLifecycle,
  captured: { params: ReadonlyArray<{ param: string; value?: string }> },
): QueryParamRuleDraft {
  const method = lc.method ? [lc.method.toUpperCase()] : undefined;
  return {
    type: 'query-param',
    url: lc.url,
    ...(method ? { requestMethods: method } : {}),
    params: captured.params.map((p) => ({ operation: 'override' as const, param: p.param, value: p.value ?? '' })),
  };
}

/** Build a ws message draft scoped to the CONNECTION, not a frame —
 *  the Messages toolbar's "Override message" action. Selector defaults
 *  only (`buildEmptyRule` parity: modify + receive); the popover is
 *  where the user narrows it down. */
export function buildWsDraftFromConnection(lc: RequestLifecycle): WsRuleDraft {
  return { type: 'ws', url: lc.url, operation: 'modify', direction: 'receive' };
}

/** Cap on the seeded `contains` filter — a frame/event payload can be
 *  huge, and a substring prefix selects the same ones a full match would. */
const MESSAGE_FILTER_SEED_MAX = 80;

/** Opcode 1 — the only frame kind whose data is an editable payload. */
const WS_TEXT_OPCODE = 1;

/** Build a ws message draft seeded from a captured frame. Direction
 *  follows the frame; text frames additionally seed a `contains` filter
 *  (truncated) and the replacement payload. Binary frames carry base64
 *  and error frames a transport message — neither is a payload the rule
 *  plane speaks, so they seed selector defaults only. */
export function buildWsDraftFromFrame(
  lc: RequestLifecycle,
  frame: { type: 'send' | 'receive' | 'error'; opcode: number; data: string },
): WsRuleDraft {
  const base: WsRuleDraft = {
    type: 'ws',
    url: lc.url,
    operation: 'modify',
    direction: frame.type === 'send' ? 'send' : 'receive',
  };
  if (frame.type === 'error' || frame.opcode !== WS_TEXT_OPCODE) return base;
  const filterValue = frame.data.trim().slice(0, MESSAGE_FILTER_SEED_MAX);
  return {
    ...base,
    ...(filterValue ? { messageFilter: { matchType: 'contains', value: filterValue } } : {}),
    payload: formatDraftBody(frame.data),
  };
}

/** Build an sse message draft scoped to the STREAM, not an event —
 *  the EventStream toolbar's "Override event" action. Selector defaults
 *  only (`buildEmptyRule` parity: modify on default `message` events);
 *  the popover is where the user narrows it down. */
export function buildSseDraftFromConnection(lc: RequestLifecycle): SseRuleDraft {
  return { type: 'sse', url: lc.url, operation: 'modify' };
}

/** Build an sse message draft seeded from a captured event. The event
 *  name gates the rule when it isn't the default (`message` = the
 *  wrapper's implicit target, so the draft omits it); the data seeds a
 *  `contains` filter (truncated) and the replacement payload — SSE data
 *  is always text, so every event is seedable. */
export function buildSseDraftFromEvent(lc: RequestLifecycle, event: { eventName: string; data: string }): SseRuleDraft {
  const filterValue = event.data.trim().slice(0, MESSAGE_FILTER_SEED_MAX);
  return {
    type: 'sse',
    url: lc.url,
    operation: 'modify',
    ...(event.eventName && event.eventName !== 'message' ? { eventName: event.eventName } : {}),
    ...(filterValue ? { messageFilter: { matchType: 'contains', value: filterValue } } : {}),
    payload: formatDraftBody(event.data),
  };
}

/**
 * Stash the draft in the background and dispatch a `create-rule` intent
 * to the workspace via the SW navigator. When a workspace tab is
 * already open, the navigator reuses it (same-window preference) and
 * delivers the intent via runtime messaging — the tab's intent router
 * fetches the stashed draft via `takeRuleDraft` and opens the editor
 * pre-filled. Otherwise a fresh workspace tab opens and its cold-path
 * router does the same via the URL-encoded intent.
 */
export async function handOffRuleDraft(draft: RuleDraft): Promise<void> {
  const res = await hostBridge.call('createRuleDraft', { draft });
  if (!res.success || !res.nonce) {
    throw new Error(res.error ?? 'Failed to create rule draft');
  }
  await openWorkspace({ kind: 'create-rule', ruleType: draft.type, draftNonce: res.nonce }, 'devpanel');
}
