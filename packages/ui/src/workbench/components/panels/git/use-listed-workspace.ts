/**
 * useListedWorkspace — the workspace as its panels list it, read from
 * the same data the panels draw: what `workspace-file-tree` matches a
 * file's path against.
 *
 * Mounted only by what draws a named file tree, while it is shown.
 */

import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import type { ListedWorkspace } from '@openheaders/ui/shared/workspace-files';
import { useMemo } from 'react';

export function useListedWorkspace(): ListedWorkspace {
  const { localCollectionTrees, templateCollectionTrees, activeWorkspaceId } = useRules();
  const { collectionTrees } = useRequests();
  const specs = useSpecs(activeWorkspaceId);
  const { workflows } = useLiveWorkflows();
  const { variables } = useLiveVariables();
  const { environments } = useEnvironments();

  return useMemo(
    () => ({
      ruleCollections: localCollectionTrees,
      templateCollections: templateCollectionTrees,
      requestCollections: collectionTrees,
      specs,
      workflows,
      liveVariables: variables,
      environments,
    }),
    [localCollectionTrees, templateCollectionTrees, collectionTrees, specs, workflows, variables, environments],
  );
}
