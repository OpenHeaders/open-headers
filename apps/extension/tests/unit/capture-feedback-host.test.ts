/**
 * Capture-feedback host + captured-tab ledger. Asserts:
 *   - a loopback state frame replaces that backend's set and fires
 *     union-edge transitions; a full-set re-push is silent
 *   - frames from off-device wires are claimed and dropped
 *   - malformed frames are claimed without touching the ledger; rogue
 *     tabId entries are filtered
 *   - unrelated frames are left for the next handler
 *   - a closing wire drops its backend's whole set
 *   - the host HELLOs every loopback wire already up at start
 *   - union law: a tab two backends capture releases on the last drop
 */

import { TRAFFIC_CAPTURE_HELLO_TYPE, TRAFFIC_CAPTURE_STATE_TYPE } from '@openheaders/core/protocol';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type CaptureFeedbackHost, startCaptureFeedbackHost } from '@/background/capture-feedback-host';
import {
  __resetCapturedTabsForTests,
  type CapturedTabTransition,
  isTabCaptured,
  subscribeCapturedTabs,
} from '@/background/captured-tabs';

function fakeWire(backendId: string, loopback: boolean): { wire: BackendWireHandle; sent: unknown[] } {
  const sent: unknown[] = [];
  const wire: BackendWireHandle = {
    backendId,
    record: () => {
      throw new Error('record() unused by the feedback host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: (data) => {
      sent.push(data);
      return true;
    },
  };
  return { wire, sent };
}

interface Harness {
  host: CaptureFeedbackHost;
  deliver: (frame: unknown, wire: BackendWireHandle) => boolean | Promise<boolean>;
  closeWire: (wire: BackendWireHandle) => void;
  transitions: CapturedTabTransition[];
}

function makeHarness(wires: BackendWireHandle[] = []): Harness {
  let handler: InboundFrameHandler | null = null;
  const closeListeners: Array<(wire: BackendWireHandle) => void> = [];
  const transitions: CapturedTabTransition[] = [];
  const unsubscribe = subscribeCapturedTabs((event) => transitions.push(event));
  const host = startCaptureFeedbackHost({
    registerInbound: (h) => {
      handler = h;
      return () => {
        handler = null;
      };
    },
    listWires: () => wires,
    subscribeClose: (cb) => {
      closeListeners.push(cb);
      return () => {};
    },
  });
  const wrapped: CaptureFeedbackHost = {
    dispose() {
      unsubscribe();
      host.dispose();
    },
  };
  return {
    host: wrapped,
    deliver: (frame, wire) => {
      if (!handler) throw new Error('no inbound handler registered');
      return handler(frame, wire);
    },
    closeWire: (wire) => {
      for (const cb of closeListeners) cb(wire);
    },
    transitions,
  };
}

let harness: Harness | null;

beforeEach(() => {
  __resetCapturedTabsForTests();
  harness = null;
});

afterEach(() => {
  harness?.host.dispose();
});

describe('startCaptureFeedbackHost', () => {
  it('a loopback state frame replaces the set and fires union-edge transitions; a re-push is silent', async () => {
    harness = makeHarness();
    const { wire } = fakeWire('b1', true);
    expect(await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [1, 2] }, wire)).toBe(true);
    expect(isTabCaptured(1)).toBe(true);
    expect(isTabCaptured(2)).toBe(true);
    expect(harness.transitions).toEqual([
      { kind: 'captured', tabId: 1 },
      { kind: 'captured', tabId: 2 },
    ]);

    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [1, 2] }, wire);
    expect(harness.transitions).toHaveLength(2);

    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [2] }, wire);
    expect(isTabCaptured(1)).toBe(false);
    expect(harness.transitions).toEqual([
      { kind: 'captured', tabId: 1 },
      { kind: 'captured', tabId: 2 },
      { kind: 'released', tabId: 1 },
    ]);
  });

  it('frames from off-device wires are claimed and dropped', async () => {
    harness = makeHarness();
    const { wire } = fakeWire('remote', false);
    expect(await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [1] }, wire)).toBe(true);
    expect(isTabCaptured(1)).toBe(false);
    expect(harness.transitions).toEqual([]);
  });

  it('malformed frames are claimed without touching the ledger; rogue entries are filtered', async () => {
    harness = makeHarness();
    const { wire } = fakeWire('b1', true);
    expect(await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE }, wire)).toBe(true);
    expect(await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: 'nope' }, wire)).toBe(true);
    expect(harness.transitions).toEqual([]);

    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [3, -1, 1.5, 'x', null] }, wire);
    expect(isTabCaptured(3)).toBe(true);
    expect(harness.transitions).toEqual([{ kind: 'captured', tabId: 3 }]);
  });

  it('unrelated frames are left for the next handler', async () => {
    harness = makeHarness();
    const { wire } = fakeWire('b1', true);
    expect(await harness.deliver({ type: 'oh.something.else' }, wire)).toBe(false);
    expect(await harness.deliver(null, wire)).toBe(false);
  });

  it('a closing wire drops its backend whole set', async () => {
    harness = makeHarness();
    const { wire } = fakeWire('b1', true);
    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [1, 2] }, wire);
    harness.closeWire(wire);
    expect(isTabCaptured(1)).toBe(false);
    expect(isTabCaptured(2)).toBe(false);
    expect(harness.transitions.filter((t) => t.kind === 'released')).toHaveLength(2);
  });

  it('HELLOs every loopback wire already up at start; remote wires stay silent', () => {
    const loopback = fakeWire('b1', true);
    const remote = fakeWire('b2', false);
    harness = makeHarness([loopback.wire, remote.wire]);
    expect(loopback.sent).toEqual([{ type: TRAFFIC_CAPTURE_HELLO_TYPE }]);
    expect(remote.sent).toEqual([]);
  });

  it('union law: a tab two backends capture releases on the last drop only', async () => {
    harness = makeHarness();
    const a = fakeWire('b1', true);
    const b = fakeWire('b2', true);
    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [7] }, a.wire);
    await harness.deliver({ type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: [7] }, b.wire);
    expect(harness.transitions).toEqual([{ kind: 'captured', tabId: 7 }]);
    harness.closeWire(a.wire);
    expect(isTabCaptured(7)).toBe(true);
    harness.closeWire(b.wire);
    expect(isTabCaptured(7)).toBe(false);
    expect(harness.transitions).toEqual([
      { kind: 'captured', tabId: 7 },
      { kind: 'released', tabId: 7 },
    ]);
  });
});
