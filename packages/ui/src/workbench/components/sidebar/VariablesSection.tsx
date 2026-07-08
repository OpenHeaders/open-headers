/**
 * VariablesSection — the `variables` view's VAULT / WORKSPACE VARIABLES /
 * LIVE VARIABLES rows. Each singleton is a single header-styled opener:
 * scope badge + section-title typography, and clicking opens the editor
 * tab directly (the old caret header wrapping one nested leaf was
 * redundant). ENVIRONMENTS keeps the collapsible section shape — it
 * lists many entries. With an active filter, a row hides when its label
 * doesn't match the query.
 */

import { theme } from 'antd';
import type React from 'react';
import type { TreeNode } from './types';

interface VariablesSectionProps {
  filterText: string;
  vaultNode: TreeNode;
  workspaceVarsNode: TreeNode;
  liveVarsNode: TreeNode;
  isSelected: (id: string) => boolean;
}

function OpenerRow({ title, node, selected }: { title: string; node: TreeNode; selected: boolean }) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      data-item-id={node.id}
      style={{
        color: token.colorTextSecondary,
        backgroundColor: selected ? 'rgba(24, 144, 255, 0.08)' : undefined,
      }}
      onClick={() => node.onOpen?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') node.onOpen?.();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {node.icon}
        {title}
      </span>
    </div>
  );
}

const VariablesSection: React.FC<VariablesSectionProps> = ({
  filterText,
  vaultNode,
  workspaceVarsNode,
  liveVarsNode,
  isSelected,
}) => {
  const lower = filterText.toLowerCase();
  const matches = (label: string) => !lower || label.toLowerCase().includes(lower);
  return (
    <>
      {matches('vault') && <OpenerRow title="VAULT" node={vaultNode} selected={isSelected(vaultNode.id)} />}
      {matches('workspace variables') && (
        <OpenerRow title="WORKSPACE VARIABLES" node={workspaceVarsNode} selected={isSelected(workspaceVarsNode.id)} />
      )}
      {matches('live variables') && (
        <OpenerRow title="LIVE VARIABLES" node={liveVarsNode} selected={isSelected(liveVarsNode.id)} />
      )}
    </>
  );
};

export default VariablesSection;
