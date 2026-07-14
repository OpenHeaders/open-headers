import { describe, expect, it } from 'vitest';
import {
  foldPullEvent,
  initialPullRunState,
  type MigrationPullRunState,
  type PostmanPullEvent,
  startPullRunState,
} from '../../src/import';

function foldAll(events: PostmanPullEvent[], from?: MigrationPullRunState): MigrationPullRunState {
  return events.reduce(foldPullEvent, from ?? startPullRunState('run-1'));
}

describe('pull-run progress fold', () => {
  it('starts idle with no run identity', () => {
    const state = initialPullRunState();
    expect(state.runId).toBeNull();
    expect(state.phase).toBe('idle');
  });

  it('stamps the run id and resets everything on start', () => {
    const dirty = foldAll([
      { kind: 'planned', workspaces: 1, collections: 2, environments: 1, totalCalls: 5 },
      {
        kind: 'item-progress',
        item: 'collection',
        id: 'c-1',
        status: 'pulled',
        completedItems: 1,
        totalItems: 3,
      },
    ]);
    const restarted = startPullRunState('run-2');
    expect(restarted.runId).toBe('run-2');
    expect(restarted.phase).toBe('enumerating');
    expect(restarted.completedItems).toBe(0);
    expect(restarted.lastItem).toBeNull();
    expect(dirty.completedItems).toBe(1);
  });

  it('walks enumerating → pulling with the plan and item progress', () => {
    const state = foldAll([
      { kind: 'enumerating', step: 'workspace-list', completedCalls: 1 },
      { kind: 'planned', workspaces: 2, collections: 3, environments: 2, totalCalls: 8 },
      {
        kind: 'item-progress',
        item: 'environment',
        id: 'e-1',
        name: 'Staging',
        status: 'pulled',
        completedItems: 1,
        totalItems: 5,
      },
    ]);
    expect(state.phase).toBe('pulling');
    expect(state.planned).toEqual({ workspaces: 2, collections: 3, environments: 2, totalCalls: 8 });
    expect(state.totalItems).toBe(5);
    expect(state.completedItems).toBe(1);
    expect(state.lastItem).toEqual({ item: 'environment', id: 'e-1', name: 'Staging', status: 'pulled' });
  });

  it('keeps a skipped item reason on the last-item line', () => {
    const state = foldAll([
      {
        kind: 'item-progress',
        item: 'collection',
        id: 'c-9',
        status: 'skipped',
        reason: 'payload was not readable',
        completedItems: 2,
        totalItems: 4,
      },
    ]);
    expect(state.lastItem).toMatchObject({ status: 'skipped', reason: 'payload was not readable' });
  });

  it('sets the pause on 429 and clears it on the next progress', () => {
    const paused = foldAll([{ kind: 'rate-limit-pause', retryAfterSeconds: 12 }]);
    expect(paused.pause).toEqual({ retryAfterSeconds: 12 });

    // A budget read arrives mid-pause (headers of the retried call) —
    // the countdown must survive it.
    const budgeted = foldPullEvent(paused, { kind: 'budget', limitMonth: 10_000, remainingMonth: 9_000 });
    expect(budgeted.pause).toEqual({ retryAfterSeconds: 12 });
    expect(budgeted.budget).toEqual({ limitMonth: 10_000, remainingMonth: 9_000 });

    const resumed = foldPullEvent(budgeted, {
      kind: 'item-progress',
      item: 'collection',
      id: 'c-1',
      status: 'pulled',
      completedItems: 1,
      totalItems: 2,
    });
    expect(resumed.pause).toBeNull();
  });

  it('records the pull outcome and counts on finished', () => {
    const state = foldAll([
      { kind: 'finished', outcome: 'partial', stopReason: 'monthly cap', collections: 2, environments: 1, skipped: 3 },
    ]);
    expect(state.phase).toBe('done');
    expect(state.outcome).toBe('partial');
    expect(state.stopReason).toBe('monthly cap');
    expect(state.pulled).toEqual({ collections: 2, environments: 1, skipped: 3 });
  });

  it('walks the materialization tail: importing → imported', () => {
    const summary = {
      workspaces: [
        {
          workspaceId: 'ws-team',
          workspaceName: 'OpenHeaders Team',
          collections: 2,
          environments: 1,
          requests: 14,
          examples: 0,
          drops: 3,
        },
      ],
      collections: 2,
      environments: 1,
      requests: 14,
      examples: 0,
      drops: 3,
    };
    const importing = foldAll([
      { kind: 'finished', outcome: 'complete', collections: 2, environments: 1, skipped: 0 },
      { kind: 'importing' },
    ]);
    expect(importing.phase).toBe('importing');

    const done = foldPullEvent(importing, { kind: 'imported', summary });
    expect(done.phase).toBe('done');
    expect(done.imported).toEqual(summary);
    expect(done.importError).toBeNull();
  });

  it('surfaces a materialization failure without losing the pull outcome', () => {
    const state = foldAll([
      { kind: 'finished', outcome: 'complete', collections: 1, environments: 0, skipped: 0 },
      { kind: 'importing' },
      { kind: 'import-failed', reason: 'landing workspace is not loaded on this host' },
    ]);
    expect(state.phase).toBe('done');
    expect(state.outcome).toBe('complete');
    expect(state.importError).toBe('landing workspace is not loaded on this host');
    expect(state.imported).toBeNull();
  });
});
