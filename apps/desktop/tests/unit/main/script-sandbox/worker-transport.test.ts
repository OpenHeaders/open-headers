/**
 * Developer-mode worker transport — utilityProcess lifecycle behind the
 * {@link SandboxTransport} seam, over a fake `utilityProcess`. Pins:
 * lazy fork with a shared spawn, ready-handshake gating, up-message
 * forwarding with the stale-handle guard, exit-before-ready rejecting
 * that spawn (and not poisoning the next), crash-drop → respawn on the
 * next run, and deliberate close killing the worker quietly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/bootstrap/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

type Listener = (...args: unknown[]) => void;

class FakeUtilityProcess {
  readonly path: string;
  readonly posted: unknown[] = [];
  killed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(path: string) {
    this.path = path;
  }

  on(event: string, fn: Listener): this {
    const bucket = this.listeners.get(event) ?? [];
    bucket.push(fn);
    this.listeners.set(event, bucket);
    return this;
  }

  once(event: string, fn: Listener): this {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped);
      fn(...args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, fn: Listener): void {
    const bucket = this.listeners.get(event) ?? [];
    const idx = bucket.indexOf(fn);
    if (idx >= 0) bucket.splice(idx, 1);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(...args);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  kill(): boolean {
    this.killed = true;
    this.emit('exit', 0);
    return true;
  }
}

const h = vi.hoisted(() => ({
  forked: [] as unknown[],
  fork: vi.fn(),
}));

vi.mock('electron', () => ({
  utilityProcess: {
    fork: (path: string) => h.fork(path) as never,
  },
}));

import { createScriptWorkerTransport } from '@/main/script-sandbox/worker-transport';

function children(): FakeUtilityProcess[] {
  return h.forked as FakeUtilityProcess[];
}

beforeEach(() => {
  h.forked.length = 0;
  h.fork.mockImplementation((path: string) => {
    const child = new FakeUtilityProcess(path);
    h.forked.push(child);
    return child;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createScriptWorkerTransport', () => {
  it('forks lazily, resolves ready on the handshake, and reuses the worker', async () => {
    const transport = createScriptWorkerTransport(() => {});
    expect(children()).toHaveLength(0);

    const ready = transport.ensureReady();
    expect(children()).toHaveLength(1);
    expect(children()[0]?.path.endsWith('script-worker.js')).toBe(true);
    children()[0]?.emit('message', { type: 'sandbox.ready' });
    await ready;

    await transport.ensureReady();
    expect(children()).toHaveLength(1);
  });

  it('forwards up-messages to onUp — but never the ready handshake', async () => {
    const onUp = vi.fn();
    const transport = createScriptWorkerTransport(onUp);
    const ready = transport.ensureReady();
    const child = children()[0] as FakeUtilityProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    const result = { type: 'script.result', result: { executionId: 'e1' } };
    child.emit('message', result);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onUp).toHaveBeenCalledWith(result);
  });

  it('post delivers to the live worker; a closed transport posts nowhere', async () => {
    const transport = createScriptWorkerTransport(() => {});
    const ready = transport.ensureReady();
    const child = children()[0] as FakeUtilityProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    transport.post({ type: 'script.execute' });
    expect(child.posted).toEqual([{ type: 'script.execute' }]);

    transport.close('idle');
    expect(child.killed).toBe(true);
    transport.post({ type: 'script.execute' });
    expect(child.posted).toHaveLength(1);
  });

  it('a worker that exits before ready rejects that spawn without poisoning the next', async () => {
    const transport = createScriptWorkerTransport(() => {});
    const ready = transport.ensureReady();
    children()[0]?.emit('exit', 1);
    await expect(ready).rejects.toThrow(/exited before ready/);

    const retry = transport.ensureReady();
    expect(children()).toHaveLength(2);
    children()[1]?.emit('message', { type: 'sandbox.ready' });
    await expect(retry).resolves.toBeUndefined();
  });

  it('a crash after ready drops the handle — the next run respawns', async () => {
    const transport = createScriptWorkerTransport(() => {});
    const ready = transport.ensureReady();
    const child = children()[0] as FakeUtilityProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    child.emit('exit', 9);
    const respawned = transport.ensureReady();
    expect(children()).toHaveLength(2);
    children()[1]?.emit('message', { type: 'sandbox.ready' });
    await expect(respawned).resolves.toBeUndefined();
  });

  it("a stale worker's late messages never reach the broker", async () => {
    const onUp = vi.fn();
    const transport = createScriptWorkerTransport(onUp);
    const ready = transport.ensureReady();
    const first = children()[0] as FakeUtilityProcess;
    first.emit('message', { type: 'sandbox.ready' });
    await ready;

    transport.close('idle');
    const respawn = transport.ensureReady();
    const second = children()[1] as FakeUtilityProcess;
    second.emit('message', { type: 'sandbox.ready' });
    await respawn;

    first.emit('message', { type: 'script.result', result: { executionId: 'stale' } });
    expect(onUp).not.toHaveBeenCalled();
    second.emit('message', { type: 'script.result', result: { executionId: 'live' } });
    expect(onUp).toHaveBeenCalledWith({ type: 'script.result', result: { executionId: 'live' } });
  });
});
