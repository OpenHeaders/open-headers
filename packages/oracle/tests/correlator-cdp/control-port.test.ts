/**
 * CDP control-plane vocabulary — the pure {@link reconcileTabControl} diff
 * and the in-memory port doubles.
 *
 * The diff is the host-neutral heart of the declarative tab-control port:
 * only changed fields emit commands, an unchanged re-apply is empty, and a
 * replay from {@link EMPTY_TAB_CONTROL_STATE} re-issues the whole set — the
 * §4.6 replay-over-persistence law, proven without a `chrome.debugger`
 * transport.
 */

import { describe, expect, it } from 'vitest';

import {
  type CdpFetchPattern,
  type CdpNetworkConditions,
  type CdpTabControlState,
  EMPTY_TAB_CONTROL_STATE,
  reconcileTabControl,
} from '../../src/correlator-cdp/control-port';
import {
  createInMemoryRequestControlPort,
  createInMemoryTabControlPort,
  type RecordedReaction,
} from '../../src/correlator-cdp/in-memory-control-port';

const SLOW_3G: CdpNetworkConditions = {
  offline: false,
  latencyMs: 400,
  downloadThroughputBps: 50_000,
  uploadThroughputBps: 50_000,
};

function state(overrides: Partial<CdpTabControlState> = {}): CdpTabControlState {
  return { ...EMPTY_TAB_CONTROL_STATE, ...overrides };
}

const API_PATTERN: CdpFetchPattern = { urlPattern: '*://openheaders.io/api/*', requestStage: 'Request' };

const TARGET = { tabId: 7, sessionId: 'page' };

describe('reconcileTabControl', () => {
  it('an unchanged state diffs to no commands', () => {
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, EMPTY_TAB_CONTROL_STATE)).toEqual([]);
    const armed = state({ cacheDisabled: true, bypassCsp: true });
    expect(reconcileTabControl(armed, armed)).toEqual([]);
  });

  it('emits set-cache-disabled only when the flag changes', () => {
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, state({ cacheDisabled: true }))).toEqual([
      { kind: 'set-cache-disabled', cacheDisabled: true },
    ]);
    expect(reconcileTabControl(state({ cacheDisabled: true }), EMPTY_TAB_CONTROL_STATE)).toEqual([
      { kind: 'set-cache-disabled', cacheDisabled: false },
    ]);
  });

  it('emits emulate then clear as network conditions appear and vanish', () => {
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, state({ networkConditions: SLOW_3G }))).toEqual([
      { kind: 'emulate-network-conditions', conditions: SLOW_3G },
    ]);
    expect(reconcileTabControl(state({ networkConditions: SLOW_3G }), EMPTY_TAB_CONTROL_STATE)).toEqual([
      { kind: 'clear-network-conditions' },
    ]);
  });

  it('treats equal-valued network conditions as unchanged (structural, not identity)', () => {
    const a = state({ networkConditions: { ...SLOW_3G } });
    const b = state({ networkConditions: { ...SLOW_3G } });
    expect(reconcileTabControl(a, b)).toEqual([]);
  });

  it('re-emulates when a network-condition field changes', () => {
    const fast = state({ networkConditions: { ...SLOW_3G, offline: true } });
    expect(reconcileTabControl(state({ networkConditions: SLOW_3G }), fast)).toEqual([
      { kind: 'emulate-network-conditions', conditions: { ...SLOW_3G, offline: true } },
    ]);
  });

  it('emits set-bypass-csp only when it changes', () => {
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, state({ bypassCsp: true }))).toEqual([
      { kind: 'set-bypass-csp', enabled: true },
    ]);
  });

  it('emits enable-fetch when patterns appear and disable-fetch when they vanish', () => {
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, state({ fetchPatterns: [API_PATTERN] }))).toEqual([
      { kind: 'enable-fetch', patterns: [API_PATTERN], handleAuthRequests: false },
    ]);
    expect(reconcileTabControl(state({ fetchPatterns: [API_PATTERN] }), EMPTY_TAB_CONTROL_STATE)).toEqual([
      { kind: 'disable-fetch' },
    ]);
  });

  it('treats equal-valued fetch patterns as unchanged (structural, not identity)', () => {
    const a = state({ fetchPatterns: [{ ...API_PATTERN }] });
    const b = state({ fetchPatterns: [{ ...API_PATTERN }] });
    expect(reconcileTabControl(a, b)).toEqual([]);
  });

  it('re-enables fetch when the pattern set changes', () => {
    const next = state({ fetchPatterns: [API_PATTERN, { urlPattern: '*://openheaders.io/auth' }] });
    expect(reconcileTabControl(state({ fetchPatterns: [API_PATTERN] }), next)).toEqual([
      { kind: 'enable-fetch', patterns: next.fetchPatterns, handleAuthRequests: false },
    ]);
  });

  it('carries handleAuthRequests on enable-fetch when an auth-capable rule is in scope', () => {
    expect(
      reconcileTabControl(
        EMPTY_TAB_CONTROL_STATE,
        state({ fetchPatterns: [API_PATTERN], fetchHandleAuthRequests: true }),
      ),
    ).toEqual([{ kind: 'enable-fetch', patterns: [API_PATTERN], handleAuthRequests: true }]);
  });

  it('re-enables fetch when only the auth flag flips on a non-empty pattern set', () => {
    const prev = state({ fetchPatterns: [API_PATTERN], fetchHandleAuthRequests: false });
    const next = state({ fetchPatterns: [API_PATTERN], fetchHandleAuthRequests: true });
    expect(reconcileTabControl(prev, next)).toEqual([
      { kind: 'enable-fetch', patterns: [API_PATTERN], handleAuthRequests: true },
    ]);
  });

  it('an auth-flag flip on an empty pattern set is a no-op (nothing to intercept)', () => {
    const prev = state({ fetchHandleAuthRequests: false });
    const next = state({ fetchHandleAuthRequests: true });
    expect(reconcileTabControl(prev, next)).toEqual([]);
  });

  it('a replay from empty re-issues the whole standing set', () => {
    const armed = state({
      cacheDisabled: true,
      networkConditions: SLOW_3G,
      bypassCsp: true,
      fetchPatterns: [API_PATTERN],
      fetchHandleAuthRequests: true,
    });
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, armed)).toEqual([
      { kind: 'set-cache-disabled', cacheDisabled: true },
      { kind: 'emulate-network-conditions', conditions: SLOW_3G },
      { kind: 'set-bypass-csp', enabled: true },
      { kind: 'enable-fetch', patterns: [API_PATTERN], handleAuthRequests: true },
    ]);
  });
});

describe('createInMemoryTabControlPort', () => {
  it('records each apply with the commands the diff produced', async () => {
    const port = createInMemoryTabControlPort();
    await port.apply(TARGET, state({ cacheDisabled: true }));
    expect(port.applied).toHaveLength(1);
    expect(port.applied[0]?.commands).toEqual([{ kind: 'set-cache-disabled', cacheDisabled: true }]);
  });

  it('diffs against the per-target last-applied state — a second apply is incremental', async () => {
    const port = createInMemoryTabControlPort();
    await port.apply(TARGET, state({ cacheDisabled: true }));
    await port.apply(TARGET, state({ cacheDisabled: true, bypassCsp: true }));
    expect(port.applied[1]?.commands).toEqual([{ kind: 'set-bypass-csp', enabled: true }]);
  });

  it('forget resets the memory so the next apply replays the whole state', async () => {
    const port = createInMemoryTabControlPort();
    await port.apply(TARGET, state({ cacheDisabled: true }));
    port.forget(TARGET);
    expect(port.forgotten).toEqual([TARGET]);
    await port.apply(TARGET, state({ cacheDisabled: true }));
    // Re-issued (not skipped as unchanged) because forget cleared the prev.
    expect(port.applied[1]?.commands).toEqual([{ kind: 'set-cache-disabled', cacheDisabled: true }]);
  });

  it('keys last-applied state by (tabId, sessionId) — child sessions diff independently', async () => {
    const port = createInMemoryTabControlPort();
    const child = { tabId: 7, sessionId: 'child-worker-1' };
    await port.apply(TARGET, state({ cacheDisabled: true }));
    await port.apply(child, state({ cacheDisabled: true }));
    // The child has no prior state, so it re-issues despite the root match.
    expect(port.applied[1]?.commands).toEqual([{ kind: 'set-cache-disabled', cacheDisabled: true }]);
  });
});

describe('createInMemoryRequestControlPort', () => {
  it('records fulfill / continue / continue-response / answer-auth reactions in order', async () => {
    const port = createInMemoryRequestControlPort();
    await port.fulfill(TARGET, { requestId: 'r1', responseCode: 200 });
    await port.continueRequest(TARGET, { requestId: 'r2' });
    await port.continueResponse(TARGET, { requestId: 'r2b' });
    await port.continueWithAuth(TARGET, { requestId: 'r3', authChallengeResponse: { response: 'CancelAuth' } });
    expect(port.reactions.map((r) => r.kind)).toEqual([
      'fulfill',
      'continue',
      'continue-response',
      'continue-with-auth',
    ]);
  });

  it('records a getResponseBody call and answers from the scripted FIFO queue (D2b-2b)', async () => {
    const port = createInMemoryRequestControlPort();
    port.enqueueResponseBody({ body: 'first', base64Encoded: false });
    port.enqueueResponseBody({ body: 'second', base64Encoded: true });

    expect(await port.getResponseBody(TARGET, { requestId: 'r4' })).toEqual({ body: 'first', base64Encoded: false });
    expect(await port.getResponseBody(TARGET, { requestId: 'r5' })).toEqual({ body: 'second', base64Encoded: true });
    const isRead = (r: RecordedReaction): r is Extract<RecordedReaction, { kind: 'get-response-body' }> =>
      r.kind === 'get-response-body';
    expect(port.reactions.filter(isRead).map((r) => r.request.requestId)).toEqual(['r4', 'r5']);
  });

  it('defaults an unscripted getResponseBody to an empty body (so the eval still runs)', async () => {
    const port = createInMemoryRequestControlPort();
    expect(await port.getResponseBody(TARGET, { requestId: 'r6' })).toEqual({ body: '', base64Encoded: false });
  });

  it('rejects a getResponseBody scripted to fail (the unreadable-body path)', async () => {
    const port = createInMemoryRequestControlPort();
    port.rejectNextResponseBody('no resource with given identifier');
    await expect(port.getResponseBody(TARGET, { requestId: 'r7' })).rejects.toThrow(
      'no resource with given identifier',
    );
  });

  it('records a getRequestPostData call and answers from the scripted FIFO queue (D2b-2c)', async () => {
    const port = createInMemoryRequestControlPort();
    port.enqueueRequestPostData({ postData: 'first' });
    port.enqueueRequestPostData({ postData: 'second' });

    expect(await port.getRequestPostData(TARGET, { requestId: 'p1' })).toEqual({ postData: 'first' });
    expect(await port.getRequestPostData(TARGET, { requestId: 'p2' })).toEqual({ postData: 'second' });
    const isRead = (r: RecordedReaction): r is Extract<RecordedReaction, { kind: 'get-request-post-data' }> =>
      r.kind === 'get-request-post-data';
    expect(port.reactions.filter(isRead).map((r) => r.request.requestId)).toEqual(['p1', 'p2']);
  });

  it('defaults an unscripted getRequestPostData to an empty body', async () => {
    const port = createInMemoryRequestControlPort();
    expect(await port.getRequestPostData(TARGET, { requestId: 'p3' })).toEqual({ postData: '' });
  });

  it('rejects a getRequestPostData scripted to fail (the unreadable-body path)', async () => {
    const port = createInMemoryRequestControlPort();
    port.rejectNextRequestPostData('Request body has unsupported encoding');
    await expect(port.getRequestPostData(TARGET, { requestId: 'p4' })).rejects.toThrow(
      'Request body has unsupported encoding',
    );
  });
});
