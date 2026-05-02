import { describe, expect, it } from 'vitest';
import { isWorkflowComplete, isWorkflowDraft, isWorkflowEffective } from '../../src/live/workflow-state';
import type { LiveWorkflow, WorkflowStep } from '../../src/types/v5/live';

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
    id,
    requestUid,
    captures: [{ name: 'cap', extractor: { kind: 'whole-body' } }],
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
