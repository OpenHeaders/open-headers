import { describe, expect, it } from 'vitest';
import type { RequestInfoProvider, StepRequestInfo } from '../../src/live/step-validation';
import { validateStepReferences, validateWorkflowShape } from '../../src/live/step-validation';
import type { LiveWorkflow, RefreshPolicy, WorkflowStep } from '../../src/types/v5/live';

function wf(steps: WorkflowStep[], refresh: RefreshPolicy = { kind: 'manual' }): LiveWorkflow {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'wflow001',
    path: 'live-workflows/wf',
    name: 'wf',
    enabled: true,
    refresh,
    steps,
  };
}

function step(id: string, requestUid: string, captureNames: string[] = []): WorkflowStep {
  return {
    id,
    requestUid,
    captures: captureNames.map((n) => ({ name: n, extractor: { kind: 'whole-body' } as const })),
  };
}

/** Convenience: build a provider from a static map of uid → info. */
function infoProvider(entries: Record<string, Partial<StepRequestInfo>>): RequestInfoProvider {
  return (uid: string) => {
    const hit = entries[uid];
    if (!hit) return null;
    return {
      templates: hit.templates ?? [],
      incompleteReason: hit.incompleteReason ?? null,
    };
  };
}

describe('validateWorkflowShape', () => {
  it('returns [] for a valid single-step workflow', () => {
    expect(validateWorkflowShape(wf([step('only', 'reqonly1', ['value'])]))).toEqual([]);
  });

  it('catches duplicate step ids', () => {
    const errors = validateWorkflowShape(wf([step('x', 'req1only', []), step('x', 'req2only', [])]));
    expect(errors.some((e) => e.issue === 'duplicate-step-id')).toBe(true);
  });

  it('catches duplicate capture names within a step', () => {
    const errors = validateWorkflowShape(wf([step('one', 'req1only', ['val', 'val'])]));
    expect(errors.some((e) => e.issue === 'duplicate-capture-name')).toBe(true);
  });

  it('catches refresh policy referencing an unknown step', () => {
    const errors = validateWorkflowShape(
      wf([step('first', 'reqfirst', ['expires_in'])], {
        kind: 'expires-in',
        stepId: 'ghost',
        captureName: 'expires_in',
        leadSeconds: 60,
      }),
    );
    expect(errors.some((e) => e.issue === 'refresh-unknown-step')).toBe(true);
  });

  it('catches refresh policy referencing an unknown capture', () => {
    const errors = validateWorkflowShape(
      wf([step('first', 'reqfirst', ['some_other'])], {
        kind: 'expires-at',
        stepId: 'first',
        captureName: 'missing',
        leadSeconds: 0,
      }),
    );
    expect(errors.some((e) => e.issue === 'refresh-unknown-capture')).toBe(true);
  });

  it('allows interval refresh without referencing any step', () => {
    const errors = validateWorkflowShape(wf([step('one', 'reqonly01', ['v'])], { kind: 'interval', seconds: 300 }));
    expect(errors).toEqual([]);
  });
});

describe('validateStepReferences — step refs', () => {
  it('returns [] when templates reference nothing', () => {
    const provider = infoProvider({ reqonly01: { templates: ['GET /x'] } });
    expect(validateStepReferences(wf([step('only', 'reqonly01', ['v'])]), provider)).toEqual([]);
  });

  it('flags forward references (step 1 → step 2)', () => {
    const wflow = wf([step('a', 'reqa0001', ['x']), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: ['{{step.b.x}}'] },
      reqb0001: { templates: [] },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors.some((e) => e.issue === 'step-forward-reference')).toBe(true);
  });

  it('flags self references', () => {
    const wflow = wf([step('a', 'reqa0001', ['x'])]);
    const provider = infoProvider({ reqa0001: { templates: ['{{step.a.x}}'] } });
    const errors = validateStepReferences(wflow, provider);
    expect(errors[0].issue).toBe('step-forward-reference');
  });

  it('flags unknown step ids', () => {
    const wflow = wf([step('a', 'reqa0001', []), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [] },
      reqb0001: { templates: ['{{step.ghost.something}}'] },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors[0]).toMatchObject({ issue: 'step-unknown-step-id', referencedStepId: 'ghost' });
  });

  it('flags unknown capture names on an otherwise-valid step ref', () => {
    const wflow = wf([step('a', 'reqa0001', ['only-this']), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [] },
      reqb0001: { templates: ['{{step.a.missing}}'] },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors[0]).toMatchObject({ issue: 'step-unknown-capture', referencedCaptureName: 'missing' });
  });

  it('accepts valid backward references (step 2 → step 1)', () => {
    const wflow = wf([step('a', 'reqa0001', ['sessionId']), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [] },
      reqb0001: { templates: ['Cookie: session={{step.a.sessionId}}'] },
    });
    expect(validateStepReferences(wflow, provider)).toEqual([]);
  });

  it('collects errors across multiple step templates', () => {
    const wflow = wf([step('a', 'reqa0001', ['x']), step('b', 'reqb0001', []), step('c', 'reqc0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [] },
      reqb0001: { templates: ['{{step.ghost.z}}'] },
      reqc0001: { templates: ['{{step.a.missing}}'] },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors).toHaveLength(2);
  });
});

describe('validateStepReferences — request existence + completeness', () => {
  it('reports a missing request (provider returns null) as step-request-missing', () => {
    const wflow = wf([step('a', 'reqghost0', [])]);
    const provider: RequestInfoProvider = () => null;
    const errors = validateStepReferences(wflow, provider);
    expect(errors[0]).toMatchObject({ issue: 'step-request-missing', referencedStepId: 'reqghost0' });
  });

  it('reports an incomplete request as step-request-incomplete', () => {
    const wflow = wf([step('a', 'reqincomp', [])]);
    const provider = infoProvider({
      reqincomp: { templates: [], incompleteReason: 'missing-url' },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      issue: 'step-request-incomplete',
      stepId: 'a',
      referencedStepId: 'reqincomp',
      incompleteReason: 'missing-url',
    });
  });

  it('surfaces both incompleteness AND step-ref issues so editor sees every problem at once', () => {
    const wflow = wf([step('a', 'reqa0001', ['x']), step('b', 'reqbadly1', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [] },
      reqbadly1: {
        templates: ['{{step.ghost.z}}'],
        incompleteReason: 'bearer-missing-token',
      },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors).toHaveLength(2);
    const issues = errors.map((e) => e.issue).sort();
    expect(issues).toEqual(['step-request-incomplete', 'step-unknown-step-id']);
  });

  it('returns [] when every step has a complete backing request + clean templates', () => {
    const wflow = wf([step('a', 'reqa0001', []), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: [], incompleteReason: null },
      reqb0001: { templates: [], incompleteReason: null },
    });
    expect(validateStepReferences(wflow, provider)).toEqual([]);
  });
});
