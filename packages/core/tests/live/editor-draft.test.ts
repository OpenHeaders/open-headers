import { describe, expect, it } from 'vitest';
import {
  type DraftWorkflow,
  draftFromWorkflow,
  newDraftCapture,
  pickPrimaryLv,
  planLiveVariableReconcile,
  stripDraftSteps,
  toDraftCapture,
} from '../../src/live/editor-draft';
import type { Capture, LiveVariable, LiveWorkflow } from '../../src/types/live';

// ── Fixtures ──────────────────────────────────────────────────────

function cap(name: string): Capture {
  return { uid: `cap${name.slice(0, 5).padEnd(5, 'x')}`, name, extractor: { kind: 'whole-body' } };
}

function lv(overrides: Partial<LiveVariable>): LiveVariable {
  return {
    schemaVersion: 5,
    uid: 'lvxxxxxx',
    path: 'live-variables/lv',
    name: 'n',
    workflowUid: 'wfxxxxxx',
    stepId: 'step1',
    captureName: 'n',
    enabled: true,
    ...overrides,
  } as LiveVariable;
}

function wf(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfxxxxxx',
    path: 'live-workflows/wf',
    name: 'wf',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [{ uid: 'stpstep1', id: 'step1', requestUid: 'reqxxxxx', captures: [cap('token')] }],
    ...overrides,
  };
}

// ── toDraftCapture / newDraftCapture ──────────────────────────────

describe('toDraftCapture', () => {
  it('returns exposed=true + liveName from the LV when an LV is given', () => {
    const draft = toDraftCapture(cap('token'), lv({ uid: 'lv1abc2d', name: 'accessToken' }));
    expect(draft.exposed).toBe(true);
    expect(draft.liveName).toBe('accessToken');
    expect(draft.liveUid).toBe('lv1abc2d');
  });

  it('returns exposed=false + liveName = capture name when no LV matches', () => {
    const draft = toDraftCapture(cap('token'), null);
    expect(draft.exposed).toBe(false);
    expect(draft.liveName).toBe('token');
    expect(draft.liveUid).toBeUndefined();
  });
});

describe('newDraftCapture', () => {
  it('defaults new captures to exposed=true + liveName === capture name', () => {
    const draft = newDraftCapture('sessionId', { kind: 'whole-body' });
    expect(draft.exposed).toBe(true);
    expect(draft.liveName).toBe('sessionId');
    expect(draft.liveUid).toBeUndefined();
  });
});

// ── pickPrimaryLv ──────────────────────────────────────────────────

describe('pickPrimaryLv', () => {
  it('returns null when no LV matches', () => {
    expect(pickPrimaryLv('step1', 'token', [])).toBeNull();
  });

  it('prefers the LV whose name equals the capture name (convention)', () => {
    const alias = lv({ uid: 'lvaliasd', name: 'bearer', stepId: 'step1', captureName: 'token' });
    const primary = lv({ uid: 'lvprimar', name: 'token', stepId: 'step1', captureName: 'token' });
    expect(pickPrimaryLv('step1', 'token', [alias, primary])?.uid).toBe('lvprimar');
  });

  it('falls back to the lowest-uid match when no name matches the capture name', () => {
    const a = lv({ uid: 'lvaaaaaa', name: 'bearer', stepId: 'step1', captureName: 'token' });
    const b = lv({ uid: 'lvbbbbbb', name: 'jwt', stepId: 'step1', captureName: 'token' });
    expect(pickPrimaryLv('step1', 'token', [b, a])?.uid).toBe('lvaaaaaa');
  });
});

// ── draftFromWorkflow + stripDraftSteps round-trip ────────────────

describe('draftFromWorkflow + stripDraftSteps', () => {
  it('builds a draft with exposure pre-populated from existing LVs', () => {
    const workflow = wf();
    const vars = [
      lv({ uid: 'lv1abc2d', name: 'token', workflowUid: 'wfxxxxxx', stepId: 'step1', captureName: 'token' }),
    ];
    const draft = draftFromWorkflow(workflow, vars);
    expect(draft.steps[0].captures[0]).toMatchObject({
      name: 'token',
      exposed: true,
      liveName: 'token',
      liveUid: 'lv1abc2d',
    });
  });

  it('marks unexposed captures when no LV exists', () => {
    const draft = draftFromWorkflow(wf(), []);
    expect(draft.steps[0].captures[0].exposed).toBe(false);
  });

  it('strips draft-only fields so the result round-trips to WorkflowStep[]', () => {
    const draft = draftFromWorkflow(wf(), [
      lv({ name: 'token', workflowUid: 'wfxxxxxx', stepId: 'step1', captureName: 'token' }),
    ]);
    const stripped = stripDraftSteps(draft.steps);
    for (const step of stripped) {
      for (const c of step.captures) {
        expect(c).not.toHaveProperty('exposed');
        expect(c).not.toHaveProperty('liveName');
        expect(c).not.toHaveProperty('liveUid');
      }
    }
  });
});

// ── planLiveVariableReconcile ──────────────────────────────────────

function buildDraft(overrides: Partial<DraftWorkflow['steps'][number]['captures'][number]>): DraftWorkflow {
  return {
    name: 'wf',
    description: '',
    refresh: { kind: 'manual' },
    enabled: true,
    steps: [
      {
        uid: 'stpstep1',
        id: 'step1',
        requestUid: 'reqxxxxx',
        captures: [
          {
            uid: 'captoken',
            name: 'token',
            extractor: { kind: 'whole-body' },
            exposed: true,
            liveName: 'token',
            ...overrides,
          },
        ],
      },
    ],
  };
}

describe('planLiveVariableReconcile', () => {
  it('plans a create for an exposed capture with no liveUid', () => {
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({}), []);
    expect(plan.creates).toEqual([{ stepId: 'step1', captureName: 'token', liveName: 'token' }]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it('plans no-op when the LV already matches the draft', () => {
    const existing = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'token' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lv1abc2d' }), [existing]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it('plans an update when the public liveName drifted', () => {
    const existing = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'token' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lv1abc2d', liveName: 'accessToken' }), [
      existing,
    ]);
    expect(plan.updates).toEqual([
      { liveUid: 'lv1abc2d', stepId: 'step1', captureName: 'token', liveName: 'accessToken' },
    ]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it('plans an update when the capture was renamed (captureName drift)', () => {
    const existing = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'old' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lv1abc2d', name: 'token' }), [existing]);
    expect(plan.updates).toEqual([{ liveUid: 'lv1abc2d', stepId: 'step1', captureName: 'token', liveName: 'token' }]);
  });

  it('plans an update when the owning step was renamed (stepId drift)', () => {
    // LV was bound to (step1, token); the user renamed step1 → auth in
    // the workflow editor (slice A's rebind handler kept in-workflow
    // refs in sync, plus left the capture's liveUid pointing here).
    // Save-time reconcile must rebind the LV to the new stepId so
    // {{live.<name>}} resolution doesn't dangle.
    const existing = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'token' });
    const draft = buildDraft({ liveUid: 'lv1abc2d' });
    draft.steps[0].id = 'auth';
    const plan = planLiveVariableReconcile('wfxxxxxx', draft, [existing]);
    expect(plan.updates).toEqual([{ liveUid: 'lv1abc2d', stepId: 'auth', captureName: 'token', liveName: 'token' }]);
  });

  it('leaves alias LVs (independent definitions on the same capture) untouched', () => {
    // L1 is the in-draft LV (capture.liveUid=L1.uid); L2 is an alias
    // that points at the same (workflowUid, stepId, captureName) but
    // wasn't tracked by the editor. Documented v1 behavior: aliases
    // are owned by the LV list page, NOT the workflow editor — the
    // reconcile leaves them alone even when the rename would dangle
    // their references. The LV list surfaces the dangling state and
    // the user fixes it there.
    const tracked = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'token' });
    const alias = lv({ uid: 'lvaliasx', name: 'legacy', stepId: 'step1', captureName: 'token' });
    const draft = buildDraft({ liveUid: 'lv1abc2d' });
    draft.steps[0].id = 'auth';
    const plan = planLiveVariableReconcile('wfxxxxxx', draft, [tracked, alias]);
    expect(plan.updates).toEqual([{ liveUid: 'lv1abc2d', stepId: 'auth', captureName: 'token', liveName: 'token' }]);
    // Alias not in updates / creates / deletes.
    expect(plan.updates.find((u) => u.liveUid === 'lvaliasx')).toBeUndefined();
    expect(plan.deletes).not.toContain('lvaliasx');
  });

  it('plans a delete when a previously-owned capture is now unexposed', () => {
    const existing = lv({ uid: 'lv1abc2d', name: 'token', stepId: 'step1', captureName: 'token' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lv1abc2d', exposed: false }), [existing]);
    expect(plan.deletes).toEqual(['lv1abc2d']);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it('treats a liveUid pointing at a vanished LV as create (LV was deleted out-of-band)', () => {
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lvvanish' }), []);
    expect(plan.creates).toEqual([{ stepId: 'step1', captureName: 'token', liveName: 'token' }]);
  });

  it('leaves aliases alone — LVs not referenced by the draft stay', () => {
    const primary = lv({ uid: 'lvprimar', name: 'token', stepId: 'step1', captureName: 'token' });
    const alias = lv({ uid: 'lvaliass', name: 'bearer', stepId: 'step1', captureName: 'token' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lvprimar' }), [primary, alias]);
    // No op for primary (already matches); alias is NOT in deletes.
    expect(plan.deletes).not.toContain('lvaliass');
    expect(plan.deletes).toHaveLength(0);
  });

  it('does NOT touch an LV whose workflowUid does not match (cross-workflow safety)', () => {
    const otherWf = lv({ uid: 'lv1abc2d', workflowUid: 'wfotherrr', stepId: 'step1', captureName: 'token' });
    const plan = planLiveVariableReconcile('wfxxxxxx', buildDraft({ liveUid: 'lv1abc2d', exposed: false }), [otherWf]);
    // No delete — even though the uid matches, the LV points at a
    // different workflow, so we shouldn't stomp it.
    expect(plan.deletes).toHaveLength(0);
  });
});
