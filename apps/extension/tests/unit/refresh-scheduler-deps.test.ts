/**
 * Shared `RefreshScheduler` — dependency-aware reconcile + jitter.
 *
 * Contract:
 *   - `RefreshProvider.computeDependencies` is optional. When present,
 *     each job gets a topological depth; scheduled `when` is offset by
 *     `depth * DEPENDENCY_JITTER_MS + random(0, DEPENDENCY_JITTER_MS)`.
 *   - Providers that omit it treat every job as depth 0 (plus the
 *     random jitter) — OAuth's existing behavior.
 *   - Cycles are handled: the DFS break returns depth 0 for any node
 *     it revisits mid-walk, so the scheduler still fires (correctness
 *     over topology when the graph is broken).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefreshProvider } from '@/background/modules/refresh-scheduler';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const createMock = vi.fn();
const clearMock = vi.fn();
const getAllMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: (...args: unknown[]) => createMock(...args),
    clear: (...args: unknown[]) => clearMock(...args),
    getAll: () => getAllMock(),
  },
}));

import { DEPENDENCY_JITTER_MS, RefreshScheduler } from '@/background/modules/refresh-scheduler';

interface Job {
  id: string;
  next: number | null;
  deps?: string[];
  canRun?: boolean;
}

function makeProvider(jobs: Job[], opts: { omitDeps?: boolean } = {}): RefreshProvider<{ id: string }, Job, unknown> {
  return {
    alarmPrefix: 'test:',
    decodeAlarm: (name) => (name.startsWith('test:') ? { id: name.slice('test:'.length) } : null),
    encodeAlarm: (job) => `test:${job.id}`,
    encodeAlarmFromPayload: (p) => `test:${p.id}`,
    listAll: async () => jobs,
    getByAlarm: async (p) => jobs.find((j) => j.id === p.id) ?? null,
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
  createMock.mockClear();
  clearMock.mockClear();
  getAllMock.mockReset();
  getAllMock.mockResolvedValue([]);
  // Deterministic jitter — Math.random always yields mid-range.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reconcile — dependency-aware scheduling', () => {
  it('fires a root job at depth 0 (jitter only)', async () => {
    const jobs: Job[] = [{ id: 'A', next: 1_000_000 }];
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test');
    await scheduler.reconcile(0);

    expect(createMock).toHaveBeenCalledTimes(1);
    const [, options] = createMock.mock.calls[0];
    // Math.random = 0.5 → floor(0.5 * 250) = 125ms jitter added.
    expect(options.when).toBe(1_000_000 + Math.floor(0.5 * DEPENDENCY_JITTER_MS));
  });

  it('depths downstream jobs so they fire after upstream on the same wave', async () => {
    const jobs: Job[] = [
      { id: 'upstream', next: 1_000_000 },
      { id: 'downstream', next: 1_000_000, deps: ['upstream'] },
    ];
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test');
    await scheduler.reconcile(0);

    expect(createMock).toHaveBeenCalledTimes(2);
    const byName = new Map<string, number>();
    for (const [name, options] of createMock.mock.calls) {
      byName.set(name, options.when);
    }
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
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test');
    await scheduler.reconcile(0);

    expect(createMock).toHaveBeenCalledTimes(2);
    // Both nodes are scheduled; topology is degraded but correctness
    // preserved (exact depth of cycle members is implementation detail).
    const names = createMock.mock.calls.map(([n]) => n).sort();
    expect(names).toEqual(['test:A', 'test:B']);
  });

  it('omitting computeDependencies applies only random jitter (OAuth shape)', async () => {
    const jobs: Job[] = [
      { id: 'A', next: 1_000_000 },
      { id: 'B', next: 1_000_000 },
    ];
    const scheduler = new RefreshScheduler(makeProvider(jobs, { omitDeps: true }), 'Test');
    await scheduler.reconcile(0);

    const randomJitter = Math.floor(0.5 * DEPENDENCY_JITTER_MS);
    for (const [, options] of createMock.mock.calls) {
      expect(options.when).toBe(1_000_000 + randomJitter);
    }
  });

  it('a job with no parents in the graph is treated as depth 0 even when other jobs have deps', async () => {
    const jobs: Job[] = [
      { id: 'upstream', next: 2_000_000 },
      { id: 'unrelated', next: 2_000_000 },
      { id: 'downstream', next: 2_000_000, deps: ['upstream'] },
    ];
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test');
    await scheduler.reconcile(0);

    const byName = new Map<string, number>();
    for (const [name, options] of createMock.mock.calls) {
      byName.set(name, options.when);
    }
    const randomJitter = Math.floor(0.5 * DEPENDENCY_JITTER_MS);
    expect(byName.get('test:upstream')).toBe(2_000_000 + randomJitter);
    expect(byName.get('test:unrelated')).toBe(2_000_000 + randomJitter);
    expect(byName.get('test:downstream')).toBe(2_000_000 + DEPENDENCY_JITTER_MS + randomJitter);
  });

  it('clears orphan alarms carrying the prefix', async () => {
    const jobs: Job[] = [{ id: 'A', next: 1_000 }];
    getAllMock.mockResolvedValue([
      { name: 'test:gone', scheduledTime: 0 },
      { name: 'other:keep', scheduledTime: 0 },
    ]);
    const scheduler = new RefreshScheduler(makeProvider(jobs), 'Test');
    await scheduler.reconcile(0);
    expect(clearMock).toHaveBeenCalledWith('test:gone');
    expect(clearMock).not.toHaveBeenCalledWith('other:keep');
  });
});
