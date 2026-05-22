import { describe, expect, it } from 'vitest';
import { workflowDefinitionFingerprint } from '../../src/live/workflow-scan';
import type { LiveWorkflow, WorkflowStep } from '../../src/types/live';

function step(id: string, requestUid: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid,
    captures: [{ uid: 'cap0capx', name: 'cap', extractor: { kind: 'whole-body' } }],
    ...overrides,
  };
}

function wf(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfxxxxxx',
    path: 'live-workflows/wf',
    name: 'wf',
    enabled: true,
    published: true,
    refresh: { kind: 'interval', seconds: 300 },
    steps: [step('step1', 'reqxxxxx')],
    ...overrides,
  };
}

describe('workflowDefinitionFingerprint', () => {
  it('is stable for structurally-identical workflows', () => {
    expect(workflowDefinitionFingerprint(wf())).toBe(workflowDefinitionFingerprint(wf()));
  });

  it('is unchanged by cosmetic + identity edits', () => {
    const base = workflowDefinitionFingerprint(wf());
    expect(workflowDefinitionFingerprint(wf({ uid: 'wfother0' }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ path: 'live-workflows/moved' }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ name: 'Renamed' }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ description: 'new docs' }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ schemaVersion: 6 }))).toBe(base);
  });

  it('is unchanged by scheduling-axis edits (enabled / published / refresh)', () => {
    const base = workflowDefinitionFingerprint(wf());
    expect(workflowDefinitionFingerprint(wf({ enabled: false }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ published: false }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ refresh: { kind: 'interval', seconds: 600 } }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ refresh: { kind: 'manual' } }))).toBe(base);
  });

  it('is unchanged by per-step / per-capture cosmetic fields', () => {
    const base = workflowDefinitionFingerprint(wf());
    expect(workflowDefinitionFingerprint(wf({ steps: [step('step1', 'reqxxxxx', { uid: 'stpOTHER' })] }))).toBe(base);
    expect(workflowDefinitionFingerprint(wf({ steps: [step('step1', 'reqxxxxx', { description: 'docs' })] }))).toBe(
      base,
    );
    expect(
      workflowDefinitionFingerprint(
        wf({
          steps: [
            step('step1', 'reqxxxxx', {
              captures: [{ uid: 'capOTHER', name: 'cap', extractor: { kind: 'whole-body' } }],
            }),
          ],
        }),
      ),
    ).toBe(base);
  });

  it('changes when a step is re-pointed at a different request', () => {
    expect(workflowDefinitionFingerprint(wf({ steps: [step('step1', 'reqOTHER')] }))).not.toBe(
      workflowDefinitionFingerprint(wf()),
    );
  });

  it('changes when a step extractor changes', () => {
    const edited = wf({
      steps: [
        step('step1', 'reqxxxxx', {
          captures: [{ uid: 'cap0capx', name: 'cap', extractor: { kind: 'json-path', path: '$.token' } }],
        }),
      ],
    });
    expect(workflowDefinitionFingerprint(edited)).not.toBe(workflowDefinitionFingerprint(wf()));
  });

  it('changes when a capture is renamed', () => {
    const edited = wf({
      steps: [
        step('step1', 'reqxxxxx', {
          captures: [{ uid: 'cap0capx', name: 'renamed', extractor: { kind: 'whole-body' } }],
        }),
      ],
    });
    expect(workflowDefinitionFingerprint(edited)).not.toBe(workflowDefinitionFingerprint(wf()));
  });

  it('changes when a step is added, removed, or reordered', () => {
    const base = workflowDefinitionFingerprint(wf());
    const two = wf({ steps: [step('step1', 'reqxxxxx'), step('step2', 'reqyyyyy')] });
    expect(workflowDefinitionFingerprint(two)).not.toBe(base);
    const reordered = wf({ steps: [step('step2', 'reqyyyyy'), step('step1', 'reqxxxxx')] });
    expect(workflowDefinitionFingerprint(reordered)).not.toBe(workflowDefinitionFingerprint(two));
  });

  it('changes when a gate / priority ref changes, ignores depends-on ordering', () => {
    const base = workflowDefinitionFingerprint(
      wf({ steps: [step('step1', 'reqxxxxx'), { ...step('step2', 'reqyyyyy'), dependsOn: ['step1'] }] }),
    );
    const gated = workflowDefinitionFingerprint(
      wf({
        steps: [
          step('step1', 'reqxxxxx'),
          {
            ...step('step2', 'reqyyyyy'),
            dependsOn: ['step1'],
            runIf: { all: [{ kind: 'status', uid: 'gateclz1', stepId: 'step1', match: '2xx' }] },
          },
        ],
      }),
    );
    expect(gated).not.toBe(base);

    // depends-on is an edge SET — declared order within it is not semantic.
    const a = workflowDefinitionFingerprint(
      wf({
        steps: [
          step('step1', 'reqxxxxx'),
          step('step2', 'reqyyyyy'),
          { ...step('step3', 'reqzzzzz'), dependsOn: ['step1', 'step2'] },
        ],
      }),
    );
    const b = workflowDefinitionFingerprint(
      wf({
        steps: [
          step('step1', 'reqxxxxx'),
          step('step2', 'reqyyyyy'),
          { ...step('step3', 'reqzzzzz'), dependsOn: ['step2', 'step1'] },
        ],
      }),
    );
    expect(a).toBe(b);
  });
});
