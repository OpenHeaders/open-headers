/**
 * Backend connection manager — inbound frame serialization.
 *
 * A catch-up replay streams one frame per logged mutation. Dispatching
 * them concurrently races every apply for the same entity onto one
 * FIFO Web Lock, and anything queued past the lock timeout throws and
 * drops that mutation for the session (surfaced live: a real backend's
 * accumulated log produced hundreds of concurrent applies on one rule's
 * lock). Frames on one wire must be processed strictly in arrival
 * order, each waiting for the previous frame's handlers to finish.
 */
import { __clearBackendsForTests, refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { type HostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  connectWebSocket,
  installBackendConnectionManager,
  registerInboundFrameHandler,
} from '../../../src/sync/client/backend-connection-manager';

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e?: { code?: number; reason?: string }) => void) | null = null;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  fireOpen(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  deliver(frame: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

function backendRecord(): BackendConnection {
  return {
    id: 'wire-serialization-backend',
    label: 'openheaders.io daemon',
    url: 'ws://127.0.0.1:59210',
    authToken: 'oh_test-token',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-10T00:00:00.000Z',
    lastConnectedAt: null,
  };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('until: condition never became true');
}

describe('backend-connection-manager inbound serialization', () => {
  const cleanups: Array<() => void> = [];
  const sockets: FakeSocket[] = [];

  beforeEach(async () => {
    const fake = createHostStorageFake();
    setHostStorage(fake);
    await fake.set(OH.backends, [backendRecord()]);
    await refreshBackendsFromHostStorage();
    installBackendConnectionManager({
      probeReachable: () => Promise.resolve(true),
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      getReconnectDelayMs: () => 60_000,
      getMaxReconnectDelayMs: () => 60_000,
      getPingIntervalMs: () => 60_000,
    });
  });

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    // Retire the wire so the next test's reconcile starts clean.
    __clearBackendsForTests();
    await connectWebSocket();
    sockets.length = 0;
  });

  it('processes frames on one wire strictly in arrival order, one at a time', async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    cleanups.push(
      registerInboundFrameHandler(async (frame) => {
        const { seq } = frame as { seq: number };
        events.push(`start:${seq}`);
        if (seq === 1) await firstGate;
        events.push(`end:${seq}`);
        return true;
      }),
    );

    await connectWebSocket();
    await until(() => sockets.length === 1);
    sockets[0].fireOpen();

    sockets[0].deliver({ seq: 1 });
    sockets[0].deliver({ seq: 2 });
    sockets[0].deliver({ seq: 3 });

    // Frame 1 is parked on its gate — later frames must NOT start.
    await until(() => events.includes('start:1'));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toEqual(['start:1']);

    releaseFirst();
    await until(() => events.includes('end:3'));
    expect(events).toEqual(['start:1', 'end:1', 'start:2', 'end:2', 'start:3', 'end:3']);
  });
});
