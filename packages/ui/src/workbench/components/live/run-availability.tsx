/**
 * Whether this surface can run a workflow on a press, and the (i) that
 * says where one runs when it cannot (the workflow runs plan, Decisions
 * log, S5 and S16). Every Run of a workflow reads the one answer.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { isChainWorkflow, workflowHoldsSession } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type React from 'react';

export function workflowRunsHere(): boolean {
  return !hasCapability('workflowRunUnavailable');
}

/**
 * Whether a workflow's session steps keep it from running on this
 * surface: it holds one, and the surface's host runs none.
 */
export function sessionRunsElsewhere(workflow: LiveWorkflow): boolean {
  return workflowHoldsSession(workflow) && !hasCapability('workflowSessionSteps');
}

/**
 * Whether a press runs THIS workflow here (the workflow runs plan,
 * Decisions log, S10). A workflow with a step of an action the model
 * does not know is not run anywhere; one that holds a session step is
 * run where the host says it runs session steps.
 */
export function canRunWorkflowHere(workflow: LiveWorkflow): boolean {
  if (!workflowRunsHere()) return false;
  if (!isChainWorkflow(workflow)) return false;
  return !sessionRunsElsewhere(workflow);
}

/** The (i) beside a Run that is off because this surface runs no workflow. */
export const RunUnavailableInfo: React.FC = () => {
  const t = useT();
  return (
    <InfoTrigger
      content={{
        title: t('workbench.editors.live.workflow.run'),
        summary: t('workbench.editors.live.workflow.runUnavailable'),
      }}
    />
  );
};

/** The (i) beside a Run that is off because this surface opens no session. */
export const SessionRunElsewhereInfo: React.FC = () => {
  const t = useT();
  return (
    <InfoTrigger
      content={{
        title: t('workbench.editors.live.workflow.run'),
        summary: t('workbench.editors.live.workflow.sessionRunsElsewhere', {
          surface: t('shared.awareness.kind.workbench'),
        }),
      }}
    />
  );
};

/** The (i) beside a Run that is off because the workflow was never saved. */
export const SaveToRunInfo: React.FC = () => {
  const t = useT();
  return (
    <InfoTrigger
      content={{
        title: t('workbench.editors.live.workflow.run'),
        summary: t('workbench.editors.live.workflow.saveToRun'),
      }}
    />
  );
};
