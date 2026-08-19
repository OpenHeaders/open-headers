import { describe, expect, it } from 'vitest';
import {
  isWorkflowComplete,
  isWorkflowDraft,
  isWorkflowEffective,
  workflowStepsResolvable,
} from '../../src/live/workflow-state';
import type { LiveWorkflow, WorkflowStep } from '../../src/types/live';

function wf(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfxxxxxx',
    path: 'live-workflows/wf',
    name: 'wf',
    enabled: true,
    published: true,
    refresh: { kind: 'manual' },
    steps: [step('step1', 'reqxxxxx')],
    ...overrides,
  };
}

function step(id: string, requestUid: string): WorkflowStep {
  return {
    uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid,
    captures: [{ uid: 'cap0capx', name: 'cap', extractor: { kind: 'whole-body' } }],
  };
}

describe('isWorkflowComplete', () => {
  it('returns true for a single-step workflow with a request', () => {
    expect(isWorkflowComplete(wf())).toBe(true);
  });

  it('returns false when the workflow has zero steps', () => {
    expect(isWorkflowComplete(wf({ steps: [] }))).toBe(false);
  });

  it('returns false when a step has an empty requestUid', () => {
    expect(isWorkflowComplete(wf({ steps: [step('step1', '')] }))).toBe(false);
  });

  it('returns false when the validator reports structural errors', () => {
    // Duplicate step ids — validateWorkflowShape flags duplicate-step-id.
    const workflow = wf({ steps: [step('step1', 'reqxxxxx'), step('step1', 'reqyyyyy')] });
    expect(isWorkflowComplete(workflow)).toBe(false);
  });

  it('returns false when a depends-on edge cycles', () => {
    const workflow = wf({
      steps: [
        { ...step('step1', 'reqxxxxx'), dependsOn: ['step2'] },
        { ...step('step2', 'reqyyyyy'), dependsOn: ['step1'] },
      ],
    });
    expect(isWorkflowComplete(workflow)).toBe(false);
  });

  // Trust boundary: persisted rows the renderer reads raw can be
  // malformed — the gate answers "incomplete" instead of throwing.
  it('returns false for a malformed row with non-array steps instead of throwing', () => {
    expect(isWorkflowComplete(wf({ steps: undefined as unknown as LiveWorkflow['steps'] }))).toBe(false);
    expect(isWorkflowComplete(wf({ steps: {} as unknown as LiveWorkflow['steps'] }))).toBe(false);
  });

  it('returns false for malformed step rows instead of throwing', () => {
    expect(isWorkflowComplete(wf({ steps: [null] as unknown as LiveWorkflow['steps'] }))).toBe(false);
  });
});

describe('isWorkflowDraft', () => {
  it('returns false when published === true', () => {
    expect(isWorkflowDraft(wf())).toBe(false);
  });

  it('returns true when published is false', () => {
    expect(isWorkflowDraft(wf({ published: false }))).toBe(true);
  });

  it('returns true when published is undefined', () => {
    expect(isWorkflowDraft(wf({ published: undefined }))).toBe(true);
  });
});

describe('isWorkflowEffective', () => {
  it('returns true when published + enabled + complete', () => {
    expect(isWorkflowEffective(wf())).toBe(true);
  });

  it('returns false when published is false, even if enabled + complete', () => {
    expect(isWorkflowEffective(wf({ published: false }))).toBe(false);
  });

  it('returns false when published is undefined (draft), even if enabled + complete', () => {
    expect(isWorkflowEffective(wf({ published: undefined }))).toBe(false);
  });

  it('returns false when disabled, even if published + complete', () => {
    expect(isWorkflowEffective(wf({ enabled: false }))).toBe(false);
  });

  it('returns false when incomplete, even if published + enabled', () => {
    expect(isWorkflowEffective(wf({ steps: [] }))).toBe(false);
  });
});

describe('workflowStepsResolvable', () => {
  it('true when every step requestUid is in the known set', () => {
    const workflow = wf({ steps: [step('step1', 'reqaaaaa'), step('step2', 'reqbbbbb')] });
    expect(workflowStepsResolvable(workflow, new Set(['reqaaaaa', 'reqbbbbb']))).toBe(true);
  });

  it('false when a step requestUid is absent from the known set', () => {
    const workflow = wf({ steps: [step('step1', 'reqaaaaa'), step('step2', 'reqgone1')] });
    expect(workflowStepsResolvable(workflow, new Set(['reqaaaaa']))).toBe(false);
  });

  it('true when a step requestUid is empty — the not-yet-picked placeholder is not a deleted request', () => {
    expect(workflowStepsResolvable(wf({ steps: [step('step1', '')] }), new Set())).toBe(true);
  });
});
