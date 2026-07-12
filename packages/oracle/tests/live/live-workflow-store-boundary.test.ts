/**
 * Write-boundary schema gate for the live-workflow store: RPC-shaped
 * step payloads are validated BEFORE any persistence, so a malformed
 * step (most commonly a seed missing the 8-char row uid) is rejected
 * with a descriptive error instead of persisting silently and only
 * surfacing later as phantom conflicts / hydration drops.
 *
 * Validation runs ahead of the hydration gate, so these pins exercise
 * the rejection contract on an unhydrated store — a payload that
 * PASSES validation falls through to the hydration error instead.
 */

import type { WorkflowStep } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import { __resetForTests, createLiveWorkflow, updateLiveWorkflow } from '../../src/live/live-workflow-store';

function makeStep(over: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    uid: 'aaaa1111',
    id: 'login',
    requestUid: 'bbbb2222',
    captures: [],
    ...over,
  };
}

afterEach(() => {
  __resetForTests();
});

describe('createLiveWorkflow boundary validation', () => {
  it('rejects a uid-less step with a path-bearing error', async () => {
    const step = makeStep();
    const { uid: _uid, ...uidless } = step;
    await expect(createLiveWorkflow({ name: 'wf', steps: [uidless as WorkflowStep] })).rejects.toThrow(
      /createLiveWorkflow: invalid steps.*uid/,
    );
  });

  it('rejects an out-of-bounds retry policy', async () => {
    const step = makeStep({ retry: { maxAttempts: 99 } });
    await expect(createLiveWorkflow({ name: 'wf', steps: [step] })).rejects.toThrow(/invalid steps.*maxAttempts/);
  });

  it('passes valid steps through to the hydration gate', async () => {
    await expect(createLiveWorkflow({ name: 'wf', steps: [makeStep()] })).rejects.toThrow(/mutation before hydration/);
  });
});

describe('updateLiveWorkflow boundary validation', () => {
  it('returns a typed failure for a uid-less step instead of throwing', async () => {
    const { uid: _uid, ...uidless } = makeStep();
    const result = await updateLiveWorkflow('cccc3333', { steps: [uidless as WorkflowStep] });
    expect(result).toMatchObject({ ok: false, reason: 'other' });
    if (!result.ok && result.reason === 'other') {
      expect(result.message).toMatch(/updateLiveWorkflow: invalid steps.*uid/);
    }
  });
});
