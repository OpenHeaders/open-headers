/**
 * Phase C M2c.2 — pins the WS request/response correlation helper.
 *
 *   - resolves on a matching `:response` frame from the same backend
 *   - rejects with `not-connected` when the send reports failure
 *   - rejects with the server-supplied `__error`
 *   - rejects with `timeout` when no response arrives in `timeoutMs`
 *   - `timeoutMs: 0` = deadline-free; the connection-close flush is the
 *     failure signal (per-backend, other wires untouched)
 *   - pairs requests of the same type in FIFO order
 *   - ignores frames whose `:response` type has no pending request
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeWire {
  backendId: string;
}

const DEFAULT_BACKEND_ID = 'backend-default';

const sendMock = vi.fn<(backendId: string, data: Record<string, unknown>) => boolean>(() => true);
type Handler = (frame: unknown, wire: FakeWire) => boolean | Promise<boolean>;
const registeredHandlers: Handler[] = [];
type CloseHandler = (wire: FakeWire) => void;
const closeHandlers: CloseHandler[] = [];

vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  sendToBackend: (backendId: string, data: Record<string, unknown>) => sendMock(backendId, data),
  getDefaultWireBackendId: () => DEFAULT_BACKEND_ID,
  registerInboundFrameHandler: (handler: Handler) => {
    registeredHandlers.push(handler);
    return () => {
      const idx = registeredHandlers.indexOf(handler);
      if (idx >= 0) registeredHandlers.splice(idx, 1);
    };
  },
  subscribeOnWebSocketClose: (handler: CloseHandler) => {
    closeHandlers.push(handler);
    return () => {
      const idx = closeHandlers.indexOf(handler);
      if (idx >= 0) closeHandlers.splice(idx, 1);
    };
  },
}));

vi.mock('@openheaders/core/utils', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/utils')>()),
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { __resetWsRequestForTests, wsRequest } from '../../src/background/ws-request';

async function deliver(frame: unknown, backendId = DEFAULT_BACKEND_ID): Promise<boolean> {
  for (const handler of [...registeredHandlers]) {
    const handled = await handler(frame, { backendId });
    if (handled) return true;
  }
  return false;
}

function closeWire(backendId = DEFAULT_BACKEND_ID): void {
  for (const handler of [...closeHandlers]) handler({ backendId });
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockImplementation(() => true);
  registeredHandlers.length = 0;
  closeHandlers.length = 0;
  __resetWsRequestForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wsRequest', () => {
  it('resolves on a matching :response frame and forwards the payload', async () => {
    const promise = wsRequest<{ workspaces: string[] }>({ type: 'oh.demo.q' });
    expect(sendMock).toHaveBeenCalledWith(DEFAULT_BACKEND_ID, { type: 'oh.demo.q' });
    const claimed = await deliver({ type: 'oh.demo.q:response', payload: { workspaces: ['ws-a'] } });
    expect(claimed).toBe(true);
    expect(await promise).toEqual({ workspaces: ['ws-a'] });
  });

  it('rejects with not-connected when the send returns false', async () => {
    sendMock.mockReturnValueOnce(false);
    await expect(wsRequest({ type: 'oh.demo.q' })).rejects.toThrow('not-connected');
  });

  it('rejects with the server-supplied __error', async () => {
    const promise = wsRequest({ type: 'oh.demo.q' });
    await deliver({ type: 'oh.demo.q:response', __error: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects with timeout when no response arrives in time', async () => {
    vi.useFakeTimers();
    const promise = wsRequest({ type: 'oh.demo.q' }, { timeoutMs: 50 });
    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toThrow('timeout');
  });

  it('never times out a deadline-free request — it settles on the response whenever it lands', async () => {
    vi.useFakeTimers();
    const promise = wsRequest<{ tag: string }>({ type: 'oh.demo.q' }, { timeoutMs: 0 });
    vi.advanceTimersByTime(10 * 60_000);
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'late' } });
    expect(await promise).toEqual({ tag: 'late' });
  });

  it('rejects a deadline-free request when its connection closes', async () => {
    const promise = wsRequest({ type: 'oh.demo.q' }, { timeoutMs: 0 });
    closeWire();
    await expect(promise).rejects.toThrow('not-connected');
  });

  it("leaves another backend's pending requests alone when a wire closes", async () => {
    const other = wsRequest<{ tag: string }>({ type: 'oh.demo.q' }, { timeoutMs: 0, backendId: 'backend-b' });
    closeWire();
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'b' } }, 'backend-b');
    expect(await other).toEqual({ tag: 'b' });
  });

  it('pairs in FIFO order when multiple requests of the same type are in flight', async () => {
    const a = wsRequest<{ tag: string }>({ type: 'oh.demo.q' });
    const b = wsRequest<{ tag: string }>({ type: 'oh.demo.q' });
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'first' } });
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'second' } });
    expect(await a).toEqual({ tag: 'first' });
    expect(await b).toEqual({ tag: 'second' });
  });

  it('ignores response frames that have no pending request', async () => {
    const claimed = await deliver({ type: 'oh.unknown.q:response', payload: { ignored: true } });
    expect(claimed).toBe(false);
  });

  it("never settles a request with another backend's response", async () => {
    const promise = wsRequest<{ tag: string }>({ type: 'oh.demo.q' });
    const claimed = await deliver({ type: 'oh.demo.q:response', payload: { tag: 'cross' } }, 'backend-other');
    expect(claimed).toBe(false);
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'own' } });
    expect(await promise).toEqual({ tag: 'own' });
  });

  it('targets an explicit backendId and pairs on its connection', async () => {
    const promise = wsRequest<{ tag: string }>({ type: 'oh.demo.q' }, { backendId: 'backend-b' });
    expect(sendMock).toHaveBeenCalledWith('backend-b', { type: 'oh.demo.q' });
    await deliver({ type: 'oh.demo.q:response', payload: { tag: 'b' } }, 'backend-b');
    expect(await promise).toEqual({ tag: 'b' });
  });

  it('ignores frames that are not `:response` suffixed', async () => {
    wsRequest({ type: 'oh.demo.q' }).catch(() => undefined);
    const claimed = await deliver({ type: 'oh.demo.q', payload: { wrong: true } });
    expect(claimed).toBe(false);
  });
});
