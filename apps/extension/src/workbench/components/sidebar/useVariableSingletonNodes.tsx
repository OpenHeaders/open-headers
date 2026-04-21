import { FolderOpenOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { iconEl } from './icons';
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
      icon: iconEl(LockOutlined, 'var(--ant-color-error, #ff4d4f)'),
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
      icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
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
      icon: iconEl(ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenLiveVariables?.(),
    }),
    [p.onOpenLiveVariables],
  );

  return { vaultNode, workspaceVarsNode, liveVarsNode };
}
