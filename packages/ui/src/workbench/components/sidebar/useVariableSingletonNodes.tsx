import { useMemo } from 'react';
import { scopeBadge } from '../shared/scope-colors';
import type { TreeNode } from './types';

interface UseVariableSingletonNodesParams {
  onOpenVault?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
}

/**
 * Vault / Workspace Variables / Live Variables — single-row openers
 * for the full editors. Clicking opens the corresponding editor tab.
 */
export function useVariableSingletonNodes(p: UseVariableSingletonNodesParams) {
  const vaultNode = useMemo(
    (): TreeNode => ({
      id: 'vault-row',
      kind: 'leaf',
      label: 'Vault',
      depth: 0,
      expandable: false,
      icon: scopeBadge('vault'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenVault?.(),
    }),
    [p.onOpenVault],
  );

  const workspaceVarsNode = useMemo(
    (): TreeNode => ({
      id: 'workspace-vars-row',
      kind: 'leaf',
      label: 'Workspace Variables',
      depth: 0,
      expandable: false,
      icon: scopeBadge('workspace'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenWorkspaceVariables?.(),
    }),
    [p.onOpenWorkspaceVariables],
  );

  const liveVarsNode = useMemo(
    (): TreeNode => ({
      id: 'live-vars-row',
      kind: 'leaf',
      label: 'Live Variables',
      depth: 0,
      expandable: false,
      icon: scopeBadge('live'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenLiveVariables?.(),
    }),
    [p.onOpenLiveVariables],
  );

  return { vaultNode, workspaceVarsNode, liveVarsNode };
}
