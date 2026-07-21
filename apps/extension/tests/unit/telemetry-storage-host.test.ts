/**
 * Telemetry storage host — the extension side of the storage-plane
 * relay (OBSERVABILITY_PLAN.md Phase 3). Asserts:
 *   - a relayed call dispatches into the shared handler maps and
 *     answers on `<type>:response` with the caller's callId
 *   - the method whitelist holds (console verbs never dispatch) and
 *     non-loopback wires are claimed and dropped (privacy gate)
 *   - storage watches are per `(wire, tab, consumer)`: invalidation
 *     notes forward point-to-point, a detach ends exactly one watch,
 *     and a wire close tears down every watch it carried
 */

import type { StorageInvalidationKind } from '@openheaders/core/bridge';
import {
  TELEMETRY_STORAGE_CALL_TYPE,
  TELEMETRY_STORAGE_CONSUMER_TYPE,
  TELEMETRY_STORAGE_DETACH_TYPE,
  TELEMETRY_STORAGE_INVALIDATION_TYPE,
} from '@openheaders/core/protocol';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { describe, expect, it } from 'vitest';

import type { HandlerMap } from '@/background/modules/message-handler/types';
import { startTelemetryStorageHost, type TelemetryStorageHost } from '@/background/telemetry-stream-host/storage-host';

const CALL_RESPONSE_TYPE = `${TELEMETRY_STORAGE_CALL_TYPE}:response`;

interface SentFrame {
  backendId: string;
  frame: Record<string, unknown>;
}

interface Harness {
  host: TelemetryStorageHost;
  sent: SentFrame[];
  wireSent: Record<string, unknown>[];
  wire: BackendWireHandle;
  offWire: BackendWireHandle;
  dispatched: Array<{ type: unknown; message: Record<string, unknown> }>;
  deliver: (frame: unknown, wire: BackendWireHandle) => Promise<boolean>;
  closeWire: (wire: BackendWireHandle) => void;
  fireInvalidation: (tabId: number, kind: StorageInvalidationKind) => void;
}

function makeWire(backendId: string, loopback: boolean, wireSent: Record<string, unknown>[]): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the storage host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: (data) => {
      wireSent.push(data);
      return true;
    },
  };
}

function makeHarness(): Harness {
  const sent: SentFrame[] = [];
  const wireSent: Record<string, unknown>[] = [];
  const dispatched: Array<{ type: unknown; message: Record<string, unknown> }> = [];
  let inbound: InboundFrameHandler | null = null;
  const closeSubscribers: Array<(wire: BackendWireHandle) => void> = [];
  const invalidationListeners: Array<(tabId: number, kind: StorageInvalidationKind) => void> = [];
  const wire = makeWire('b1', true, wireSent);
  const offWire = makeWire('b2', false, wireSent);
  const handlers: HandlerMap = {
    getDomStorageEntries: ({ message, respond }) => {
      dispatched.push({ type: message.type, message });
      respond({ entries: [{ key: 'k', value: 'v', valueLength: 1 }], truncated: false });
      return true;
    },
    consoleEval: ({ message, respond }) => {
      dispatched.push({ type: message.type, message });
      respond({ success: true });
      return true;
    },
  };
  const host = startTelemetryStorageHost({
    send: (backendId, frame) => {
      sent.push({ backendId, frame });
      return true;
    },
    registerInbound: (handler) => {
      inbound = handler;
      return () => {
        inbound = null;
      };
    },
    subscribeClose: (cb) => {
      closeSubscribers.push(cb);
      return () => undefined;
    },
    subscribeInvalidations: (listener) => {
      invalidationListeners.push(listener);
      return () => undefined;
    },
    handlers,
  });
  return {
    host,
    sent,
    wireSent,
    wire,
    offWire,
    dispatched,
    deliver: async (frame, w) => {
      if (!inbound) throw new Error('inbound handler not registered');
      return await inbound(frame, w);
    },
    closeWire: (w) => {
      for (const cb of closeSubscribers) cb(w);
    },
    fireInvalidation: (tabId, kind) => {
      for (const listener of invalidationListeners) listener(tabId, kind);
    },
  };
}

describe('startTelemetryStorageHost', () => {
  it('relays a whitelisted call into the handler map and replies with the callId', async () => {
    const h = makeHarness();
    const claimed = await h.deliver(
      {
        type: TELEMETRY_STORAGE_CALL_TYPE,
        callId: 'sc1',
        method: 'getDomStorageEntries',
        params: { tabId: 7, frameId: 0, area: 'local' },
      },
      h.wire,
    );
    expect(claimed).toBe(true);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0].message.tabId).toBe(7);
    expect(h.wireSent).toEqual([
      {
        type: CALL_RESPONSE_TYPE,
        callId: 'sc1',
        payload: { entries: [{ key: 'k', value: 'v', valueLength: 1 }], truncated: false },
      },
    ]);
    h.host.dispose();
  });

  it('never dispatches non-whitelisted methods, even when a handler exists', async () => {
    const h = makeHarness();
    await h.deliver(
      { type: TELEMETRY_STORAGE_CALL_TYPE, callId: 'sc1', method: 'consoleEval', params: { tabId: 7 } },
      h.wire,
    );
    expect(h.dispatched).toHaveLength(0);
    expect(h.wireSent).toHaveLength(0);
    h.host.dispose();
  });

  it('claims and drops frames from non-loopback wires (privacy gate)', async () => {
    const h = makeHarness();
    const claimed = await h.deliver(
      {
        type: TELEMETRY_STORAGE_CALL_TYPE,
        callId: 'sc1',
        method: 'getDomStorageEntries',
        params: { tabId: 7, frameId: 0, area: 'local' },
      },
      h.offWire,
    );
    expect(claimed).toBe(true);
    expect(h.dispatched).toHaveLength(0);
    expect(h.wireSent).toHaveLength(0);
    await h.deliver({ type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.offWire);
    h.fireInvalidation(7, 'indexeddb');
    expect(h.sent).toHaveLength(0);
    h.host.dispose();
  });

  it('forwards invalidation notes per consumer watch and honors detach + wire close', async () => {
    const h = makeHarness();
    await h.deliver({ type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    await h.deliver({ type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: 7, consumerId: 'c2' }, h.wire);
    await h.deliver({ type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: 9, consumerId: 'c3' }, h.wire);

    h.fireInvalidation(7, 'cachestorage');
    expect(h.sent.map((s) => s.frame)).toEqual([
      { type: TELEMETRY_STORAGE_INVALIDATION_TYPE, tabId: 7, consumerId: 'c1', kind: 'cachestorage' },
      { type: TELEMETRY_STORAGE_INVALIDATION_TYPE, tabId: 7, consumerId: 'c2', kind: 'cachestorage' },
    ]);

    // Detach ends exactly the named consumer's watch.
    h.sent.length = 0;
    await h.deliver({ type: TELEMETRY_STORAGE_DETACH_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    h.fireInvalidation(7, 'cachestorage');
    expect(h.sent.map((s) => s.frame.consumerId)).toEqual(['c2']);

    // A closed wire tears down every watch it carried.
    h.sent.length = 0;
    h.closeWire(h.wire);
    h.fireInvalidation(7, 'cachestorage');
    h.fireInvalidation(9, 'indexeddb');
    expect(h.sent).toHaveLength(0);
    h.host.dispose();
  });
});
