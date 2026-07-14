/**
 * VariablesSection — the `variables` view's VAULT / WORKSPACE VARIABLES /
 * LIVE VARIABLES rows. Each singleton is a `SectionOpenerRow`: scope badge
 * + section-title typography, and clicking opens the editor tab directly
 * (the old caret header wrapping one nested leaf was redundant).
 * ENVIRONMENTS keeps the collapsible section shape — it lists many
 * entries. With an active filter, a row hides when its label doesn't
 * match the query.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SectionOpenerRow } from './SectionHeader';
import type { TreeNode } from './types';

interface VariablesSectionProps {
  filterText: string;
  vaultNode: TreeNode;
  workspaceVarsNode: TreeNode;
  liveVarsNode: TreeNode;
  isSelected: (id: string) => boolean;
}

const VariablesSection: React.FC<VariablesSectionProps> = ({
  filterText,
  vaultNode,
  workspaceVarsNode,
  liveVarsNode,
  isSelected,
}) => {
  const t = useT();
  const lower = filterText.toLowerCase();
  const matches = (label: string) => !lower || label.toLowerCase().includes(lower);
  const vaultTitle = t('workbench.sidebar.section.vault');
  const workspaceVarsTitle = t('workbench.sidebar.section.workspaceVariables');
  const liveVarsTitle = t('workbench.sidebar.section.liveVariables');
  return (
    <>
      {matches(vaultTitle) && <SectionOpenerRow title={vaultTitle} node={vaultNode} selected={isSelected(vaultNode.id)} />}
      {matches(workspaceVarsTitle) && (
        <SectionOpenerRow
          title={workspaceVarsTitle}
          node={workspaceVarsNode}
          selected={isSelected(workspaceVarsNode.id)}
        />
      )}
      {matches(liveVarsTitle) && (
        <SectionOpenerRow title={liveVarsTitle} node={liveVarsNode} selected={isSelected(liveVarsNode.id)} />
      )}
    </>
  );
};

export default VariablesSection;
