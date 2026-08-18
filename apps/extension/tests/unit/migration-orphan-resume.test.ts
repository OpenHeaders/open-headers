/**
 * Orphaned-run detection on SW boot — the kill-SW story's three legs
 * (the extension account-pull plan Phase C): a marker whose session key
 * survived resumes SILENTLY with the same key and selection; a marker
 * whose key is gone (browser restart) or bound to a different run
 * surfaces as interrupted through the run host; a live run or a clean
 * boot (no marker) leaves everything alone. Storage goes through the
 * real run-marker module so the slots exercised here are the ones the
 * run host writes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockHost } = vi.hoisted(() => ({
  mockHost: {
    listWorkspaces: vi.fn(),
    start: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ started: true, runId: 'run-resumed' })),
    getState: vi.fn(() => ({ runId: null as string | null })),
    isLocalRun: vi.fn(() => false),
    adoptInterruptedRun: vi.fn(),
    settled: vi.fn(async () => undefined),
  },
}));

vi.mock('@/background/modules/migration-run/run-host', () => ({
  getSwMigrationRunHost: () => mockHost,
  isLocalMigrationPullRun: () => false,
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { resumeOrphanedMigrationPull } from '@/background/modules/migration-run/orphan-resume';
import {
  type MigrationPullRunMarker,
  writeMigrationRunMarker,
  writeMigrationSessionKey,
} from '@/background/modules/migration-run/run-marker';

interface FakeArea {
  store: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function fakeArea(): FakeArea {
  const store: Record<string, unknown> = {};
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
}

function installStorage(): { local: FakeArea; session: FakeArea } {
  const local = fakeArea();
  const session = fakeArea();
  (globalThis as unknown as Record<string, unknown>).chrome = { storage: { local, session } };
  return { local, session };
}

afterEach(() => {
  mockHost.start.mockClear();
  mockHost.adoptInterruptedRun.mockClear();
  mockHost.getState.mockReset();
  mockHost.getState.mockReturnValue({ runId: null });
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

const MARKER: MigrationPullRunMarker = {
  runId: 'run-orphan',
  workspaceIds: ['ws-1'],
  seq: 12,
  startedAt: '2026-07-16T10:00:00.000Z',
};

describe('resumeOrphanedMigrationPull', () => {
  it('does nothing on a clean boot (no marker)', async () => {
    installStorage();
    await resumeOrphanedMigrationPull();
    expect(mockHost.start).not.toHaveBeenCalled();
    expect(mockHost.adoptInterruptedRun).not.toHaveBeenCalled();
  });

  it('resumes silently with the surviving session key and the marker selection', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-orphan', 'PMAK-test-key');

    await resumeOrphanedMigrationPull();
    expect(mockHost.start).toHaveBeenCalledWith('PMAK-test-key', ['ws-1']);
    expect(mockHost.adoptInterruptedRun).not.toHaveBeenCalled();
  });

  it('resumes a whole-account run without a selection', async () => {
    installStorage();
    await writeMigrationRunMarker({ runId: 'run-orphan', seq: 3, startedAt: '2026-07-16T10:00:00.000Z' });
    await writeMigrationSessionKey('run-orphan', 'PMAK-test-key');

    await resumeOrphanedMigrationPull();
    expect(mockHost.start).toHaveBeenCalledWith('PMAK-test-key', undefined);
  });

  it('falls back to the honest interruption when the silent resume is refused', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-orphan', 'PMAK-test-key');
    mockHost.start.mockResolvedValueOnce({ started: false, reason: 'refused' });

    await resumeOrphanedMigrationPull();
    expect(mockHost.adoptInterruptedRun).toHaveBeenCalledWith(MARKER);
  });

  it('falls back to the honest interruption when the silent resume throws', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-orphan', 'PMAK-test-key');
    mockHost.start.mockRejectedValueOnce(new Error('boom'));

    await resumeOrphanedMigrationPull();
    expect(mockHost.adoptInterruptedRun).toHaveBeenCalledWith(MARKER);
  });

  it('surfaces the run as interrupted when the session key is gone (browser restart)', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);

    await resumeOrphanedMigrationPull();
    expect(mockHost.start).not.toHaveBeenCalled();
    expect(mockHost.adoptInterruptedRun).toHaveBeenCalledWith(MARKER);
  });

  it('treats a key bound to a different run as gone', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-other', 'PMAK-test-key');

    await resumeOrphanedMigrationPull();
    expect(mockHost.start).not.toHaveBeenCalled();
    expect(mockHost.adoptInterruptedRun).toHaveBeenCalledWith(MARKER);
  });

  it('leaves a live run alone', async () => {
    installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-orphan', 'PMAK-test-key');
    mockHost.getState.mockReturnValue({ runId: 'run-live' });

    await resumeOrphanedMigrationPull();
    expect(mockHost.start).not.toHaveBeenCalled();
    expect(mockHost.adoptInterruptedRun).not.toHaveBeenCalled();
  });
});
