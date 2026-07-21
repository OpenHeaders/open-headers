/**
 * Daemon proxy-capture lifeline acceptor — the workbench side of the
 * capture stream. Serves ONLY the reserved proxy partition (refuses real
 * tabs and other synthetic ids), attaches on the consumer's `subscribe`
 * handshake, streams `ready` + replay + live updates down the same port,
 * and detaches on disconnect. Mirrors the extension acceptor's contract
 * minus the browser-only concerns.
 */

import type { IncomingLifelinePort } from '@openheaders/core/awareness';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { LifecycleConsumerMessage, LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { describe, expect, it } from 'vitest';
import { acceptProxyCaptureLifeline } from '../../../src/daemon/proxy/capture-lifeline';

interface FakePort extends IncomingLifelinePort {
  posted: LifecycleWireMessage[];
  send(msg: LifecycleConsumerMessage): void;
  disconnect(): void;
}

function fakePort(name: string): FakePort {
  const posted: LifecycleWireMessage[] = [];
  const messageHandlers: Array<(m: unknown) => void> = [];
  const disconnectHandlers: Array<(info: { errorMessage?: string }) => void> = [];
  return {
    name,
    posted,
    postMessage: (m) => posted.push(m as LifecycleWireMessage),
    onMessage: (h) => messageHandlers.push(h as (m: unknown) => void),
    onDisconnect: (h) => disconnectHandlers.push(h),
    send: (msg) => {
      for (const h of messageHandlers) h(msg);
    },
    disconnect: () => {
      for (const h of disconnectHandlers) h({});
    },
  };
}

function startedUpdate(requestId: string, url: string) {
  return {
    kind: 'started' as const,
    lifecycle: {
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId,
      url,
      method: 'GET',
      resourceType: 'other' as const,
      phase: 'pending' as const,
      redirectHopCount: 0,
      redirectHops: [],
      startedAtMs: 1000,
      hopStartedAtMs: 1000,
      requestHeaders: [],
      requestHeadersProvisional: false,
      har: [],
      harBodyByHop: [],
    },
  };
}

describe('acceptProxyCaptureLifeline', () => {
  it('refuses a real browser tab and any non-proxy partition', () => {
    const hub = new RequestLifecycleHub({ store: new RequestLifecycleStore() });
    expect(acceptProxyCaptureLifeline(hub, fakePort('oh-lifecycle:5'))).toBe(false);
    expect(acceptProxyCaptureLifeline(hub, fakePort('oh-lifecycle:-1'))).toBe(false);
    expect(acceptProxyCaptureLifeline(hub, fakePort('devtools-inspector:1'))).toBe(false);
  });

  it('attaches on subscribe and replays the partition, then streams live updates', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });

    // A capture observed before any consumer attached — a warm-up
    // subscribe establishes the session floor below it first (browser
    // parity: a fresh watcher starts empty otherwise).
    const warmup = fakePort(`oh-lifecycle:${PROXY_LIFECYCLE_TAB_ID}`);
    acceptProxyCaptureLifeline(hub, warmup);
    warmup.send({ kind: 'subscribe' });
    warmup.disconnect();

    store.apply(startedUpdate('a', 'http://127.0.0.1/a'));

    const port = fakePort(`oh-lifecycle:${PROXY_LIFECYCLE_TAB_ID}`);
    expect(acceptProxyCaptureLifeline(hub, port)).toBe(true);
    port.send({ kind: 'subscribe' });

    // ready + replay of the in-session capture, synchronously.
    expect(port.posted[0]?.kind).toBe('ready');
    const replayed = port.posted.filter((m) => m.kind === 'lifecycle-update');
    expect(replayed).toHaveLength(1);

    // Provenance frame on the handshake: proxy rows retain bodies
    // out-of-row, so the consumer must know to pull them lazily.
    const sources = port.posted.filter((m) => m.kind === 'source');
    expect(sources).toEqual([{ kind: 'source', tabId: PROXY_LIFECYCLE_TAB_ID, source: 'proxy' }]);

    // A live capture after attach streams straight through.
    store.apply(startedUpdate('b', 'http://127.0.0.1/b'));
    const live = port.posted.filter((m) => m.kind === 'lifecycle-update');
    expect(live).toHaveLength(2);

    // After disconnect, further captures are not delivered to this port.
    port.disconnect();
    store.apply(startedUpdate('c', 'http://127.0.0.1/c'));
    expect(port.posted.filter((m) => m.kind === 'lifecycle-update')).toHaveLength(2);
  });

  it('routes the request-body pull to the injected handler', () => {
    const hub = new RequestLifecycleHub({ store: new RequestLifecycleStore() });
    const pulls: Array<{ requestId: string; hopIndex: number }> = [];
    const port = fakePort(`oh-lifecycle:${PROXY_LIFECYCLE_TAB_ID}`);
    acceptProxyCaptureLifeline(hub, port, (requestId, hopIndex) => pulls.push({ requestId, hopIndex }));
    port.send({ kind: 'subscribe' });
    port.send({ kind: 'request-body', requestId: 'proxy-1', hopIndex: 0 });
    expect(pulls).toEqual([{ requestId: 'proxy-1', hopIndex: 0 }]);
  });
});
