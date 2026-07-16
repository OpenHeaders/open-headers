/**
 * Migration run bookkeeping slots — the marker (`chrome.storage.local`,
 * survives a browser restart) and the session key
 * (`chrome.storage.session`, memory-backed, gone on restart). Covers
 * the round-trips, the clears, marker validation (a malformed slot
 * reads as absent), and tolerance of missing storage areas — and the
 * law that the marker never carries the key.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  clearMigrationRunMarker,
  clearMigrationSessionKey,
  type MigrationPullRunMarker,
  readMigrationPullRunMarkerValue,
  readMigrationRunMarker,
  readMigrationSessionKey,
  writeMigrationRunMarker,
  writeMigrationSessionKey,
} from '@/background/modules/migration-run/run-marker';

interface FakeArea {
  store: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function fakeArea(seed: Record<string, unknown> = {}): FakeArea {
  const store: Record<string, unknown> = { ...seed };
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
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

const MARKER: MigrationPullRunMarker = {
  runId: 'run-1',
  workspaceIds: ['ws-1', 'ws-2'],
  seq: 7,
  startedAt: '2026-07-16T10:00:00.000Z',
};

describe('run marker slot', () => {
  it('round-trips through chrome.storage.local and clears', async () => {
    const { local } = installStorage();
    await writeMigrationRunMarker(MARKER);
    expect(Object.keys(local.store)).toEqual(['migration.pullRunMarker']);
    expect(await readMigrationRunMarker()).toEqual(MARKER);
    await clearMigrationRunMarker();
    expect(local.store).toEqual({});
    expect(await readMigrationRunMarker()).toBeNull();
  });

  it('round-trips a whole-account marker (no workspaceIds)', async () => {
    installStorage();
    const marker: MigrationPullRunMarker = { runId: 'run-2', seq: 0, startedAt: '2026-07-16T10:00:00.000Z' };
    await writeMigrationRunMarker(marker);
    expect(await readMigrationRunMarker()).toEqual(marker);
  });

  it('never carries the key', async () => {
    const { local } = installStorage();
    await writeMigrationRunMarker(MARKER);
    await writeMigrationSessionKey('run-1', 'PMAK-test-key');
    expect(JSON.stringify(local.store)).not.toContain('PMAK-test-key');
  });

  it('reads a malformed slot as absent', () => {
    expect(readMigrationPullRunMarkerValue(null)).toBeNull();
    expect(readMigrationPullRunMarkerValue('run-1')).toBeNull();
    expect(readMigrationPullRunMarkerValue({ runId: '', seq: 0, startedAt: 'x' })).toBeNull();
    expect(readMigrationPullRunMarkerValue({ runId: 'run-1', seq: 'x', startedAt: 'x' })).toBeNull();
    expect(readMigrationPullRunMarkerValue({ runId: 'run-1', seq: 0 })).toBeNull();
    expect(readMigrationPullRunMarkerValue({ runId: 'run-1', seq: 0, startedAt: 'x', workspaceIds: [1] })).toBeNull();
    expect(readMigrationPullRunMarkerValue(MARKER)).toEqual(MARKER);
  });

  it('tolerates a missing storage area', async () => {
    await expect(writeMigrationRunMarker(MARKER)).resolves.toBeUndefined();
    expect(await readMigrationRunMarker()).toBeNull();
    await expect(clearMigrationRunMarker()).resolves.toBeUndefined();
  });
});

describe('session key slot', () => {
  it('round-trips through chrome.storage.session bound to its runId and clears', async () => {
    const { session, local } = installStorage();
    await writeMigrationSessionKey('run-1', 'PMAK-test-key');
    expect(Object.keys(session.store)).toEqual(['migration.pullSessionKey']);
    // The key lives in the session area ONLY — never the disk-backed one.
    expect(local.store).toEqual({});
    expect(await readMigrationSessionKey()).toEqual({ runId: 'run-1', apiKey: 'PMAK-test-key' });
    await clearMigrationSessionKey();
    expect(session.store).toEqual({});
    expect(await readMigrationSessionKey()).toBeNull();
  });

  it('reads a malformed entry as absent', async () => {
    const { session } = installStorage();
    session.store['migration.pullSessionKey'] = { runId: 'run-1' };
    expect(await readMigrationSessionKey()).toBeNull();
    session.store['migration.pullSessionKey'] = { runId: '', apiKey: 'PMAK-test-key' };
    expect(await readMigrationSessionKey()).toBeNull();
  });

  it('tolerates a missing session area', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = { storage: {} };
    await expect(writeMigrationSessionKey('run-1', 'PMAK-test-key')).resolves.toBeUndefined();
    expect(await readMigrationSessionKey()).toBeNull();
    await expect(clearMigrationSessionKey()).resolves.toBeUndefined();
  });
});
