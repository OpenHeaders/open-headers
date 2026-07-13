import type { LiveWorkflow } from '@openheaders/core/types';
import {
  liveWorkflowConflictAdapter,
  liveWorkflowResolveAdapter,
} from '@openheaders/ui/workbench/components/live/live-workflow-conflict-adapter';
import { describe, expect, it } from 'vitest';

const STEP_UID = 's0000001';
const CAP_UID = 'c0000001';

function makeWf(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wf-aaaa',
    path: 'live-workflows/wf-aaaa.yaml',
    name: 'Login flow',
    description: 'desc',
    enabled: true,
    refresh: { kind: 'interval', seconds: 300 },
    steps: [{ uid: STEP_UID, id: 'step1', requestUid: 'req-bbbb', captures: [] }],
    ...overrides,
  } as LiveWorkflow;
}

describe('liveWorkflowConflictAdapter', () => {
  it('extracts workflow scalars + interval refresh leaves + per-step leaves', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(makeWf());
    expect(baseline).toEqual({
      name: 'Login flow',
      description: 'desc',
      enabled: 'true',
      'refresh.kind': 'interval',
      'refresh.seconds': '300',
      [`steps.${STEP_UID}.id`]: 'step1',
      [`steps.${STEP_UID}.description`]: '',
      [`steps.${STEP_UID}.requestUid`]: 'req-bbbb',
      [`steps.${STEP_UID}.dependsOn`]: '[]',
      [`steps.${STEP_UID}.runIf`]: '',
      [`steps.${STEP_UID}.priorityFrom`]: '',
      [`steps.${STEP_UID}.retry`]: '',
      [`steps.${STEP_UID}.timeoutMs`]: '',
      [`steps.${STEP_UID}.runScripts`]: '',
    });
  });

  it('extracts the runScripts leaf as its boolean string when set', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({ steps: [{ uid: STEP_UID, id: 'step1', requestUid: 'req-bbbb', captures: [], runScripts: true }] }),
    );
    expect(baseline[`steps.${STEP_UID}.runScripts`]).toBe('true');
  });

  it('extracts retry + timeoutMs leaves with canonical key order', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({
        steps: [
          {
            uid: STEP_UID,
            id: 'step1',
            requestUid: 'req-bbbb',
            captures: [],
            // Edit-insertion key order — the leaf must come out sorted so
            // it compares equal to chrome.storage's alphabetized echo.
            retry: { maxAttempts: 4, delayMs: 2000, backoff: 'exponential', retryOn: ['eq', 429] },
            timeoutMs: 1500,
          },
        ],
      }),
    );
    expect(baseline[`steps.${STEP_UID}.retry`]).toBe(
      '{"backoff":"exponential","delayMs":2000,"maxAttempts":4,"retryOn":["eq",429]}',
    );
    expect(baseline[`steps.${STEP_UID}.timeoutMs`]).toBe('1500');
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

  it('extracts manual refresh with no extra refresh leaves (still emits per-step leaves)', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(makeWf({ refresh: { kind: 'manual' } }));
    const refreshKeys = Object.keys(baseline).filter((k) => k.startsWith('refresh.'));
    expect(refreshKeys).toEqual(['refresh.kind']);
  });

  it('readPath returns null for unknown leaves and ignores positional step paths', () => {
    expect(liveWorkflowConflictAdapter.readPath(makeWf(), 'steps.0.id')).toBeNull();
    expect(liveWorkflowConflictAdapter.readPath(makeWf(), 'unknown')).toBeNull();
    // Per-uid step path resolves.
    expect(liveWorkflowConflictAdapter.readPath(makeWf(), `steps.${STEP_UID}.id`)).toBe('step1');
  });

  it('snapshotSets emits the steps set + per-step captures snapshots', () => {
    const wf = makeWf({
      steps: [
        {
          uid: STEP_UID,
          id: 'step1',
          requestUid: 'req-bbbb',
          captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
        },
      ],
    });
    const snaps = liveWorkflowConflictAdapter.snapshotSets(wf);
    expect(snaps).toHaveLength(2);
    expect(snaps[0].setPath).toBe('steps');
    expect(snaps[0].byUid.get(STEP_UID)?.summary).toBe('step1');
    expect(snaps[1].setPath).toBe(`steps.${STEP_UID}.captures`);
    expect(snaps[1].byUid.get(CAP_UID)?.summary).toBe('token');
  });

  it('snapshotSetsFromForm reconstructs membership from path keys', () => {
    const form = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({
        steps: [
          {
            uid: STEP_UID,
            id: 'step1',
            requestUid: 'req-bbbb',
            captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
          },
        ],
      }),
    );
    const snaps = liveWorkflowConflictAdapter.snapshotSetsFromForm(form, makeWf());
    const stepSnap = snaps.find((s) => s.setPath === 'steps');
    expect(stepSnap?.byUid.has(STEP_UID)).toBe(true);
    expect(stepSnap?.byUid.get(STEP_UID)?.summary).toBe('step1');
    const capSnap = snaps.find((s) => s.setPath === `steps.${STEP_UID}.captures`);
    expect(capSnap?.byUid.has(CAP_UID)).toBe(true);
    expect(capSnap?.byUid.get(CAP_UID)?.summary).toBe('token');
  });

  it('extracts per-capture leaves with opaque-stringified extractor', () => {
    const baseline = liveWorkflowConflictAdapter.extractBaseline(
      makeWf({
        steps: [
          {
            uid: STEP_UID,
            id: 'step1',
            requestUid: 'req-bbbb',
            captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
          },
        ],
      }),
    );
    expect(baseline[`steps.${STEP_UID}.captures.${CAP_UID}.name`]).toBe('token');
    expect(baseline[`steps.${STEP_UID}.captures.${CAP_UID}.extractor`]).toBe('{"kind":"json-path","path":"$.token"}');
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
    expect(liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.seconds', { base: '', theirs: '600' })).toBe(
      true,
    );
    expect(wf.refresh).toEqual({ kind: 'interval', seconds: 600 });
  });

  it('rejects refresh.seconds when kind is not interval', () => {
    const wf = makeWf({ refresh: { kind: 'manual' } });
    expect(liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.seconds', { base: '', theirs: '600' })).toBe(
      false,
    );
  });

  it('skips refresh.kind transitions (whole-form re-prime owns kind)', () => {
    const wf = makeWf();
    expect(liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'refresh.kind', { base: '', theirs: 'manual' })).toBe(
      false,
    );
    expect(wf.refresh.kind).toBe('interval');
  });

  it('writes per-step leaves into the matching step by uid', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.id`, {
        base: '',
        theirs: 'auth',
      }),
    ).toBe(true);
    expect(wf.steps[0].id).toBe('auth');
  });

  it('writes opaque dependsOn leaf via JSON parse', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.dependsOn`, {
        base: '',
        theirs: '["other"]',
      }),
    ).toBe(true);
    expect(wf.steps[0].dependsOn).toEqual(['other']);
  });

  it('writes retry via JSON parse and timeoutMs numerically; empty clears both', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.retry`, {
        base: '',
        theirs: '{"maxAttempts":3,"backoff":"exponential"}',
      }),
    ).toBe(true);
    expect(wf.steps[0].retry).toEqual({ maxAttempts: 3, backoff: 'exponential' });
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.timeoutMs`, {
        base: '',
        theirs: '2500',
      }),
    ).toBe(true);
    expect(wf.steps[0].timeoutMs).toBe(2500);
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.retry`, { base: '', theirs: '' }),
    ).toBe(true);
    expect(wf.steps[0].retry).toBeUndefined();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.timeoutMs`, { base: '', theirs: '' }),
    ).toBe(true);
    expect(wf.steps[0].timeoutMs).toBeUndefined();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.timeoutMs`, {
        base: '',
        theirs: 'not-a-number',
      }),
    ).toBe(false);
  });

  it('writes runScripts as a boolean; empty clears it', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.runScripts`, {
        base: '',
        theirs: 'true',
      }),
    ).toBe(true);
    expect(wf.steps[0].runScripts).toBe(true);
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.runScripts`, {
        base: '',
        theirs: 'false',
      }),
    ).toBe(true);
    expect(wf.steps[0].runScripts).toBe(false);
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.runScripts`, { base: '', theirs: '' }),
    ).toBe(true);
    expect(wf.steps[0].runScripts).toBeUndefined();
  });

  it('rejects malformed JSON on opaque leaves', () => {
    const wf = makeWf();
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.runIf`, {
        base: '',
        theirs: 'not-json',
      }),
    ).toBe(false);
  });

  it('writes per-capture leaves into the matching capture by uid', () => {
    const wf = makeWf({
      steps: [
        {
          uid: STEP_UID,
          id: 'step1',
          requestUid: 'req-bbbb',
          captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
        },
      ],
    });
    expect(
      liveWorkflowResolveAdapter.applyResolutionToEntity(wf, `steps.${STEP_UID}.captures.${CAP_UID}.name`, {
        base: '',
        theirs: 'access_token',
      }),
    ).toBe(true);
    expect(wf.steps[0].captures[0].name).toBe('access_token');
  });

  it('returns false when the step uid does not exist in the entity', () => {
    const wf = makeWf();
    expect(liveWorkflowResolveAdapter.applyResolutionToEntity(wf, 'steps.zzzzzzzz.id', { base: '', theirs: 'x' })).toBe(
      false,
    );
  });

  it('prettyPath labels per-step + per-capture leaves with their human ids', () => {
    const wf = makeWf({
      steps: [
        {
          uid: STEP_UID,
          id: 'login',
          requestUid: 'req-bbbb',
          captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'whole-body' } }],
        },
      ],
    });
    expect(liveWorkflowResolveAdapter.prettyPath(wf, `steps.${STEP_UID}.id`)).toBe('Step login (id)');
    expect(liveWorkflowResolveAdapter.prettyPath(wf, `steps.${STEP_UID}.captures.${CAP_UID}.name`)).toBe(
      'Step login → token (name)',
    );
  });
});
