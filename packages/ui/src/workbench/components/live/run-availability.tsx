/**
 * Whether this surface can run a workflow on a press, and the (i) that
 * says where one runs when it cannot (the workflow runs plan, Decisions
 * log, S5). Every Refresh of a workflow reads the one answer.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { isChainWorkflow, workflowNeedsUpdate } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type React from 'react';

export function workflowRunsHere(): boolean {
  return !hasCapability('workflowRunUnavailable');
}

/**
 * Whether a press runs THIS workflow here (the workflow runs plan,
 * Decisions log, S10). A workflow that holds a step this surface does not
 * know is not run — unless its host says it runs session steps and every
 * step is of an action the model knows.
 */
export function canRunWorkflowHere(workflow: LiveWorkflow): boolean {
  if (!workflowRunsHere()) return false;
  if (!workflowNeedsUpdate(workflow)) return true;
  return hasCapability('workflowSessionSteps') && isChainWorkflow(workflow);
}

export const RunUnavailableInfo: React.FC = () => {
  const t = useT();
  return (
    <InfoTrigger
      content={{
        title: t('workbench.editors.live.workflow.refresh'),
        summary: t('workbench.editors.live.workflow.runUnavailable'),
      }}
    />
  );
};
