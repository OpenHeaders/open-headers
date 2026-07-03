/**
 * Rule-state observer — diff logic across the four transition categories
 * plus first-run seeding and broad-scope fallback.
 */
import type { Rule } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { enqueueSpy } = vi.hoisted(() => ({ enqueueSpy: vi.fn() }));

vi.mock('@/background/modules/net/cache-invalidator', () => ({
  enqueueInvalidation: enqueueSpy,
}));

import {
  __flushPersistForTests,
  __resetSnapshotForTests,
  observeRuleState,
  rehydrateFromStorage,
} from '@/background/modules/rule-state-observer';

function rule(uid: string, opts: { domain?: string; enabled?: boolean; path?: string } = {}): Rule {
  const domain = opts.domain ?? 'api.openheaders.io';
  return {
    uid,
    path: opts.path ?? `rules/${uid}`,
    name: uid,
    type: 'block',
    enabled: opts.enabled ?? true,
    published: true,
    conditions: [{ uid: 'tcd00055', type: 'request-domains', values: [domain] }],
    action: {},
  } as Rule;
}

const NO_MARKERS: ReadonlyMap<string, PauseMarker> = new Map();

beforeEach(() => {
  enqueueSpy.mockReset();
  __resetSnapshotForTests();
});

afterEach(() => {
  __resetSnapshotForTests();
});

// ── First-run seeding ──────────────────────────────────────────────

describe('first-run seeding', () => {
  it('emits no eviction on the first call after boot', () => {
    observeRuleState([rule('r1'), rule('r2'), rule('r3')], NO_MARKERS, false);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('still emits no eviction on first call even if the rule list is empty', () => {
    observeRuleState([], NO_MARKERS, false);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// ── Category 1: rule added ─────────────────────────────────────────

describe('rule added', () => {
  it('evicts origins for a newly enabled rule', () => {
    observeRuleState([rule('r1')], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1'), rule('r2', { domain: 'cdn.openheaders.io' })], NO_MARKERS, false);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    const [origins, broad] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(new Set(['http://cdn.openheaders.io', 'https://cdn.openheaders.io']));
    expect(broad).toBe(false);
  });

  it('does NOT evict when a newly added rule is already disabled', () => {
    observeRuleState([rule('r1')], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1'), rule('r2', { domain: 'cdn.openheaders.io', enabled: false })], NO_MARKERS, false);

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// ── Category 2: rule deleted ───────────────────────────────────────

describe('rule deleted', () => {
  it('evicts origins for a rule that was active and is now gone', () => {
    observeRuleState([rule('r1'), rule('r2', { domain: 'cdn.openheaders.io' })], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1')], NO_MARKERS, false);

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(new Set(['http://cdn.openheaders.io', 'https://cdn.openheaders.io']));
  });

  it('does NOT evict when the deleted rule was already disabled', () => {
    observeRuleState([rule('r1'), rule('r2', { domain: 'cdn.openheaders.io', enabled: false })], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1')], NO_MARKERS, false);

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('evicts union of origins when multiple rules are deleted at once (collection removal)', () => {
    observeRuleState(
      [
        rule('r1', { domain: 'a.openheaders.io' }),
        rule('r2', { domain: 'b.openheaders.io' }),
        rule('r3', { domain: 'c.openheaders.io' }),
      ],
      NO_MARKERS,
      false,
    );
    enqueueSpy.mockClear();

    observeRuleState([rule('r1', { domain: 'a.openheaders.io' })], NO_MARKERS, false);

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(
      new Set([
        'http://b.openheaders.io',
        'https://b.openheaders.io',
        'http://c.openheaders.io',
        'https://c.openheaders.io',
      ]),
    );
  });
});

// ── Category 3: effective-state flip ───────────────────────────────

describe('effective-state flip', () => {
  it('evicts when a rule is disabled', () => {
    observeRuleState([rule('r1')], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1', { enabled: false })], NO_MARKERS, false);

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(new Set(['http://api.openheaders.io', 'https://api.openheaders.io']));
  });

  it('evicts when a rule is re-enabled', () => {
    observeRuleState([rule('r1', { enabled: false })], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1')], NO_MARKERS, false);

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(new Set(['http://api.openheaders.io', 'https://api.openheaders.io']));
  });

  it('evicts when a pause marker is added on the rule path', () => {
    observeRuleState([rule('r1', { path: 'rules/collection-a/r1' })], NO_MARKERS, false);
    enqueueSpy.mockClear();

    const paused: Map<string, PauseMarker> = new Map();
    paused.set('rules/collection-a', 'paused');

    observeRuleState([rule('r1', { path: 'rules/collection-a/r1' })], paused, false);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  it('evicts all active rules when the engine transitions to paused', () => {
    observeRuleState(
      [rule('r1', { domain: 'a.openheaders.io' }), rule('r2', { domain: 'b.openheaders.io' })],
      NO_MARKERS,
      false,
    );
    enqueueSpy.mockClear();

    observeRuleState(
      [rule('r1', { domain: 'a.openheaders.io' }), rule('r2', { domain: 'b.openheaders.io' })],
      NO_MARKERS,
      true,
    );

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(
      new Set([
        'http://a.openheaders.io',
        'https://a.openheaders.io',
        'http://b.openheaders.io',
        'https://b.openheaders.io',
      ]),
    );
  });
});

// ── Category 4: origins changed (rule edit) ────────────────────────

describe('origins changed', () => {
  it('evicts union of previous and new origins when URL pattern edited', () => {
    observeRuleState([rule('r1', { domain: 'api.openheaders.io' })], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1', { domain: 'api-v2.openheaders.io' })], NO_MARKERS, false);

    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(
      new Set([
        'http://api.openheaders.io',
        'https://api.openheaders.io',
        'http://api-v2.openheaders.io',
        'https://api-v2.openheaders.io',
      ]),
    );
  });

  it('does not evict when URL patterns are unchanged', () => {
    observeRuleState([rule('r1')], NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState([rule('r1')], NO_MARKERS, false);

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// ── No-op identity call ────────────────────────────────────────────

describe('identity', () => {
  it('does not evict when the rule set is identical across calls', () => {
    const rules = [rule('r1'), rule('r2', { domain: 'cdn.openheaders.io' })];
    observeRuleState(rules, NO_MARKERS, false);
    enqueueSpy.mockClear();

    observeRuleState(rules, NO_MARKERS, false);

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// ── SW-restart persistence ─────────────────────────────────────────

describe('storage.session persistence', () => {
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
    };
    return fake;
  }

  it('rehydrateFromStorage reads a previously persisted snapshot', async () => {
    const session = installFakeSession();
    session.store['ruleStateObserver.snapshot'] = {
      r1: {
        effective: true,
        origins: ['https://api.openheaders.io'],
        broad: false,
      },
    };

    await rehydrateFromStorage();

    // Next call diffs against the rehydrated baseline — a transition now fires.
    observeRuleState([rule('r1', { enabled: false })], NO_MARKERS, false);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  it('no-op when storage.session is unavailable', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {};
    await rehydrateFromStorage();
    // Observer falls back to first-run behavior.
    observeRuleState([rule('r1')], NO_MARKERS, false);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('observeRuleState persists the snapshot after each call', async () => {
    const session = installFakeSession();

    observeRuleState([rule('r1')], NO_MARKERS, false);
    await __flushPersistForTests();

    expect(session.set).toHaveBeenCalledTimes(1);
    const arg = (session.set as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toHaveProperty('ruleStateObserver.snapshot');
  });

  it('rehydrated snapshot survives a simulated SW restart', async () => {
    const session = installFakeSession();

    // Pre-restart: observer sees rules, persists snapshot.
    observeRuleState([rule('r1'), rule('r2', { domain: 'cdn.openheaders.io' })], NO_MARKERS, false);
    await __flushPersistForTests();
    expect(session.set).toHaveBeenCalled();

    // Simulate SW restart — wipe module state.
    __resetSnapshotForTests();

    // Post-restart: rehydrate from session store.
    await rehydrateFromStorage();

    // User has deleted r2 during "sleep" — next observeRuleState call
    // diffs against the rehydrated baseline and emits the eviction.
    observeRuleState([rule('r1')], NO_MARKERS, false);
    expect(enqueueSpy).toHaveBeenCalled();
    const [origins] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(new Set(origins)).toEqual(new Set(['http://cdn.openheaders.io', 'https://cdn.openheaders.io']));
  });

  it('rejects malformed persisted data and stays at first-run', async () => {
    const session = installFakeSession();
    session.store['ruleStateObserver.snapshot'] = { r1: { enabled: 'yes' } }; // wrong type

    await rehydrateFromStorage();

    // Snapshot stays null — next call is first-run (no emission).
    observeRuleState([rule('r1')], NO_MARKERS, false);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// ── Broad fallback ─────────────────────────────────────────────────

describe('broad fallback', () => {
  it('passes broad=true when a transitioning rule has a wildcard-subdomain pattern', () => {
    observeRuleState([], NO_MARKERS, false);
    enqueueSpy.mockClear();

    // Add a rule with a wildcard-subdomain URL pattern.
    const broadRule = {
      uid: 'r1',
      path: 'rules/r1',
      name: 'r1',
      type: 'block',
      enabled: true,
      published: true,
      conditions: [{ uid: 'tcd00056', type: 'url-filter', values: ['*://*.openheaders.io/*'] }],
      action: {},
    } as unknown as Rule;

    observeRuleState([broadRule], NO_MARKERS, false);

    const [, broad] = enqueueSpy.mock.calls[0] as [string[], boolean];
    expect(broad).toBe(true);
  });
});
