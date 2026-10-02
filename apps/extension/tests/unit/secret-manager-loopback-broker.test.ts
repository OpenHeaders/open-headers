/**
 * The browser host's secret-manager seam over loopback: the broker
 * asks ONLY the desktop app on this device (a server wire is never
 * asked), reads every entry's typed answer by name, and reads
 * `broker-unreachable` for every entry while the desktop app is away
 * or the wire falls mid-ask; the forwarded routes answer the workbench
 * honestly in the same states (the page realm's sessions resolve
 * their entries through the forwarded batch resolve); a mutation
 * never rides the wire. The desktop app is "there" once its wire's
 * HELLO is accepted — a socket merely open is never asked, since the
 * server closes a socket that speaks before HELLO.
 */

import type { SecretLocator } from '@openheaders/core/secret-providers';
import type { InitiatorState } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWsRequest, wires } = vi.hoisted(() => ({
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  wires: [] as Array<{ backendId: string; url: string }>,
}));

vi.mock('@/background/ws-request', () => ({ wsRequest: mockWsRequest }));
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  listConnectedWires: () => wires.map((w) => ({ backendId: w.backendId, record: () => ({ url: w.url }) })),
}));
vi.mock('@openheaders/core/backends', () => ({
  getBackend: (id: string) => {
    const wire = wires.find((w) => w.backendId === id);
    return wire ? { id, url: wire.url } : null;
  },
}));

import { secretManagerHandlers } from '@/background/modules/message-handler/handlers/secret-managers';
import type { HandlerArgs } from '@/background/modules/message-handler/types';
import {
  __resetDesktopWireReadinessForTests,
  createLoopbackSecretManagerBroker,
  DESKTOP_APP_AWAY_DETAIL,
  desktopAppBackendId,
  installDesktopWireWatch,
  PROMPT_CEILING_MS,
  subscribeDesktopWireReady,
} from '@/background/modules/secret-manager/loopback-broker';

const DESKTOP = { backendId: 'b-desktop', url: 'ws://127.0.0.1:8137' };
const SERVER = { backendId: 'b-server', url: 'wss://sync.openheaders.io' };

const LOCATOR: SecretLocator = {
  provider: 'onepassword',
  connectionId: 'conn0001',
  vault: 'Demo',
  item: 'api.openheaders.io',
  field: 'token',
};

function invoke(type: string, message: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = secretManagerHandlers[type];
    if (!handler) throw new Error(`no handler for ${type}`);
    const args: HandlerArgs = {
      message: { type, ...message },
      sender: {} as chrome.runtime.MessageSender,
      respond: (value: unknown) => resolve(value),
      ctx: {} as HandlerArgs['ctx'],
    };
    handler(args);
  });
}

// The sync wiring's handshake lifecycle, driven by hand: one fake
// initiator per backend whose state the test sets.
type LifecycleEvent = { kind: 'created' | 'removed'; backendId: string; handles: unknown };
const lifecycleSubscribers = new Set<(event: LifecycleEvent) => void>();
const initiators = new Map<string, (state: InitiatorState) => void>();
const syncWiring = {
  subscribeHandshakeLifecycle: (cb: (event: LifecycleEvent) => void) => {
    lifecycleSubscribers.add(cb);
    return () => lifecycleSubscribers.delete(cb);
  },
};
let disposeWatch: (() => void) | null = null;

function emit(kind: 'created' | 'removed', backendId: string): void {
  const handles = {
    initiator: {
      subscribe: (fn: (state: InitiatorState) => void) => {
        initiators.set(backendId, fn);
        return () => initiators.delete(backendId);
      },
    },
  };
  for (const cb of [...lifecycleSubscribers]) cb({ kind, backendId, handles });
}

function setState(backendId: string, state: InitiatorState): void {
  initiators.get(backendId)?.(state);
}

/** The wire up AND its HELLO accepted — the state every verb needs. */
function connect(wire: { backendId: string; url: string }): void {
  wires.push(wire);
  emit('created', wire.backendId);
  setState(wire.backendId, 'welcomed');
}

beforeEach(() => {
  mockWsRequest.mockReset();
  wires.length = 0;
  __resetDesktopWireReadinessForTests();
  lifecycleSubscribers.clear();
  initiators.clear();
  disposeWatch = installDesktopWireWatch(syncWiring as never);
});

afterEach(() => {
  disposeWatch?.();
  disposeWatch = null;
});

describe('the desktop app wire', () => {
  it('is the loopback backend by the place rule, and only once its HELLO is accepted — a server is never it', () => {
    const seen: boolean[] = [];
    subscribeDesktopWireReady((ready) => seen.push(ready));
    connect(SERVER);
    expect(desktopAppBackendId()).toBeNull();
    expect(seen).toEqual([]);
    // The socket is open and HELLO is out — not yet.
    wires.push(DESKTOP);
    emit('created', 'b-desktop');
    setState('b-desktop', 'hello-sent');
    expect(desktopAppBackendId()).toBeNull();
    setState('b-desktop', 'welcomed');
    expect(desktopAppBackendId()).toBe('b-desktop');
    expect(seen).toEqual([true]);
    // Catch-up outcomes on a welcomed wire keep it; the socket closing drops it.
    setState('b-desktop', 'synced');
    setState('b-desktop', 'failed');
    expect(desktopAppBackendId()).toBe('b-desktop');
    expect(seen).toEqual([true]);
    setState('b-desktop', 'idle');
    expect(desktopAppBackendId()).toBeNull();
    expect(seen).toEqual([true, false]);
    // A refused HELLO never readies it.
    setState('b-desktop', 'hello-sent');
    setState('b-desktop', 'rejected');
    expect(desktopAppBackendId()).toBeNull();
    expect(seen).toEqual([true, false]);
  });
});

describe('the loopback broker', () => {
  it("asks the desktop app under the prompt's ceiling and reads every entry typed by name", async () => {
    wires.push(SERVER);
    connect(DESKTOP);
    mockWsRequest.mockResolvedValueOnce({
      results: { ApiToken: { ok: true, value: 'v' }, Gone: { ok: false, reason: 'not-found' } },
    });
    const broker = createLoopbackSecretManagerBroker();
    const out = await broker.resolveBatch([
      { name: 'ApiToken', locator: LOCATOR },
      { name: 'Gone', locator: { ...LOCATOR, item: 'missing.openheaders.io' } },
      { name: 'Silent', locator: LOCATOR },
    ]);
    expect(mockWsRequest).toHaveBeenCalledTimes(1);
    expect(mockWsRequest.mock.calls[0]?.[0]).toMatchObject({ type: 'oh.secretManager.resolveBatch' });
    expect(mockWsRequest.mock.calls[0]?.[1]).toEqual({ backendId: 'b-desktop', timeoutMs: PROMPT_CEILING_MS });
    expect(out.get('ApiToken')).toEqual({ ok: true, value: 'v' });
    expect(out.get('Gone')).toMatchObject({ ok: false, reason: 'not-found' });
    expect(out.get('Silent')).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('reads broker-unreachable for every entry while the desktop app is away, asking nothing', async () => {
    wires.push(SERVER);
    const out = await createLoopbackSecretManagerBroker().resolveBatch([{ name: 'ApiToken', locator: LOCATOR }]);
    expect(out.get('ApiToken')).toEqual({ ok: false, reason: 'broker-unreachable', detail: DESKTOP_APP_AWAY_DETAIL });
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('a wire that falls mid-ask reads broker-unreachable with the wire’s own detail', async () => {
    connect(DESKTOP);
    mockWsRequest.mockRejectedValueOnce(new Error('not-connected'));
    const out = await createLoopbackSecretManagerBroker().resolveBatch([{ name: 'ApiToken', locator: LOCATOR }]);
    expect(out.get('ApiToken')).toEqual({ ok: false, reason: 'broker-unreachable', detail: 'not-connected' });
  });

  it('an empty batch never touches the wire', async () => {
    connect(DESKTOP);
    expect((await createLoopbackSecretManagerBroker().resolveBatch([])).size).toBe(0);
    expect(mockWsRequest).not.toHaveBeenCalled();
  });
});

describe('the forwarded routes', () => {
  it('list names the desktop app as its broker when connected, unreachable when away', async () => {
    expect(await invoke('oh.secretManager.list')).toEqual({ connections: [], broker: 'unreachable' });
    connect(DESKTOP);
    mockWsRequest.mockResolvedValueOnce({ connections: [{ uid: 'c1' }], broker: 'local' });
    expect(await invoke('oh.secretManager.list')).toEqual({ connections: [{ uid: 'c1' }], broker: 'desktop-app' });
  });

  it('probe and authorize read broker-unreachable while the desktop app is away, and forward otherwise', async () => {
    expect(await invoke('oh.secretManager.probe', { uid: 'c1' })).toMatchObject({
      available: false,
      reason: 'broker-unreachable',
    });
    expect(await invoke('oh.secretManager.authorize', { uid: 'c1' })).toMatchObject({
      ok: false,
      reason: 'broker-unreachable',
    });
    connect(DESKTOP);
    mockWsRequest.mockResolvedValueOnce({ available: true });
    expect(await invoke('oh.secretManager.probe', { uid: 'c1' })).toEqual({ available: true });
    expect(mockWsRequest.mock.calls[0]?.[0]).toEqual({ type: 'oh.secretManager.probe', uid: 'c1' });
    expect(mockWsRequest.mock.calls[0]?.[1]).toEqual({ backendId: 'b-desktop' });
    mockWsRequest.mockResolvedValueOnce({ ok: true });
    expect(await invoke('oh.secretManager.authorize', { uid: 'c1' })).toEqual({ ok: true });
  });

  it("the page realm's batch resolve rides the loopback broker — typed by name, broker-unreachable when away", async () => {
    const entries = [{ name: 'ApiToken', locator: LOCATOR }];
    expect(await invoke('oh.secretManager.resolveBatch', { entries })).toEqual({
      results: { ApiToken: { ok: false, reason: 'broker-unreachable', detail: DESKTOP_APP_AWAY_DETAIL } },
    });
    expect(mockWsRequest).not.toHaveBeenCalled();
    connect(DESKTOP);
    mockWsRequest.mockResolvedValueOnce({ results: { ApiToken: { ok: true, value: 'v' } } });
    expect(await invoke('oh.secretManager.resolveBatch', { entries })).toEqual({
      results: { ApiToken: { ok: true, value: 'v' } },
    });
    expect(mockWsRequest.mock.calls[0]?.[0]).toMatchObject({ type: 'oh.secretManager.resolveBatch', entries });
    expect(mockWsRequest.mock.calls[0]?.[1]).toEqual({ backendId: 'b-desktop', timeoutMs: PROMPT_CEILING_MS });
  });

  it('a mutation never rides the wire — the browser host says where it happens', async () => {
    connect(DESKTOP);
    for (const type of ['oh.secretManager.add', 'oh.secretManager.update', 'oh.secretManager.remove']) {
      expect(await invoke(type, { uid: 'c1' })).toMatchObject({ ok: false });
    }
    expect(mockWsRequest).not.toHaveBeenCalled();
  });
});
