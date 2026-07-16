/**
 * SW migration run host — the extension leg of "one runner, no forks"
 * (EXTENSION_ACCOUNT_PULL_PLAN.md Phase B). Covers: acceptance persists
 * the run marker + the runId-bound session key BEFORE start resolves
 * (an SW death right after acceptance is already resumable); every
 * locally-produced event fans out as the ONE `migrationPullEvent`
 * broadcast and bumps the marker's seq; both slots clear on settle
 * whatever the outcome; one run at a time; the marker never carries
 * the key; and the local-runId registry the mirror dedupes against.
 */

import type { PostmanImportSummary, PostmanPullEvent, PostmanPullResult } from '@openheaders/core/import';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast } = vi.hoisted(() => ({ mockBroadcast: vi.fn() }));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createSwMigrationRunHost } from '@/background/modules/migration-run/run-host';

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
  mockBroadcast.mockReset();
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

const API_KEY = 'PMAK-test-key';

function completeResult(): PostmanPullResult {
  return {
    outcome: 'complete',
    workspaces: [{ id: 'ws-1', name: 'Team' }],
    collections: [{ item: 'collection', id: 'c-1', name: 'API', json: '{"info":{}}', workspaceIds: ['ws-1'] }],
    environments: [],
    globals: [],
    skipped: [],
    budget: {},
    callsMade: 3,
  };
}

const SUMMARY: PostmanImportSummary = {
  workspaces: [
    {
      workspaceId: 'oh-ws-1',
      workspaceName: 'Team',
      collections: 1,
      environments: 0,
      requests: 2,
      examples: 0,
      globals: 0,
      drops: 0,
    },
  ],
  collections: 1,
  environments: 0,
  requests: 2,
  examples: 0,
  globals: 0,
  drops: 0,
};

type PullSeam = (options: {
  apiKey: string;
  workspaceIds?: string[];
  onEvent: (event: PostmanPullEvent) => void;
}) => Promise<PostmanPullResult>;

/** A pull seam the test releases by hand, emitting one event per phase. */
function deferredPull(): {
  pull: PullSeam;
  emit: (event: PostmanPullEvent) => void;
  release: (result: PostmanPullResult) => void;
} {
  let onEvent: ((event: PostmanPullEvent) => void) | null = null;
  let resolve: ((result: PostmanPullResult) => void) | null = null;
  const pull: PullSeam = (options) =>
    new Promise<PostmanPullResult>((res) => {
      onEvent = options.onEvent;
      resolve = res;
    });
  return {
    pull,
    emit: (event) => onEvent?.(event),
    release: (result) => resolve?.(result),
  };
}

describe('createSwMigrationRunHost', () => {
  it('runs a pull locally: marker + session key at acceptance, broadcasts + seq bumps, clears on settle', async () => {
    const { local, session } = installStorage();
    const { pull, emit, release } = deferredPull();
    const materialize = vi.fn(async () => SUMMARY);
    const host = createSwMigrationRunHost({ pull, materialize });

    const result = await host.start(API_KEY, ['ws-1']);
    expect(result.started).toBe(true);
    const runId = result.runId as string;
    expect(runId).toBeTruthy();
    expect(host.isLocalRun(runId)).toBe(true);
    expect(host.isLocalRun('someone-elses-run')).toBe(false);

    // Acceptance already persisted both slots — an SW death here resumes.
    expect(local.store['migration.pullRunMarker']).toMatchObject({ runId, workspaceIds: ['ws-1'], seq: 0 });
    expect(session.store['migration.pullSessionKey']).toEqual({ runId, apiKey: API_KEY });
    // The marker (the only disk-backed slot) never carries the key.
    expect(JSON.stringify(local.store)).not.toContain(API_KEY);

    emit({ kind: 'enumerating', step: 'workspace-list', completedCalls: 1 });
    expect(mockBroadcast).toHaveBeenCalledWith('migrationPullEvent', {
      runId,
      seq: 1,
      event: { kind: 'enumerating', step: 'workspace-list', completedCalls: 1 },
    });
    await vi.waitFor(() => {
      expect(local.store['migration.pullRunMarker']).toMatchObject({ runId, seq: 1 });
    });

    release(completeResult());
    await host.settled();
    expect(materialize).toHaveBeenCalledTimes(1);
    // The materialization tail rode the same broadcast: importing → imported.
    expect(mockBroadcast).toHaveBeenCalledWith('migrationPullEvent', { runId, seq: 2, event: { kind: 'importing' } });
    expect(mockBroadcast).toHaveBeenCalledWith('migrationPullEvent', {
      runId,
      seq: 3,
      event: { kind: 'imported', summary: SUMMARY },
    });
    expect(host.getState()).toMatchObject({ runId, phase: 'done', imported: SUMMARY });

    // Settling cleared both slots — the key's lifetime is the run's.
    await vi.waitFor(() => {
      expect(local.store).toEqual({});
      expect(session.store).toEqual({});
    });
  });

  it('refuses a second start while a run is in flight', async () => {
    installStorage();
    const { pull, release } = deferredPull();
    const host = createSwMigrationRunHost({ pull, materialize: vi.fn(async () => SUMMARY) });

    const first = await host.start(API_KEY);
    expect(first.started).toBe(true);
    const second = await host.start(API_KEY, ['ws-1']);
    expect(second).toEqual({ started: false, reason: 'A migration pull is already running on this host.' });

    release(completeResult());
    await host.settled();
  });

  it('clears both slots on settle even when the run failed with nothing to land', async () => {
    const { local, session } = installStorage();
    const { pull, release } = deferredPull();
    const materialize = vi.fn(async () => SUMMARY);
    const host = createSwMigrationRunHost({ pull, materialize });

    await host.start(API_KEY);
    release({ ...completeResult(), outcome: 'failed', stopReason: 'The key was rejected.', collections: [] });
    await host.settled();

    expect(materialize).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(local.store).toEqual({});
      expect(session.store).toEqual({});
    });
  });

  it('a whole-account start persists a marker without workspaceIds', async () => {
    const { local } = installStorage();
    const { pull, release } = deferredPull();
    const host = createSwMigrationRunHost({ pull, materialize: vi.fn(async () => SUMMARY) });

    const result = await host.start(API_KEY);
    const marker = local.store['migration.pullRunMarker'] as Record<string, unknown>;
    expect(marker.runId).toBe(result.runId);
    expect('workspaceIds' in marker).toBe(false);

    release(completeResult());
    await host.settled();
  });
});
