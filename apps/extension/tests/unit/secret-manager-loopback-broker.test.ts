/**
 * The browser host's secret-manager seam over loopback: the broker
 * asks ONLY the desktop app on this device (a server wire is never
 * asked), reads every entry's typed answer by name, and reads
 * `broker-unreachable` for every entry while the desktop app is away
 * or the wire falls mid-ask; the forwarded routes answer the workbench
 * honestly in the same states; a mutation never rides the wire.
 */

import type { SecretLocator } from '@openheaders/core/secret-providers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWsRequest, wires } = vi.hoisted(() => ({
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  wires: [] as Array<{ backendId: string; url: string }>,
}));

vi.mock('@/background/ws-request', () => ({ wsRequest: mockWsRequest }));
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  listConnectedWires: () => wires.map((w) => ({ backendId: w.backendId, record: () => ({ url: w.url }) })),
}));

import { secretManagerHandlers } from '@/background/modules/message-handler/handlers/secret-managers';
import type { HandlerArgs } from '@/background/modules/message-handler/types';
import {
  createLoopbackSecretManagerBroker,
  DESKTOP_APP_AWAY_DETAIL,
  desktopAppBackendId,
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

beforeEach(() => {
  mockWsRequest.mockReset();
  wires.length = 0;
});

describe('the desktop app wire', () => {
  it('is the loopback backend by the place rule — a server is never it', () => {
    wires.push(SERVER);
    expect(desktopAppBackendId()).toBeNull();
    wires.push(DESKTOP);
    expect(desktopAppBackendId()).toBe('b-desktop');
  });
});

describe('the loopback broker', () => {
  it('asks the desktop app deadline-free and reads every entry typed by name', async () => {
    wires.push(SERVER, DESKTOP);
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
    expect(mockWsRequest.mock.calls[0]?.[1]).toEqual({ backendId: 'b-desktop', timeoutMs: 0 });
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
    wires.push(DESKTOP);
    mockWsRequest.mockRejectedValueOnce(new Error('not-connected'));
    const out = await createLoopbackSecretManagerBroker().resolveBatch([{ name: 'ApiToken', locator: LOCATOR }]);
    expect(out.get('ApiToken')).toEqual({ ok: false, reason: 'broker-unreachable', detail: 'not-connected' });
  });

  it('an empty batch never touches the wire', async () => {
    wires.push(DESKTOP);
    expect((await createLoopbackSecretManagerBroker().resolveBatch([])).size).toBe(0);
    expect(mockWsRequest).not.toHaveBeenCalled();
  });
});

describe('the forwarded routes', () => {
  it('list names the desktop app as its broker when connected, unreachable when away', async () => {
    expect(await invoke('oh.secretManager.list')).toEqual({ connections: [], broker: 'unreachable' });
    wires.push(DESKTOP);
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
    wires.push(DESKTOP);
    mockWsRequest.mockResolvedValueOnce({ available: true });
    expect(await invoke('oh.secretManager.probe', { uid: 'c1' })).toEqual({ available: true });
    expect(mockWsRequest.mock.calls[0]?.[0]).toEqual({ type: 'oh.secretManager.probe', uid: 'c1' });
    mockWsRequest.mockResolvedValueOnce({ ok: true });
    expect(await invoke('oh.secretManager.authorize', { uid: 'c1' })).toEqual({ ok: true });
  });

  it('a mutation never rides the wire — the browser host says where it happens', async () => {
    wires.push(DESKTOP);
    for (const type of ['oh.secretManager.add', 'oh.secretManager.update', 'oh.secretManager.remove']) {
      expect(await invoke(type, { uid: 'c1' })).toMatchObject({ ok: false });
    }
    expect(mockWsRequest).not.toHaveBeenCalled();
  });
});
