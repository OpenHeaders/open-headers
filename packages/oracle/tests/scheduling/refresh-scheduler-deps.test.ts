/**
 * Host-neutral `RefreshScheduler` — dependency-aware reconcile + jitter.
 *
 * Contract:
 *   - `RefreshProvider.computeDependencies` is optional. When present,
 *     each job gets a topological depth; the armed `when` is offset by
 *     `depth * DEPENDENCY_JITTER_MS + random(0, DEPENDENCY_JITTER_MS)`.
 *   - Providers that omit it treat every job as depth 0 (plus the
 *     random jitter) — OAuth's shape.
 *   - Cycles are handled: the DFS break returns depth 0 for any node
 *     it revisits mid-walk, so the scheduler still fires (correctness
 *     over topology when the graph is broken).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPENDENCY_JITTER_MS, type RefreshProvider, RefreshScheduler, type RefreshTimer } from '../../src/scheduling';

interface FakeTimer extends RefreshTimer {
  armCalls: Array<[string, number]>;
  cancelCalls: string[];
  externallyArmed: string[];
}

function makeTimer(): FakeTimer {
  const armCalls: Array<[string, number]> = [];
  const cancelCalls: string[] = [];
  const externallyArmed: string[] = [];
  return {
    available: true,
    armCalls,
    cancelCalls,
    externallyArmed,
    arm(key, atMs) {
      armCalls.push([key, atMs]);
    },
    cancel(key) {
      cancelCalls.push(key);
    },
    async listArmed() {
      return [...armCalls.map(([k]) => k), ...externallyArmed];
    },
  };
}

interface Job {
  id: string;
  next: number | null;
  deps?: string[];
  canRun?: boolean;
}

function makeProvider(jobs: Job[], opts: { omitDeps?: boolean } = {}): RefreshProvider<{ id: string }, Job, unknown> {
  return {
    keyPrefix: 'test:',
    decodeKey: (name) => (name.startsWith('test:') ? { id: name.slice('test:'.length) } : null),
    encodeKey: (job) => `test:${job.id}`,
    encodeKeyFromPayload: (p) => `test:${p.id}`,
    listAll: async () => jobs,
    getByKey: async (p) => jobs.find((j) => j.id === p.id) ?? null,
    computeNextFireAt: (job) => job.next,
    canSchedule: (job) => job.canRun !== false,
    refresh: async () => {},
    recordFailure: async () => ({}),
    onStoreChange: () => () => {},
    onFired: () => {},
    onSucceeded: () => {},
    onFailed: () => {},
    ...(opts.omitDeps
      ? {}
      : {
          computeDependencies: () => {
            const out = new Map<string, string[]>();
            for (const job of jobs) {
              if (job.deps)
                out.set(
                  `test:${job.id}`,
                  job.deps.map((d) => `test:${d}`),
                );
            }
            return out;
          },
        }),
  };
}

beforeEach(() => {
  // Deterministic jitter — Math.random always yields mid-range.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reconcile — dependency-aware scheduling', () => {
  it('fires a root job at depth 0 (jitter only)', async () => {
    const jobs: Job[] = [{ id: 'A', next: 1_000_000 }];
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test', timer);
    await scheduler.reconcile(0);

    expect(timer.armCalls).toHaveLength(1);
    const [, when] = timer.armCalls[0];
    // Math.random = 0.5 → floor(0.5 * 250) = 125ms jitter added.
    expect(when).toBe(1_000_000 + Math.floor(0.5 * DEPENDENCY_JITTER_MS));
  });

  it('depths downstream jobs so they fire after upstream on the same wave', async () => {
    const jobs: Job[] = [
      { id: 'upstream', next: 1_000_000 },
      { id: 'downstream', next: 1_000_000, deps: ['upstream'] },
    ];
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test', timer);
    await scheduler.reconcile(0);

    expect(timer.armCalls).toHaveLength(2);
    const byName = new Map<string, number>(timer.armCalls);
    const randomJitter = Math.floor(0.5 * DEPENDENCY_JITTER_MS);
    expect(byName.get('test:upstream')).toBe(1_000_000 + randomJitter);
    // Depth 1 + random jitter.
    expect(byName.get('test:downstream')).toBe(1_000_000 + DEPENDENCY_JITTER_MS + randomJitter);
  });

  it('handles a cycle gracefully — every node still gets scheduled', async () => {
    const jobs: Job[] = [
      { id: 'A', next: 1_000_000, deps: ['B'] },
      { id: 'B', next: 1_000_000, deps: ['A'] },
    ];
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test', timer);
    await scheduler.reconcile(0);

    expect(timer.armCalls).toHaveLength(2);
    // Both nodes are armed; topology is degraded but correctness
    // preserved (exact depth of cycle members is implementation detail).
    const names = timer.armCalls.map(([n]) => n).sort();
    expect(names).toEqual(['test:A', 'test:B']);
  });

  it('omitting computeDependencies applies only random jitter (OAuth shape)', async () => {
    const jobs: Job[] = [
      { id: 'A', next: 1_000_000 },
      { id: 'B', next: 1_000_000 },
    ];
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(makeProvider(jobs, { omitDeps: true }), 'Test', timer);
    await scheduler.reconcile(0);

    const randomJitter = Math.floor(0.5 * DEPENDENCY_JITTER_MS);
    for (const [, when] of timer.armCalls) {
      expect(when).toBe(1_000_000 + randomJitter);
    }
  });

  it('a job with no parents in the graph is treated as depth 0 even when other jobs have deps', async () => {
    const jobs: Job[] = [
      { id: 'upstream', next: 2_000_000 },
      { id: 'unrelated', next: 2_000_000 },
      { id: 'downstream', next: 2_000_000, deps: ['upstream'] },
    ];
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test', timer);
    await scheduler.reconcile(0);

    const byName = new Map<string, number>(timer.armCalls);
    const randomJitter = Math.floor(0.5 * DEPENDENCY_JITTER_MS);
    expect(byName.get('test:upstream')).toBe(2_000_000 + randomJitter);
    expect(byName.get('test:unrelated')).toBe(2_000_000 + randomJitter);
    expect(byName.get('test:downstream')).toBe(2_000_000 + DEPENDENCY_JITTER_MS + randomJitter);
  });

  it('clears orphan keys carrying the prefix', async () => {
    const jobs: Job[] = [{ id: 'A', next: 1_000 }];
    const timer = makeTimer();
    timer.externallyArmed.push('test:gone', 'other:keep');
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test', timer);
    await scheduler.reconcile(0);
    expect(timer.cancelCalls).toContain('test:gone');
    expect(timer.cancelCalls).not.toContain('other:keep');
  });
});
