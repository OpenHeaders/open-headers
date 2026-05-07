import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import {
  liveWorkflowConflictAdapter,
  liveWorkflowResolveAdapter,
} from '@/workbench/components/live/live-workflow-conflict-adapter';

function makeWf(overrides: Partial<V5.LiveWorkflow> = {}): V5.LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wf-aaaa',
    path: 'live-workflows/wf-aaaa.yaml',
    name: 'Login flow',
    description: 'desc',
    enabled: true,
    refresh: { kind: 'interval', seconds: 300 },
    steps: [{ id: 'step1', requestUid: 'req-bbbb', captures: [] }],
    ...overrides,
  } as V5.LiveWorkflow;
}

describe('liveWorkflowConflictAdapter', () => {
  it('extracts workflow scalars + interval refresh leaves', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(makeWf());
    expect(baseline).toEqual({
      name: 'Login flow',
      description: 'desc',
      enabled: 'true',
      'refresh.kind': 'interval',
      'refresh.seconds': '300',
    });
  });

  it('extracts expires-in refresh leaves', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({ refresh: { kind: 'expires-in', stepId: 'step1', captureName: 'expires_in', leadSeconds: 30 } }),
    );
    expect(baseline['refresh.kind']).toBe('expires-in');
    expect(baseline['refresh.stepId']).toBe('step1');
    expect(baseline['refresh.captureName']).toBe('expires_in');
    expect(baseline['refresh.leadSeconds']).toBe('30');
  });

  it('extracts manual refresh with no extra leaves', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({ refresh: { kind: 'manual' } }),
    );
    expect(Object.keys(baseline).sort()).toEqual(
      ['description', 'enabled', 'name', 'refresh.kind'].sort(),
    );
  });

  it('readPath returns null for unknown leaves', () => {
    expect(liveWorkflowConflictAdapter.readPath(makeWf(), 'steps.0.id')).toBeNull();
    expect(liveWorkflowConflictAdapter.readPath(makeWf(), 'unknown')).toBeNull();
  });

  it('snapshotSets is empty (steps deferred)', () => {
    expect(liveWorkflowConflictAdapter.snapshotSets(makeWf())).toEqual([]);
  });
});

describe('liveWorkflowResolveAdapter', () => {
  it('writes scalar leaves into the entity clone', () => {
    const wf = makeWf();
    liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'name', { base: '', theirs: 'Renamed' });
    expect(wf.name).toBe('Renamed');
    liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'enabled', { base: '', theirs: 'false' });
    expect(wf.enabled).toBe(false);
  });

  it('updates interval refresh seconds when kind matches', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.seconds', { base: '', theirs: '600' }),
    ).toBe(true);
    expect(wf.refresh).toEqual({ kind: 'interval', seconds: 600 });
  });

  it('rejects refresh.seconds when kind is not interval', () => {
    const wf = makeWf({ refresh: { kind: 'manual' } });
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.seconds', { base: '', theirs: '600' }),
    ).toBe(false);
  });

  it('skips refresh.kind transitions (whole-form re-prime owns kind)', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.kind', { base: '', theirs: 'manual' }),
    ).toBe(false);
    expect(wf.refresh.kind).toBe('interval');
  });
});
