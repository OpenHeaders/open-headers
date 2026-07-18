/**
 * SpecsSection — the `api-requests` view's SPECS group, listing the
 * workspace's API specification documents. Header `+` opens a format
 * menu (OpenAPI 3.1 / Protobuf 3 / AsyncAPI 3.0) and creates a new spec from that
 * format's blank scaffold; the body lists the spec nodes. Owns only
 * its own `theme.useToken()` read; the node list, the create action,
 * and the expansion state arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import { Dropdown, Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SPEC_FORMAT_LABELS } from '../specs/spec-format-labels';
import type { SpecCreateFormat } from '../specs/spec-scaffold';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

const CREATE_FORMATS: readonly SpecCreateFormat[] = ['openapi-3.1', 'protobuf', 'asyncapi'];

interface SpecsSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  createNewSpec: (format?: SpecCreateFormat) => Promise<void>;
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
          <Dropdown
            trigger={['click']}
            menu={{
              items: CREATE_FORMATS.map((format) => ({
                key: format,
                label: SPEC_FORMAT_LABELS[format],
                onClick: () => void createNewSpec(format),
              })),
            }}
          >
            <Tooltip title={t('workbench.sidebar.header.createNewSpec')} placement="bottom">
              <PlusOutlined
                style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                data-testid="sidebar-create-spec"
              />
            </Tooltip>
          </Dropdown>
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
