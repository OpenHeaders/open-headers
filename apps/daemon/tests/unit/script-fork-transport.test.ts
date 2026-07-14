/**
 * Safe-mode fork transport — child_process lifecycle behind the
 * {@link SandboxTransport} seam, over a fake `fork`. Pins: the
 * permission-model launch shape (`--permission` + a file-scoped read
 * grant + scrubbed env), lazy fork with a shared spawn,
 * ready-handshake gating, up-message forwarding with the stale-handle
 * guard, exit-before-ready rejecting that spawn (and not poisoning the
 * next), crash-drop → respawn on the next run, and deliberate close
 * killing the runner quietly.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

setHostLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

type Listener = (...args: unknown[]) => void;

class FakeChildProcess {
  readonly path: string;
  readonly options: Record<string, unknown>;
  readonly posted: unknown[] = [];
  killed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(path: string, options: Record<string, unknown>) {
    this.path = path;
    this.options = options;
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

  send(message: unknown): boolean {
    this.posted.push(message);
    return true;
  }

  kill(): boolean {
    this.killed = true;
    this.emit('exit', null, 'SIGTERM');
    return true;
  }
}

const h = vi.hoisted(() => ({
  forked: [] as unknown[],
  fork: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  fork: (path: string, _args: unknown, options: Record<string, unknown>) => h.fork(path, options) as never,
}));

import { createForkTransport } from '../../src/script-sandbox/fork-transport';

const RUNNER = '/opt/openheaders/dist/script-runner.js';

function children(): FakeChildProcess[] {
  return h.forked as FakeChildProcess[];
}

function makeTransport(onUp: (message: unknown) => void = () => {}) {
  return createForkTransport(RUNNER)(onUp);
}

beforeEach(() => {
  h.forked.length = 0;
  h.fork.mockImplementation((path: string, options: Record<string, unknown>) => {
    const child = new FakeChildProcess(path, options);
    h.forked.push(child);
    return child;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createForkTransport', () => {
  it('forks the runner under the permission model with a file-scoped grant and a scrubbed env', async () => {
    const transport = makeTransport();
    const ready = transport.ensureReady();
    const child = children()[0] as FakeChildProcess;
    expect(child.path).toBe(RUNNER);
    expect(child.options.execArgv).toEqual(['--permission', `--allow-fs-read=${RUNNER}`]);
    expect(child.options.env).toEqual({});
    child.emit('message', { type: 'sandbox.ready' });
    await ready;
  });

  it('forks lazily, resolves ready on the handshake, and reuses the runner', async () => {
    const transport = makeTransport();
    expect(children()).toHaveLength(0);

    const ready = transport.ensureReady();
    expect(children()).toHaveLength(1);
    children()[0]?.emit('message', { type: 'sandbox.ready' });
    await ready;

    await transport.ensureReady();
    expect(children()).toHaveLength(1);
  });

  it('forwards up-messages to onUp — but never the ready handshake', async () => {
    const onUp = vi.fn();
    const transport = makeTransport(onUp);
    const ready = transport.ensureReady();
    const child = children()[0] as FakeChildProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    const result = { type: 'script.result', result: { executionId: 'e1' } };
    child.emit('message', result);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onUp).toHaveBeenCalledWith(result);
  });

  it('post delivers to the live runner; a closed transport posts nowhere', async () => {
    const transport = makeTransport();
    const ready = transport.ensureReady();
    const child = children()[0] as FakeChildProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    transport.post({ type: 'script.execute' });
    expect(child.posted).toEqual([{ type: 'script.execute' }]);

    transport.close('idle');
    expect(child.killed).toBe(true);
    transport.post({ type: 'script.execute' });
    expect(child.posted).toHaveLength(1);
  });

  it('a runner that exits before ready rejects that spawn without poisoning the next', async () => {
    const transport = makeTransport();
    const ready = transport.ensureReady();
    children()[0]?.emit('exit', 1, null);
    await expect(ready).rejects.toThrow(/exited before ready/);

    const retry = transport.ensureReady();
    expect(children()).toHaveLength(2);
    children()[1]?.emit('message', { type: 'sandbox.ready' });
    await expect(retry).resolves.toBeUndefined();
  });

  it('a fork error before ready rejects that spawn without poisoning the next', async () => {
    const transport = makeTransport();
    const ready = transport.ensureReady();
    children()[0]?.emit('error', new Error('spawn ENOENT'));
    await expect(ready).rejects.toThrow('spawn ENOENT');

    const retry = transport.ensureReady();
    expect(children()).toHaveLength(2);
    children()[1]?.emit('message', { type: 'sandbox.ready' });
    await expect(retry).resolves.toBeUndefined();
  });

  it('a crash after ready drops the handle — the next run respawns', async () => {
    const transport = makeTransport();
    const ready = transport.ensureReady();
    const child = children()[0] as FakeChildProcess;
    child.emit('message', { type: 'sandbox.ready' });
    await ready;

    child.emit('exit', 9, null);
    const respawned = transport.ensureReady();
    expect(children()).toHaveLength(2);
    children()[1]?.emit('message', { type: 'sandbox.ready' });
    await expect(respawned).resolves.toBeUndefined();
  });

  it("a stale runner's late messages never reach the broker", async () => {
    const onUp = vi.fn();
    const transport = makeTransport(onUp);
    const ready = transport.ensureReady();
    const first = children()[0] as FakeChildProcess;
    first.emit('message', { type: 'sandbox.ready' });
    await ready;

    transport.close('idle');
    const respawn = transport.ensureReady();
    const second = children()[1] as FakeChildProcess;
    second.emit('message', { type: 'sandbox.ready' });
    await respawn;

    first.emit('message', { type: 'script.result', result: { executionId: 'stale' } });
    expect(onUp).not.toHaveBeenCalled();
    second.emit('message', { type: 'script.result', result: { executionId: 'live' } });
    expect(onUp).toHaveBeenCalledWith({ type: 'script.result', result: { executionId: 'live' } });
  });
});
