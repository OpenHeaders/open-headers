/**
 * useRequestWorkflowStepContext — derive a {@link SuggestionContext.workflowStep}
 * value for a request that's used as a step in a Live Workflow.
 *
 * A Request is a pure, workflow-agnostic entity; it can be sent on
 * its own AND referenced by any number of `WorkflowStep.requestUid`s.
 * When a user edits a request that IS a workflow step, `{{step.X.Y}}`
 * suggestions should surface captures from steps earlier than this one
 * in the owning workflow — matches the step-forward-reference
 * discipline enforced by `validateStepReferences`.
 *
 * Architectural rule: we only propagate step context when the request
 * is referenced by EXACTLY ONE (workflow, step) pair. When the same
 * request is wired into multiple workflows (or the same workflow
 * multiple times), we stay silent — step ids are workflow-local, so
 * offering captures from one workflow's step list would produce dead
 * refs when the request runs in the other workflow's context. Better
 * no suggestions than wrong suggestions.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useMemo } from 'react';

export function useRequestWorkflowStepContext(
  requestUid: string | undefined,
): SuggestionContext['workflowStep'] | undefined {
  const { workflows } = useLiveWorkflows();

  return useMemo(() => {
    if (!requestUid) return undefined;

    const hits: Array<{ workflowUid: string; stepIndex: number; steps: (typeof workflows)[number]['steps'] }> = [];
    for (const wf of workflows) {
      for (let i = 0; i < wf.steps.length; i++) {
        if (wf.steps[i].requestUid === requestUid) {
          hits.push({ workflowUid: wf.uid, stepIndex: i, steps: wf.steps });
        }
      }
    }

    // Zero hits → not a workflow step. Multiple hits → ambiguous
    // (same request wired into multiple workflows OR used twice in
    // one workflow); offering either side would leak workflow-local
    // step ids into a context they don't resolve in.
    if (hits.length !== 1) return undefined;

    const hit = hits[0];
    return {
      workflowUid: hit.workflowUid,
      currentStepIndex: hit.stepIndex,
      steps: hit.steps.map((s) => ({
        id: s.id,
        captures: s.captures.map((c) => ({ name: c.name })),
      })),
    };
  }, [workflows, requestUid]);
}
