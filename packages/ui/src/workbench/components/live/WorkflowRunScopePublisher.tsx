/**
 * Publishes the page's scopes for a workflow run that lives in this page
 * (`workflow-run-scope.ts`) — mounted by the workbench shell on a host
 * whose page runs one, so a run does not depend on any editor being open.
 */

import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useScriptPackages } from '@openheaders/ui/shared/hooks/readers/useScriptPackages';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import type React from 'react';
import { useEffect } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { makeWorkflowRunScope, publishWorkflowRunScope } from './workflow-run-scope';

export const WorkflowRunScopePublisher: React.FC = () => {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const resolver = useVariableResolverInputs();
  const { collections, collectionTrees, folders, mqttRequests } = useRequests();
  const { workflows } = useLiveWorkflows();
  const packages = useScriptPackages(workspaceId);

  useEffect(() => {
    if (workspaceId === null) return;
    publishWorkflowRunScope(
      makeWorkflowRunScope({
        workspaceId,
        resolver,
        ancestry: { collectionTrees, collections, folders },
        workflows,
        mqttRequests,
        packages: packages.map((each) => ({ name: each.name, source: each.source })),
      }),
    );
    return () => publishWorkflowRunScope(null);
  }, [workspaceId, resolver, collectionTrees, collections, folders, workflows, mqttRequests, packages]);

  return null;
};
