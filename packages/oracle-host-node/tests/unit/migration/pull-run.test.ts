/**
 * Pull-run orchestrator coverage: broadcast sequence + folded state off
 * the injected puller, the single-run gate, the materialization tail
 * (imported / import-failed), the no-payload short-circuit, and the
 * key-leak guard across every broadcast payload.
 */

import type {
  MigrationPullRunState,
  PostmanImportSummary,
  PostmanPullEvent,
  PostmanPullResult,
} from '@openheaders/core/import';
import { setHostLogger } from '@openheaders/core/logger';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMigrationPullRunner } from '../../../src/migration/pull-run';

const API_KEY = 'PMAK-super-secret-key';

const SUMMARY: PostmanImportSummary = {
  workspaces: [
    {
      workspaceId: 'ws-team',
      workspaceName: 'Team',
      collections: 1,
      environments: 1,
      requests: 3,
      examples: 0,
      globals: 0,
      drops: 0,
    },
  ],
  collections: 1,
  environments: 1,
  requests: 3,
  examples: 0,
  globals: 0,
  drops: 0,
};

function pullResult(overrides: Partial<PostmanPullResult> = {}): PostmanPullResult {
  return {
    outcome: 'complete',
    workspaces: [{ id: 'ws-1', name: 'Team' }],
    collections: [{ item: 'collection', id: 'c-1', name: 'APIs', json: '{}', workspaceIds: ['ws-1'] }],
    environments: [{ item: 'environment', id: 'e-1', name: 'Staging', json: '{}', workspaceIds: ['ws-1'] }],
    globals: [],
    skipped: [],
    budget: {},
    callsMade: 4,
    ...overrides,
  };
}

const PULL_EVENTS: PostmanPullEvent[] = [
  { kind: 'enumerating', step: 'workspace-list', completedCalls: 1 },
  { kind: 'planned', workspaces: 1, collections: 1, environments: 1, totalCalls: 4 },
  { kind: 'item-progress', item: 'collection', id: 'c-1', status: 'pulled', completedItems: 1, totalItems: 2 },
  { kind: 'item-progress', item: 'environment', id: 'e-1', status: 'pulled', completedItems: 2, totalItems: 2 },
  { kind: 'finished', outcome: 'complete', collections: 1, environments: 1, skipped: 0 },
];

interface BroadcastRecord {
  type: string;
  payload: { runId: string; seq: number; event: PostmanPullEvent };
}

function makeHarness(options: {
  result?: PostmanPullResult;
  events?: PostmanPullEvent[];
  materialize?: (result: PostmanPullResult) => Promise<PostmanImportSummary>;
  pull?: (opts: {
    apiKey: string;
    onEvent: (event: PostmanPullEvent) => void;
    isCanceled?: () => boolean;
  }) => Promise<PostmanPullResult>;
}) {
  const broadcasts: BroadcastRecord[] = [];
  const runner = createMigrationPullRunner({
    broadcast: (type, payload) => broadcasts.push({ type, payload: payload as BroadcastRecord['payload'] }),
    pull:
      options.pull ??
      (async ({ onEvent }) => {
        for (const event of options.events ?? PULL_EVENTS) onEvent(event);
        return options.result ?? pullResult();
      }),
    materialize: options.materialize ?? (async () => SUMMARY),
  });
  return { runner, broadcasts };
}

beforeEach(() => {
  setHostLogger(consoleLogger);
});

describe('createMigrationPullRunner', () => {
  it('broadcasts every pull event plus the materialization tail, in order with monotonic seq', async () => {
    const { runner, broadcasts } = makeHarness({});
    const start = runner.start(API_KEY);
    expect(start.started).toBe(true);
    await runner.settled();

    expect(broadcasts.map((b) => b.type)).toEqual(Array(7).fill('migrationPullEvent'));
    expect(broadcasts.map((b) => b.payload.event.kind)).toEqual([
      'enumerating',
      'planned',
      'item-progress',
      'item-progress',
      'finished',
      'importing',
      'imported',
    ]);
    expect(broadcasts.map((b) => b.payload.seq)).toEqual(broadcasts.map((_, i) => i + 1));
    expect(new Set(broadcasts.map((b) => b.payload.runId)).size).toBe(1);
    expect(broadcasts[0]?.payload.runId).toBe(start.runId);
  });

  it('folds the same events into getState, ending imported', async () => {
    const { runner } = makeHarness({});
    runner.start(API_KEY);
    await runner.settled();

    const state: MigrationPullRunState = runner.getState();
    expect(state.phase).toBe('done');
    expect(state.outcome).toBe('complete');
    expect(state.imported).toEqual(SUMMARY);
    expect(state.importError).toBeNull();
  });

  it('rejects a second start while a run is in flight, and allows one after it settles', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { runner } = makeHarness({
      pull: async () => {
        await gate;
        return pullResult({ collections: [], environments: [], outcome: 'complete' });
      },
    });

    expect(runner.start(API_KEY).started).toBe(true);
    const second = runner.start(API_KEY);
    expect(second.started).toBe(false);
    expect(second.reason).toContain('already running');

    release();
    await runner.settled();
    expect(runner.start(API_KEY).started).toBe(true);
    await runner.settled();
  });

  it('skips materialization on a failed pull', async () => {
    let materialized = 0;
    const { runner, broadcasts } = makeHarness({
      events: [
        { kind: 'finished', outcome: 'failed', stopReason: 'no list', collections: 0, environments: 0, skipped: 0 },
      ],
      result: pullResult({ outcome: 'failed', stopReason: 'no list', collections: [], environments: [] }),
      materialize: async () => {
        materialized++;
        return SUMMARY;
      },
    });
    runner.start(API_KEY);
    await runner.settled();

    expect(materialized).toBe(0);
    expect(broadcasts.map((b) => b.payload.event.kind)).toEqual(['finished']);
    expect(runner.getState().phase).toBe('done');
  });

  it('skips materialization when nothing was pulled', async () => {
    let materialized = 0;
    const { runner } = makeHarness({
      events: [{ kind: 'finished', outcome: 'complete', collections: 0, environments: 0, skipped: 0 }],
      result: pullResult({ collections: [], environments: [] }),
      materialize: async () => {
        materialized++;
        return SUMMARY;
      },
    });
    runner.start(API_KEY);
    await runner.settled();
    expect(materialized).toBe(0);
  });

  it('materializes a globals-only pull — workspace variables are payload too', async () => {
    let materialized = 0;
    const { runner } = makeHarness({
      events: [{ kind: 'finished', outcome: 'complete', collections: 0, environments: 0, skipped: 0 }],
      result: pullResult({
        collections: [],
        environments: [],
        globals: [
          {
            workspaceId: 'ws-1',
            variables: [{ name: 'api_host', value: 'api.openheaders.io', type: 'default' }],
          },
        ],
      }),
      materialize: async () => {
        materialized++;
        return SUMMARY;
      },
    });
    runner.start(API_KEY);
    await runner.settled();
    expect(materialized).toBe(1);
  });

  it('materializes a labeled partial so what arrived is not discarded', async () => {
    let materialized = 0;
    const { runner } = makeHarness({
      result: pullResult({ outcome: 'partial', stopReason: 'monthly cap' }),
      materialize: async () => {
        materialized++;
        return SUMMARY;
      },
    });
    runner.start(API_KEY);
    await runner.settled();
    expect(materialized).toBe(1);
    expect(runner.getState().imported).toEqual(SUMMARY);
  });

  it('surfaces a materialization failure as import-failed and unblocks the next run', async () => {
    const { runner, broadcasts } = makeHarness({
      materialize: async () => {
        throw new Error('landing workspace exploded');
      },
    });
    runner.start(API_KEY);
    await runner.settled();

    const kinds = broadcasts.map((b) => b.payload.event.kind);
    expect(kinds[kinds.length - 1]).toBe('import-failed');
    expect(runner.getState().importError).toContain('landing workspace exploded');
    expect(runner.start(API_KEY).started).toBe(true);
    await runner.settled();
  });

  it('stop() cancels the in-flight pull — the puller sees the flag and a canceled result never materializes', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let materialized = 0;
    const { runner, broadcasts } = makeHarness({
      pull: async ({ onEvent, isCanceled }) => {
        await gate;
        expect(isCanceled?.()).toBe(true);
        onEvent({
          kind: 'finished',
          outcome: 'canceled',
          stopReason: 'You stopped the import — nothing was imported.',
          collections: 1,
          environments: 0,
          skipped: 0,
        });
        // Items pulled before the stop ride the result — they must
        // still not materialize.
        return pullResult({ outcome: 'canceled', stopReason: 'You stopped the import — nothing was imported.' });
      },
      materialize: async () => {
        materialized++;
        return SUMMARY;
      },
    });
    runner.start(API_KEY);
    expect(runner.stop()).toBe(true);
    release();
    await runner.settled();

    expect(materialized).toBe(0);
    expect(broadcasts.map((b) => b.payload.event.kind)).toEqual(['finished']);
    expect(runner.getState()).toMatchObject({ phase: 'done', outcome: 'canceled' });
    expect(runner.start(API_KEY).started).toBe(true);
    await runner.settled();
  });

  it('stop() answers false when nothing is stoppable — idle, settled, or already materializing', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let materialized = 0;
    const { runner } = makeHarness({
      materialize: async () => {
        await gate;
        materialized++;
        return SUMMARY;
      },
    });
    expect(runner.stop()).toBe(false);

    runner.start(API_KEY);
    // The injected puller settles synchronously, so the run reaches the
    // materialization phase within a tick — too late to stop.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runner.getState().phase).toBe('importing');
    expect(runner.stop()).toBe(false);
    release();
    await runner.settled();
    expect(materialized).toBe(1);
    expect(runner.stop()).toBe(false);
  });

  it('never leaks the key through broadcasts or state', async () => {
    const { runner, broadcasts } = makeHarness({
      materialize: async () => {
        throw new Error('boom');
      },
    });
    runner.start(API_KEY);
    await runner.settled();

    expect(JSON.stringify(broadcasts)).not.toContain(API_KEY);
    expect(JSON.stringify(runner.getState())).not.toContain(API_KEY);
  });
});
