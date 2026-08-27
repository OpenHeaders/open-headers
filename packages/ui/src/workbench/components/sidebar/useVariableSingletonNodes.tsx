import { CodeSandboxOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { scopeBadge } from '../shared/scope-colors';
import type { TreeNode } from './types';

interface UseVariableSingletonNodesParams {
  onOpenVault?: () => void;
  onOpenTrustedRoots?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
  onOpenScriptPackages?: () => void;
}

/**
 * Vault / Trusted Certificates / Workspace Variables / Live Variables / Package Library —
 * single-row openers for the full editors. Clicking opens the
 * corresponding editor tab.
 */
export function useVariableSingletonNodes(p: UseVariableSingletonNodesParams) {
  const t = useT();
  const vaultNode = useMemo(
    (): TreeNode => ({
      id: 'vault-row',
      kind: 'leaf',
      label: t('workbench.sidebar.singleton.vault'),
      depth: 0,
      expandable: false,
      icon: scopeBadge('vault'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenVault?.(),
    }),
    [p.onOpenVault, t],
  );

  const trustedRootsNode = useMemo(
    (): TreeNode => ({
      id: 'trusted-roots-row',
      kind: 'leaf',
      label: t('workbench.sidebar.singleton.trustedRoots'),
      depth: 0,
      expandable: false,
      icon: <SafetyCertificateOutlined />,
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenTrustedRoots?.(),
    }),
    [p.onOpenTrustedRoots, t],
  );

  const workspaceVarsNode = useMemo(
    (): TreeNode => ({
      id: 'workspace-vars-row',
      kind: 'leaf',
      label: t('workbench.sidebar.singleton.workspaceVariables'),
      depth: 0,
      expandable: false,
      icon: scopeBadge('workspace'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenWorkspaceVariables?.(),
    }),
    [p.onOpenWorkspaceVariables, t],
  );

  const liveVarsNode = useMemo(
    (): TreeNode => ({
      id: 'live-vars-row',
      kind: 'leaf',
      label: t('workbench.sidebar.singleton.liveVariables'),
      depth: 0,
      expandable: false,
      icon: scopeBadge('live'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenLiveVariables?.(),
    }),
    [p.onOpenLiveVariables, t],
  );

  const scriptPackagesNode = useMemo(
    (): TreeNode => ({
      id: 'script-packages-row',
      kind: 'leaf',
      label: t('workbench.sidebar.singleton.packageLibrary'),
      depth: 0,
      expandable: false,
      icon: <CodeSandboxOutlined />,
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.onOpenScriptPackages?.(),
    }),
    [p.onOpenScriptPackages, t],
  );

  return { vaultNode, trustedRootsNode, workspaceVarsNode, liveVarsNode, scriptPackagesNode };
}
