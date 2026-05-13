/**
 * Coverage for `withLock` — the Phase 10 origin-scoped serialization
 * primitive. jsdom doesn't implement `navigator.locks`, so tests inject
 * a deterministic Map-backed FIFO mutex via `setLockRuntime` and assert
 * the contract the production browser runtime must also honor:
 *
 *   - One holder per name at a time.
 *   - FIFO among waiters.
 *   - `AbortSignal`-driven timeouts surface as `LockTimeoutError`.
 *   - Observability entries fire on contention and long holds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  entityLockName,
  globalWorkspaceLockName,
  type LockRuntime,
  LockTimeoutError,
  layoutLockName,
  setLockObserver,
  setLockRuntime,
  withLock,
} from '@openheaders/oracle/coordination';

const mockRecordLog = vi.fn();

// ── FIFO runtime — mirrors navigator.locks semantics in a deterministic way ─

interface QueuedRequest {
  resolve: () => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

class FifoLockRuntime implements LockRuntime {
  private queues = new Map<string, QueuedRequest[]>();
  private holders = new Set<string>();

  async request<T>(name: string, options: { signal?: AbortSignal }, callback: () => Promise<T> | T): Promise<T> {
    await this.acquire(name, options.signal);
    try {
      return await callback();
    } finally {
      this.release(name);
    }
  }

  private acquire(name: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Honor pre-aborted signals immediately.
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const enqueue = (): void => {
        const queue = this.queues.get(name) ?? [];
        const entry: QueuedRequest = { resolve };
        if (signal) {
          entry.signal = signal;
          entry.onAbort = () => {
            const q = this.queues.get(name);
            if (!q) return;
            const idx = q.indexOf(entry);
            if (idx >= 0) q.splice(idx, 1);
            reject(new DOMException('Aborted', 'AbortError'));
          };
          signal.addEventListener('abort', entry.onAbort, { once: true });
        }
        queue.push(entry);
        this.queues.set(name, queue);
      };

      if (!this.holders.has(name)) {
        this.holders.add(name);
        resolve();
        return;
      }
      enqueue();
    });
  }

  private release(name: string): void {
    this.holders.delete(name);
    const queue = this.queues.get(name);
    if (!queue || queue.length === 0) return;
    const next = queue.shift()!;
    if (next.signal && next.onAbort) {
      next.signal.removeEventListener('abort', next.onAbort);
    }
    this.holders.add(name);
    next.resolve();
  }

  /** Test-only: peek at waiters for a given name. */
  waitersFor(name: string): number {
    return this.queues.get(name)?.length ?? 0;
  }
}

let runtime: FifoLockRuntime;

beforeEach(() => {
  mockRecordLog.mockReset();
  setLockObserver(mockRecordLog);
  runtime = new FifoLockRuntime();
  setLockRuntime(runtime);
});

afterEach(() => {
  setLockRuntime(null);
  setLockObserver(null);
});

// ── Lock-name helpers ──────────────────────────────────────────────

describe('lock-name helpers', () => {
  it('builds stable per-entity lock names', () => {
    expect(entityLockName('ws-abcd1234', 'rule', 'rule-xyz1')).toBe('ws:ws-abcd1234:rule:rule-xyz1');
  });

  it('builds layout lock names scoped per workspace', () => {
    expect(layoutLockName('ws-abcd1234')).toBe('ws:ws-abcd1234:layout');
  });

  it('builds global workspace lock names', () => {
    expect(globalWorkspaceLockName('ws-abcd1234')).toBe('ws:ws-abcd1234:global');
  });
});

// ── withLock — exclusive access ─────────────────────────────────────

describe('withLock — serialization', () => {
  it('runs the callback while holding the lock', async () => {
    let ran = false;
    const result = await withLock('ws:A:rule:x', () => {
      ran = true;
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toBe(42);
  });

  it('bubbles async callback return values', async () => {
    const result = await withLock('ws:A:rule:x', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('queues concurrent requests on the same name — second waits for first', async () => {
    const order: string[] = [];
    let release1!: () => void;
    const first = withLock('ws:A:rule:x', async () => {
      order.push('1-start');
      await new Promise<void>((r) => {
        release1 = r;
      });
      order.push('1-end');
    });
    // Give first a frame to acquire before second queues.
    await new Promise((r) => setTimeout(r, 0));
    const second = withLock('ws:A:rule:x', async () => {
      order.push('2');
    });
    expect(runtime.waitersFor('ws:A:rule:x')).toBe(1);

    release1();
    await first;
    await second;
    expect(order).toEqual(['1-start', '1-end', '2']);
  });

  it('does NOT queue requests on different names', async () => {
    let release1!: () => void;
    const first = withLock('ws:A:rule:x', async () => {
      await new Promise<void>((r) => {
        release1 = r;
      });
    });
    await new Promise((r) => setTimeout(r, 0));
    const second = await withLock('ws:A:rule:y', async () => 'done');
    expect(second).toBe('done');
    release1();
    await first;
  });

  it('releases the lock even if the callback throws', async () => {
    await expect(
      withLock('ws:A:rule:x', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // A subsequent request should acquire immediately, proving the
    // lock was released on the throw path.
    const start = Date.now();
    await withLock('ws:A:rule:x', async () => {});
    expect(Date.now() - start).toBeLessThan(100);
  });
});

// ── withLock — timeout ─────────────────────────────────────────────

describe('withLock — timeout', () => {
  it('rejects with LockTimeoutError when the lock is held past timeoutMs', async () => {
    let release!: () => void;
    const holding = withLock('ws:A:rule:x', async () => {
      await new Promise<void>((r) => {
        release = r;
      });
    });
    await new Promise((r) => setTimeout(r, 0));

    await expect(withLock('ws:A:rule:x', async () => {}, { timeoutMs: 50 })).rejects.toBeInstanceOf(LockTimeoutError);

    release();
    await holding;
  });

  it('records a lock/timeout observability entry on timeout', async () => {
    let release!: () => void;
    const holding = withLock('ws:A:rule:x', async () => {
      await new Promise<void>((r) => {
        release = r;
      });
    });
    await new Promise((r) => setTimeout(r, 0));

    await expect(withLock('ws:A:rule:x', async () => {}, { timeoutMs: 30, op: 'rule-save' })).rejects.toThrow(
      LockTimeoutError,
    );

    const entries = mockRecordLog.mock.calls.map((c) => c[0]);
    expect(entries.some((e: { op: string }) => e.op === 'lock/timeout')).toBe(true);
    const timeoutEntry = entries.find((e: { op: string }) => e.op === 'lock/timeout');
    expect(timeoutEntry).toMatchObject({ level: 'error' });
    expect(timeoutEntry.message).toContain('rule-save');

    release();
    await holding;
  });
});

// ── withLock — observability ───────────────────────────────────────

describe('withLock — observability', () => {
  it('does NOT log on uncontended acquisition (low-volume path)', async () => {
    await withLock('ws:A:rule:x', async () => {});
    // No entries — uncontended success is silent, inferred from the
    // absence of contention entries.
    const ops = mockRecordLog.mock.calls.map((c) => (c[0] as { op: string }).op);
    expect(ops.filter((o) => o.startsWith('lock/'))).toEqual([]);
  });

  it('records lock/contended when waiting more than a frame for the lock', async () => {
    let release!: () => void;
    const holding = withLock('ws:A:rule:x', async () => {
      await new Promise<void>((r) => {
        release = r;
      });
    });
    await new Promise((r) => setTimeout(r, 0));

    // Force contention: queue behind the held lock, release after
    // 50ms to trip the >16ms contention threshold.
    const waiting = withLock('ws:A:rule:x', async () => {}, { op: 'rule-save' });
    setTimeout(release, 50);
    await waiting;
    await holding;

    const entries = mockRecordLog.mock.calls.map((c) => c[0]);
    const contended = entries.find((e: { op: string }) => e.op === 'lock/contended');
    expect(contended).toBeDefined();
    expect(contended.message).toContain('rule-save');
  });

  it('records lock/long-hold when the callback runs more than 100ms', async () => {
    await withLock(
      'ws:A:rule:x',
      async () => {
        await new Promise((r) => setTimeout(r, 120));
      },
      { op: 'slow-op' },
    );

    const entries = mockRecordLog.mock.calls.map((c) => c[0]);
    const longHold = entries.find((e: { op: string }) => e.op === 'lock/long-hold');
    expect(longHold).toBeDefined();
    expect(longHold.message).toContain('slow-op');
  });
});

// ── withLock — fallback when navigator.locks is absent ─────────────

describe('withLock — no-runtime fallback', () => {
  it('runs the callback directly and logs degraded mode', async () => {
    setLockRuntime({
      // Tiny override: pretend navigator.locks is absent. The wrapper
      // accepts `null` runtime to fall through to the no-lock path;
      // we set it via setLockRuntime(null) and then inject null back
      // by constructing a runtime that immediately signals absence.
    } as LockRuntime);
    // We injected a shape but the wrapper reads the module-level
    // variable, so we need the real null case — use the explicit null.
    setLockRuntime(null);
    // If jsdom has no navigator.locks (it doesn't), setLockRuntime(null)
    // reverts to createBrowserRuntime() which returns null itself.
    // Test-safe: run the callback and assert the warning entry fires.
    const result = await withLock('ws:A:rule:x', () => 'ran', { op: 'fallback' });
    expect(result).toBe('ran');

    const entries = mockRecordLog.mock.calls.map((c) => c[0]);
    const noRuntime = entries.find((e: { op: string }) => e.op === 'lock/no-runtime');
    expect(noRuntime).toBeDefined();
    expect(noRuntime.level).toBe('warn');
    expect(noRuntime.message).toContain('fallback');
  });
});
