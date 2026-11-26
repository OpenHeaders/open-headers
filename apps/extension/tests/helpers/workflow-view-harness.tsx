/**
 * A saved workflow in its one view, as the editor mounts it: the draft
 * primed from the workflow, the selection held beside it, and the run
 * this page last saw.
 */

import { draftFromWorkflow } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useShownWorkflowRun } from '@openheaders/ui/workbench/components/live/use-workflow-run';
import WorkflowView from '@openheaders/ui/workbench/components/live/WorkflowView';
import type React from 'react';
import { useState } from 'react';

export const SavedWorkflowView: React.FC<{ workflow: LiveWorkflow; needsUpdate?: boolean }> = ({
  workflow,
  needsUpdate = false,
}) => {
  const [draft, setDraft] = useState(() => draftFromWorkflow(workflow, []));
  const [selectedStepUid, setSelectedStepUid] = useState<string | null>(null);
  const run = useShownWorkflowRun(workflow, needsUpdate);
  return (
    <WorkflowView
      draft={draft}
      setDraft={setDraft}
      readOnly={needsUpdate}
      selectedStepUid={selectedStepUid}
      onSelectStep={setSelectedStepUid}
      workflow={workflow}
      run={run}
      cacheRun={null}
    />
  );
};
