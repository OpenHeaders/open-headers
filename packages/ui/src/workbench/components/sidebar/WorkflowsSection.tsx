/**
 * WorkflowsSection — the `workflows` view's single WORKFLOWS section.
 * Header `+` force-expands the section then opens a new workflow draft;
 * the body lists the workflow nodes (or the empty-state Create link).
 * Owns only its own `theme.useToken()` read; the node list, the create
 * callback, and the expansion state/setter arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface WorkflowsSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onCreateWorkflow?: () => void;
  workflowNodes: TreeNode[];
  renderNodes: SidebarNodeRenderers['renderNodes'];
}

const WorkflowsSection: React.FC<WorkflowsSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  setSectionsExpanded,
  onCreateWorkflow,
  workflowNodes,
  renderNodes,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t('workbench.sidebar.section.workflows')}
        expanded={sectionsExpanded.workflows}
        onToggle={() => toggleSection('workflows')}
        actions={
          <Tooltip title={t('workbench.sidebar.header.newWorkflow')} placement="bottom">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSectionsExpanded((prev) => ({ ...prev, workflows: true }));
                onCreateWorkflow?.();
              }}
            />
          </Tooltip>
        }
      />
      {sectionsExpanded.workflows && (
        <div style={{ overflowY: 'auto', overscrollBehavior: 'none' }}>{renderNodes(workflowNodes, () => onCreateWorkflow?.())}</div>
      )}
    </>
  );
};

export default WorkflowsSection;
