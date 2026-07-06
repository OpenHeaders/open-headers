/**
 * EnvironmentsSection — the shared ENVIRONMENTS footer rendered below the
 * per-view sections in every sidebar view. Header `+` creates a new
 * environment; the body lists the environment nodes (or the empty-state
 * Create link). Owns only its own `theme.useToken()` read; the node list,
 * the create action, and the expansion state arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface EnvironmentsSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  createNewEnvironment: () => Promise<void>;
  environmentNodes: TreeNode[];
  renderNodes: SidebarNodeRenderers['renderNodes'];
}

const EnvironmentsSection: React.FC<EnvironmentsSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  createNewEnvironment,
  environmentNodes,
  renderNodes,
}) => {
  const { token } = theme.useToken();
  return (
    <>
      <SectionHeader
        title="ENVIRONMENTS"
        expanded={sectionsExpanded.environments}
        onToggle={() => toggleSection('environments')}
        actions={
          <Tooltip title="Create new environment" placement="bottom">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                void createNewEnvironment();
              }}
            />
          </Tooltip>
        }
      />
      {sectionsExpanded.environments && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderNodes(environmentNodes, () => void createNewEnvironment())}
        </div>
      )}
    </>
  );
};

export default EnvironmentsSection;
