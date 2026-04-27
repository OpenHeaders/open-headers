/**
 * Workspace-export handoff registry — register / consume / TTL coverage.
 *
 * The store stages YAML payloads in `chrome.storage.session` keyed by
 * a fresh handoff id. Consumers drain entries (single-use); reads
 * always re-check expiry so an evicted SW that misses the periodic
 * sweep can't surface stale handoffs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __debugHandoffCount,
  __resetHandoffStoreForTests,
  consumeImportHandoff,
  isHandoffSweepAlarm,
  registerImportHandoff,
  sweepExpiredHandoffs,
} from '@/background/modules/workspace-export-handoff-store';

interface FakeSession {
  store: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

function installFakeSession(): FakeSession {
  const store: Record<string, unknown> = {};
  const fake: FakeSession = {
    store,
    get: vi.fn((key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
  };
  (globalThis as unknown as Record<string, unknown>).chrome = {
    storage: { session: fake },
    alarms: {
      get: vi.fn(() => Promise.resolve(undefined)),
      create: vi.fn(),
    },
  };
  return fake;
}

async function flushPersist(): Promise<void> {
  await new Promise((r) => setTimeout(r, 60));
}

describe('workspace-export-handoff-store', () => {
  beforeEach(() => {
    __resetHandoffStoreForTests();
  });

  afterEach(() => {
    __resetHandoffStoreForTests();
    delete (globalThis as unknown as Record<string, unknown>).chrome;
    vi.useRealTimers();
  });

  it('register → consume returns the staged YAML and drains the entry', async () => {
    installFakeSession();
    const id = await registerImportHandoff('hello: world');
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(__debugHandoffCount()).toBe(1);

    const yaml = await consumeImportHandoff(id);
    expect(yaml).toBe('hello: world');

    // Single-use — re-consume returns null.
    expect(await consumeImportHandoff(id)).toBeNull();
    expect(__debugHandoffCount()).toBe(0);
  });

  it('returns null for an unknown handoff id', async () => {
    installFakeSession();
    expect(await consumeImportHandoff('zzzzzzzz')).toBeNull();
  });

  it('refuses to register an empty payload', async () => {
    installFakeSession();
    await expect(registerImportHandoff('')).rejects.toThrow(/empty/i);
  });

  it('refuses to register a payload over the size cap', async () => {
    installFakeSession();
    const huge = 'a'.repeat(50 * 1024 * 1024 + 1);
    await expect(registerImportHandoff(huge)).rejects.toThrow(/exceeds/);
  });

  it('expired entries are dropped by sweepExpiredHandoffs', async () => {
    installFakeSession();
    const t0 = 1_000_000_000_000;
    vi.useFakeTimers().setSystemTime(t0);
    const idA = await registerImportHandoff('a: 1');
    const idB = await registerImportHandoff('b: 2');
    expect(__debugHandoffCount()).toBe(2);

    // Jump past TTL (5 min + 1 ms) and sweep.
    vi.setSystemTime(t0 + 5 * 60 * 1000 + 1);
    const dropped = await sweepExpiredHandoffs();
    expect(dropped).toBe(2);
    expect(__debugHandoffCount()).toBe(0);
    expect(await consumeImportHandoff(idA)).toBeNull();
    expect(await consumeImportHandoff(idB)).toBeNull();
  });

  it('expired entries are silently dropped on read even if sweep never ran', async () => {
    installFakeSession();
    const t0 = 1_000_000_000_000;
    vi.useFakeTimers().setSystemTime(t0);
    const id = await registerImportHandoff('once: only');

    vi.setSystemTime(t0 + 5 * 60 * 1000 + 1);
    // We deliberately don't call sweepExpiredHandoffs — consume must
    // still refuse the stale entry.
    expect(await consumeImportHandoff(id)).toBeNull();
  });

  it('persists across a simulated SW restart (chrome.storage.session round-trip)', async () => {
    const session = installFakeSession();
    const id = await registerImportHandoff('survives: yes');
    await flushPersist();
    expect(session.set).toHaveBeenCalled();
    const stored = session.store['workspaceExport.handoffs'] as Record<string, unknown>;
    expect(stored[id]).toBeDefined();

    // Simulate SW eviction: drop module state, keep session store.
    __resetHandoffStoreForTests();

    expect(await consumeImportHandoff(id)).toBe('survives: yes');
  });

  it('isHandoffSweepAlarm recognizes the sweep alarm name', () => {
    expect(isHandoffSweepAlarm({ name: 'oh-handoff-sweep' } as chrome.alarms.Alarm)).toBe(true);
    expect(isHandoffSweepAlarm({ name: 'unrelated' } as chrome.alarms.Alarm)).toBe(false);
  });

  it('unique handoff ids across consecutive registrations', async () => {
    installFakeSession();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(await registerImportHandoff(`payload: ${i}`));
    }
    expect(ids.size).toBe(50);
  });

  it('no-op when chrome.storage.session is unavailable', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      alarms: { get: vi.fn(() => Promise.resolve(undefined)), create: vi.fn() },
    };
    const id = await registerImportHandoff('best-effort: yes');
    // Module-level cache still holds it for the lifetime of this SW.
    expect(await consumeImportHandoff(id)).toBe('best-effort: yes');
  });
});
