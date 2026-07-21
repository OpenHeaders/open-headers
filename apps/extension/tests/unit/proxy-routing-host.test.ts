/**
 * Proxy routing host — the extension side of scoped browser routing
 * (OBSERVABILITY_PLAN.md §5.1). Asserts:
 *   - a pushed state persists, applies through the adapter, and acks
 *     with the adapter's mode on the delivering wire
 *   - non-loopback wires are claimed and dropped (the capture port is
 *     loopback-bound)
 *   - malformed state frames are ignored
 *   - an adapter failure acks applied:false with the error
 *   - hello is pulled on every loopback wire already up at start
 *   - applies run in arrival order (a stale apply never overwrites a
 *     newer verdict)
 */

import { PROXY_ROUTING_ACK_TYPE, PROXY_ROUTING_HELLO_TYPE, PROXY_ROUTING_STATE_TYPE } from '@openheaders/core/protocol';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { describe, expect, it } from 'vitest';
import { startProxyRoutingHost } from '@/background/proxy-routing-host';
import type { ProxyRoutingAdapter, ProxyRoutingState } from '@/background/proxy-routing-host/apply';

function makeWire(backendId: string, loopback: boolean, wireSent: Record<string, unknown>[]): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the routing host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: (data) => {
      wireSent.push(data);
      return true;
    },
  };
}

interface Harness {
  wireSent: Record<string, unknown>[];
  wire: BackendWireHandle;
  offWire: BackendWireHandle;
  applied: ProxyRoutingState[];
  saved: ProxyRoutingState[];
  deliver: (frame: unknown, wire: BackendWireHandle) => boolean | Promise<boolean>;
  dispose: () => void;
}

function makeHarness(
  options: { apply?: ProxyRoutingAdapter['apply']; persisted?: ProxyRoutingState | null } = {},
): Harness {
  const wireSent: Record<string, unknown>[] = [];
  const applied: ProxyRoutingState[] = [];
  const saved: ProxyRoutingState[] = [];
  let inbound: InboundFrameHandler | null = null;
  const wire = makeWire('b1', true, wireSent);
  const offWire = makeWire('b2', false, wireSent);
  const adapter: ProxyRoutingAdapter = {
    mode: 'pac',
    apply:
      options.apply ??
      (async (state) => {
        applied.push(state);
        return { applied: true };
      }),
  };
  const host = startProxyRoutingHost({
    adapter,
    registerInbound: (handler) => {
      inbound = handler;
      return () => {
        inbound = null;
      };
    },
    listWires: () => [wire, offWire],
    loadState: async () => options.persisted ?? null,
    saveState: async (state) => {
      saved.push(state);
    },
  });
  return {
    wireSent,
    wire,
    offWire,
    applied,
    saved,
    deliver: (frame, target) => {
      if (inbound === null) throw new Error('inbound handler not registered');
      return inbound(frame, target);
    },
    dispose: () => host.dispose(),
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const STATE_FRAME = {
  type: PROXY_ROUTING_STATE_TYPE,
  enabled: true,
  port: 8139,
  scopePatterns: ['openheaders.io'],
};

describe('proxy routing host', () => {
  it('sends hello on loopback wires already up at start', () => {
    const h = makeHarness();
    expect(h.wireSent).toEqual([{ type: PROXY_ROUTING_HELLO_TYPE }]);
    h.dispose();
  });

  it('applies a pushed state, persists it, and acks with the adapter mode', async () => {
    const h = makeHarness();
    h.wireSent.length = 0;
    expect(h.deliver(STATE_FRAME, h.wire)).toBe(true);
    await settle();
    expect(h.applied).toEqual([{ enabled: true, port: 8139, scopePatterns: ['openheaders.io'] }]);
    expect(h.saved).toEqual([{ enabled: true, port: 8139, scopePatterns: ['openheaders.io'] }]);
    expect(h.wireSent).toEqual([{ type: PROXY_ROUTING_ACK_TYPE, applied: true, mode: 'pac' }]);
    h.dispose();
  });

  it('claims and drops state frames from non-loopback wires', async () => {
    const h = makeHarness();
    h.wireSent.length = 0;
    expect(h.deliver(STATE_FRAME, h.offWire)).toBe(true);
    await settle();
    expect(h.applied).toEqual([]);
    expect(h.wireSent).toEqual([]);
    h.dispose();
  });

  it('ignores malformed state frames and leaves foreign frames unclaimed', async () => {
    const h = makeHarness();
    h.wireSent.length = 0;
    expect(h.deliver({ type: PROXY_ROUTING_STATE_TYPE, enabled: 'yes', port: 1, scopePatterns: [] }, h.wire)).toBe(
      true,
    );
    expect(h.deliver({ type: PROXY_ROUTING_STATE_TYPE, enabled: true, port: 1.5, scopePatterns: [] }, h.wire)).toBe(
      true,
    );
    expect(h.deliver({ type: 'oh.other.frame' }, h.wire)).toBe(false);
    await settle();
    expect(h.applied).toEqual([]);
    h.dispose();
  });

  it('acks applied:false with the error when the adapter fails', async () => {
    const h = makeHarness({
      apply: async () => ({ applied: false, error: 'proxy settings controlled by other extensions' }),
    });
    h.wireSent.length = 0;
    h.deliver(STATE_FRAME, h.wire);
    await settle();
    expect(h.wireSent).toEqual([
      {
        type: PROXY_ROUTING_ACK_TYPE,
        applied: false,
        mode: 'pac',
        error: 'proxy settings controlled by other extensions',
      },
    ]);
    h.dispose();
  });

  it('applies pushes in arrival order — the last verdict wins', async () => {
    const order: Array<boolean> = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const h = makeHarness({
      apply: async (state) => {
        if (order.length === 0) await firstGate;
        order.push(state.enabled);
        return { applied: true };
      },
    });
    h.deliver(STATE_FRAME, h.wire);
    h.deliver({ ...STATE_FRAME, enabled: false, port: null, scopePatterns: [] }, h.wire);
    releaseFirst();
    await settle();
    await settle();
    expect(order).toEqual([true, false]);
    h.dispose();
  });
});
