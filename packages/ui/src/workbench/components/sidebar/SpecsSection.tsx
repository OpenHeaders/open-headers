/**
 * SpecsSection — the `api-requests` view's SPECS group, listing the
 * workspace's API specification documents. Header `+` creates a new
 * spec from the blank OpenAPI 3.1 scaffold; the body lists the spec
 * nodes. Owns only its own `theme.useToken()` read; the node list, the
 * create action, and the expansion state arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface SpecsSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  createNewSpec: () => Promise<void>;
  specNodes: TreeNode[];
  renderNodes: SidebarNodeRenderers['renderNodes'];
}

const SpecsSection: React.FC<SpecsSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  createNewSpec,
  specNodes,
  renderNodes,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t('workbench.sidebar.section.specs')}
        expanded={sectionsExpanded.specs}
        onToggle={() => toggleSection('specs')}
        actions={
          <Tooltip title={t('workbench.sidebar.header.createNewSpec')} placement="bottom">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                void createNewSpec();
              }}
            />
          </Tooltip>
        }
      />
      {sectionsExpanded.specs && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
          {renderNodes(specNodes, () => void createNewSpec())}
        </div>
      )}
    </>
  );
};

export default SpecsSection;
