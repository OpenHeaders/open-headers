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
      { kind: 'enable-fetch', patterns: [API_PATTERN] },
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
      { kind: 'enable-fetch', patterns: next.fetchPatterns },
    ]);
  });

  it('a replay from empty re-issues the whole standing set', () => {
    const armed = state({
      cacheDisabled: true,
      networkConditions: SLOW_3G,
      bypassCsp: true,
      fetchPatterns: [API_PATTERN],
    });
    expect(reconcileTabControl(EMPTY_TAB_CONTROL_STATE, armed)).toEqual([
      { kind: 'set-cache-disabled', cacheDisabled: true },
      { kind: 'emulate-network-conditions', conditions: SLOW_3G },
      { kind: 'set-bypass-csp', enabled: true },
      { kind: 'enable-fetch', patterns: [API_PATTERN] },
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
  it('records fulfill / continue / answer-auth reactions in order', async () => {
    const port = createInMemoryRequestControlPort();
    await port.fulfill(TARGET, { requestId: 'r1', responseCode: 200 });
    await port.continueRequest(TARGET, { requestId: 'r2' });
    await port.continueWithAuth(TARGET, { requestId: 'r3', authChallengeResponse: { response: 'CancelAuth' } });
    expect(port.reactions.map((r) => r.kind)).toEqual(['fulfill', 'continue', 'continue-with-auth']);
  });
});
