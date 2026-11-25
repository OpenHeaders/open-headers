/**
 * Whether this surface can run a workflow on a press, and the (i) that
 * says where one runs when it cannot (the workflow runs plan, Decisions
 * log, S5). Every Refresh of a workflow reads the one answer.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type React from 'react';

export function workflowRunsHere(): boolean {
  return !hasCapability('workflowRunUnavailable');
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
