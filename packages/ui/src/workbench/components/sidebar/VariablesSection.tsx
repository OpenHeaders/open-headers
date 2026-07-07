/**
 * VariablesSection — the `variables` view's VAULT / WORKSPACE VARIABLES /
 * LIVE VARIABLES sections, each a single opener row. Owns the filter-match
 * visibility rule: with an active filter, a section hides when neither its
 * title nor its row label matches the query, and force-expands when it
 * does so a filter never hides a match behind a collapsed chevron. The
 * three singleton nodes, the filter text, and the expansion state arrive
 * as props.
 */

import type React from 'react';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface VariablesSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  filterText: string;
  vaultNode: TreeNode;
  workspaceVarsNode: TreeNode;
  liveVarsNode: TreeNode;
  renderNodes: SidebarNodeRenderers['renderNodes'];
}

const VariablesSection: React.FC<VariablesSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  filterText,
  vaultNode,
  workspaceVarsNode,
  liveVarsNode,
  renderNodes,
}) => {
  const lower = filterText.toLowerCase();
  const matches = (label: string) => !lower || label.toLowerCase().includes(lower);
  const showVault = matches('vault') || matches('Vault');
  const showWorkspace = matches('workspace variables');
  const showLive = matches('live variables');
  const vaultOpen = sectionsExpanded.vault || (lower !== '' && showVault);
  const wsOpen = sectionsExpanded['workspace-vars'] || (lower !== '' && showWorkspace);
  const liveOpen = sectionsExpanded['live-variables'] || (lower !== '' && showLive);
  return (
    <>
      {showVault && (
        <>
          <SectionHeader title="VAULT" expanded={vaultOpen} onToggle={() => toggleSection('vault')} />
          {vaultOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([vaultNode])}</div>}
        </>
      )}

      {showWorkspace && (
        <>
          <SectionHeader
            title="WORKSPACE VARIABLES"
            expanded={wsOpen}
            onToggle={() => toggleSection('workspace-vars')}
          />
          {wsOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([workspaceVarsNode])}</div>}
        </>
      )}

      {showLive && (
        <>
          <SectionHeader title="LIVE VARIABLES" expanded={liveOpen} onToggle={() => toggleSection('live-variables')} />
          {liveOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([liveVarsNode])}</div>}
        </>
      )}
    </>
  );
};

export default VariablesSection;
