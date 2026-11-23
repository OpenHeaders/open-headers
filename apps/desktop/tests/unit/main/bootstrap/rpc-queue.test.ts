import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngineReadiness } from '@/main/bootstrap/engine-readiness';
import { installRpcQueue } from '@/main/bootstrap/rpc-queue';
import type { OhRpcDispatcher } from '@/main/install-rpc-host';

const engine = vi.hoisted(() => ({ dispatcher: null as OhRpcDispatcher | null }));

vi.mock('@/main/install-rpc-host', () => ({
  getOhRpcDispatcher: () => engine.dispatcher,
}));

type RpcHandler = (event: unknown, raw: unknown) => Promise<unknown>;

function installQueue() {
  let handler: RpcHandler | undefined;
  vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: RpcHandler) => {
    if (channel === 'oh:rpc') handler = fn;
  }) as typeof ipcMain.handle);
  const readiness = createEngineReadiness();
  installRpcQueue(readiness);
  if (!handler) throw new Error('oh:rpc handler was not registered');
  const registered = handler;
  return { readiness, call: (raw: unknown) => registered({}, raw) };
}

describe('rpc queue', () => {
  beforeEach(() => {
    engine.dispatcher = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('holds a call that arrives before the engine and answers it once the boot settles', async () => {
    const { readiness, call } = installQueue();
    const answered = call({ type: 'oh.sync.snapshot' });

    let settled = false;
    void answered.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    engine.dispatcher = async (raw) => ({ echoed: raw });
    readiness.signalReady();
    await expect(answered).resolves.toEqual({ echoed: { type: 'oh.sync.snapshot' } });
  });

  it('dispatches straight through once the engine is up', async () => {
    const { call } = installQueue();
    engine.dispatcher = async () => ({ ok: true });
    await expect(call({ type: 'oh.sync.snapshot' })).resolves.toEqual({ ok: true });
  });

  it('answers with an error when the boot settled without a dispatcher', async () => {
    const { readiness, call } = installQueue();
    const answered = call({ type: 'oh.sync.snapshot' });
    readiness.signalReady();
    await expect(answered).resolves.toEqual({
      __error: 'desktop main: oh:rpc dispatcher unavailable after engine boot',
    });
  });
});
