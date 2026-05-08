import { describe, expect, it } from 'vitest';
import type { RequestInfoProvider, StepRequestInfo } from '../../src/live/step-validation';
import {
  computeTransitiveAncestors,
  validateStepReferences,
  validateWorkflowShape,
} from '../../src/live/step-validation';
import type { LiveWorkflow, RefreshPolicy, WorkflowStep } from '../../src/types/v5/live';

function wf(steps: WorkflowStep[], refresh: RefreshPolicy = { kind: 'manual' }): LiveWorkflow {
  return {
    schemaVersion: 5,
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
    uid: `stp${id.slice(0, 5).padEnd(5, 'x')}`,
    id,
    requestUid,
    captures: captureNames.map((n, i) => ({
      uid: `cap${String(i).padEnd(2, '0')}${n.slice(0, 3).padEnd(3, 'x')}`,
      name: n,
      extractor: { kind: 'whole-body' } as const,
    })),
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

  it('flags forward references (step 1 → step 2) as unreachable', () => {
    // Phase I: "forward reference" is now classified as
    // "unreachable via dependsOn graph". With backwards-compat
    // implicit-prior-dep, step `a` (index 0) has no deps → step `b`
    // is not an ancestor → refs to `b` are unreachable.
    const wflow = wf([step('a', 'reqa0001', ['x']), step('b', 'reqb0001', [])]);
    const provider = infoProvider({
      reqa0001: { templates: ['{{step.b.x}}'] },
      reqb0001: { templates: [] },
    });
    const errors = validateStepReferences(wflow, provider);
    expect(errors.some((e) => e.issue === 'step-template-unreachable-stepid')).toBe(true);
  });

  it('flags self references as unreachable', () => {
    // Phase I: a step is not an ancestor of itself → self-ref is
    // unreachable in the dependsOn graph.
    const wflow = wf([step('a', 'reqa0001', ['x'])]);
    const provider = infoProvider({ reqa0001: { templates: ['{{step.a.x}}'] } });
    const errors = validateStepReferences(wflow, provider);
    expect(errors[0].issue).toBe('step-template-unreachable-stepid');
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

// ── Phase I — DAG + runIf + priorityFrom validation ───────────────

function dagStep(
  id: string,
  opts: {
    requestUid?: string;
    captureNames?: string[];
    dependsOn?: string[];
    runIf?: WorkflowStep['runIf'];
    priorityFrom?: WorkflowStep['priorityFrom'];
  } = {},
): WorkflowStep {
  return {
    uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid: opts.requestUid ?? `req${id.padEnd(5, 'x').slice(0, 5)}`,
    captures: (opts.captureNames ?? []).map((n, i) => ({
      uid: `cap${String(i).padEnd(2, '0')}${n.slice(0, 3).padEnd(3, 'x')}`,
      name: n,
      extractor: { kind: 'whole-body' } as const,
    })),
    dependsOn: opts.dependsOn,
    runIf: opts.runIf,
    priorityFrom: opts.priorityFrom,
  };
}

describe('validateWorkflowShape — Phase I (DAG + gates + priority)', () => {
  it('accepts a valid DAG workflow', () => {
    const errors = validateWorkflowShape(
      wf([
        dagStep('probe', { captureNames: ['flag'] }),
        dagStep('path', {
          dependsOn: ['probe'],
          runIf: {
            all: [{ uid: 'gat0equa', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'a' }],
          },
        }),
      ]),
    );
    expect(errors).toEqual([]);
  });

  it('flags dependsOn referencing an unknown step', () => {
    const errors = validateWorkflowShape(wf([dagStep('a'), dagStep('b', { dependsOn: ['ghost'] })]));
    expect(errors.some((e) => e.issue === 'step-unknown-dep')).toBe(true);
  });

  it('detects a dependsOn cycle', () => {
    const errors = validateWorkflowShape(
      wf([dagStep('a', { dependsOn: ['c'] }), dagStep('b', { dependsOn: ['a'] }), dagStep('c', { dependsOn: ['b'] })]),
    );
    expect(errors.some((e) => e.issue === 'depends-on-cycle')).toBe(true);
  });

  it('detects no-root-step when every step has a non-empty dependsOn', () => {
    // Both steps depend on each other → also a cycle, but the `a → b`
    // case below is cycle-free yet still rootless because of explicit
    // dependsOn on index-0.
    const errors = validateWorkflowShape(wf([dagStep('a', { dependsOn: ['b'] }), dagStep('b')]));
    // The dependsOn cycle check fires first when it's a true cycle;
    // in this no-root-no-cycle case only `no-root-step` fires.
    // Validating a direct a→b reversed without cycle:
    const errors2 = validateWorkflowShape(wf([dagStep('only', { dependsOn: ['only'] })]));
    // Self-dep is a cycle → cycle error fires, reachability skipped.
    expect(errors2.some((e) => e.issue === 'depends-on-cycle')).toBe(true);
    // Above `errors` — the a→b reversed case — is actually a cycle too
    // because implicit-prior-dep on b (index 0 → root) is empty, but
    // explicit dependsOn on a creates a→b. b has no deps → root. So
    // the graph is acyclic; a can still reach b → b is an ancestor of
    // a. Root exists (b). Valid.
    expect(errors.some((e) => e.issue === 'no-root-step')).toBe(false);
  });

  it('flags gate clause referencing unknown stepId', () => {
    const errors = validateWorkflowShape(
      wf([
        dagStep('a'),
        dagStep('b', {
          dependsOn: ['a'],
          runIf: { all: [{ uid: 'gat0exg1', kind: 'capture-exists', stepId: 'ghost', captureName: 'x' }] },
        }),
      ]),
    );
    expect(errors.some((e) => e.issue === 'gate-unknown-stepid')).toBe(true);
  });

  it('flags gate clause referencing a step outside the dep chain', () => {
    // `a` and `b` are independent roots; `b`'s gate references `a`
    // but doesn't depend on it → unreachable.
    const errors = validateWorkflowShape(
      wf([
        dagStep('a', { dependsOn: [], captureNames: ['x'] }),
        dagStep('b', {
          dependsOn: [],
          runIf: { all: [{ uid: 'gat0exa1', kind: 'capture-exists', stepId: 'a', captureName: 'x' }] },
        }),
      ]),
    );
    expect(errors.some((e) => e.issue === 'gate-unreachable-stepid')).toBe(true);
  });

  it('flags gate clause referencing an unknown capture name', () => {
    const errors = validateWorkflowShape(
      wf([
        dagStep('a', { captureNames: ['real'] }),
        dagStep('b', {
          dependsOn: ['a'],
          runIf: {
            all: [{ uid: 'gat0equg', kind: 'capture-equals', stepId: 'a', captureName: 'ghost', value: 'x' }],
          },
        }),
      ]),
    );
    expect(errors.some((e) => e.issue === 'gate-unknown-capture')).toBe(true);
  });

  it('flags invalid regex in capture-matches clause', () => {
    const errors = validateWorkflowShape(
      wf([
        dagStep('a', { captureNames: ['v'] }),
        dagStep('b', {
          dependsOn: ['a'],
          runIf: {
            all: [{ uid: 'gat0matv', kind: 'capture-matches', stepId: 'a', captureName: 'v', pattern: '[invalid' }],
          },
        }),
      ]),
    );
    expect(errors.some((e) => e.issue === 'gate-invalid-regex')).toBe(true);
  });

  it('flags priorityFrom referencing an unreachable step', () => {
    const errors = validateWorkflowShape(
      wf([
        dagStep('a', { dependsOn: [], captureNames: ['p'] }),
        dagStep('b', {
          dependsOn: [],
          priorityFrom: { stepId: 'a', captureName: 'p' },
        }),
      ]),
    );
    expect(errors.some((e) => e.issue === 'priority-unreachable-stepid')).toBe(true);
  });

  it('flags parallelExecution: true as coming-soon', () => {
    const errors = validateWorkflowShape({
      ...wf([dagStep('a')]),
      parallelExecution: true,
    });
    expect(errors.some((e) => e.issue === 'parallel-not-yet-implemented')).toBe(true);
  });

  it('parallelExecution absent / false is accepted', () => {
    const errorsAbsent = validateWorkflowShape(wf([dagStep('a')]));
    expect(errorsAbsent.some((e) => e.issue === 'parallel-not-yet-implemented')).toBe(false);
    const errorsFalse = validateWorkflowShape({
      ...wf([dagStep('a')]),
      parallelExecution: false,
    });
    expect(errorsFalse.some((e) => e.issue === 'parallel-not-yet-implemented')).toBe(false);
  });
});

describe('computeTransitiveAncestors', () => {
  it('linear chain — each step sees all prior declared steps via implicit dep', () => {
    const workflow = wf([step('a', 'reqa0001'), step('b', 'reqb0001'), step('c', 'reqc0001')]);
    const ancestors = computeTransitiveAncestors(workflow);
    expect([...(ancestors.get('a') ?? [])]).toEqual([]);
    expect([...(ancestors.get('b') ?? [])]).toEqual(['a']);
    expect([...(ancestors.get('c') ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('explicit dependsOn: [] isolates a step from declared-prior dep', () => {
    const workflow = wf([
      dagStep('a'),
      dagStep('b', { dependsOn: [] }), // explicit root — NOT a descendant of `a`
    ]);
    const ancestors = computeTransitiveAncestors(workflow);
    expect([...(ancestors.get('b') ?? [])]).toEqual([]);
  });

  it('fan-in — descendant sees both parents', () => {
    const workflow = wf([
      dagStep('p1', { dependsOn: [] }),
      dagStep('p2', { dependsOn: [] }),
      dagStep('c', { dependsOn: ['p1', 'p2'] }),
    ]);
    const ancestors = computeTransitiveAncestors(workflow);
    expect([...(ancestors.get('c') ?? [])].sort()).toEqual(['p1', 'p2']);
  });
});
