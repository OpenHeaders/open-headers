/**
 * RulesSection — the `http-rules` view's RULES + TEMPLATES sections.
 * RULES header `+` opens the create-rule menu; its body renders the rule
 * collection tree with folder-reorder dnd. TEMPLATES header `+` creates a
 * user-template collection; its body renders the system templates and the
 * user-template dnd tree side-by-side under one header, collapsing to a
 * single empty-state when both lists are empty. Owns only its own
 * `theme.useToken()` read; nodes, dnd configs, menus, and create actions
 * arrive as props.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown, Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { FolderDndConfig } from './FolderDndTree';
import { SectionHeader } from './SectionHeader';
import type { TreeNode } from './types';
import type { SidebarNodeRenderers } from './useSidebarNodeRenderers';

interface RulesSectionProps {
  sectionsExpanded: Record<string, boolean>;
  toggleSection: (key: string) => void;
  createMenuItems: MenuProps['items'];
  rulesNodes: TreeNode[];
  rulesFolderDndConfig: FolderDndConfig;
  createNewCollection: () => Promise<void>;
  systemTemplateNodes: TreeNode[];
  templateNodes: TreeNode[];
  templateFolderDndConfig: FolderDndConfig;
  createNewTemplateCollection: () => Promise<void>;
  renderTreeNodeRow: SidebarNodeRenderers['renderTreeNodeRow'];
  renderEmptyState: SidebarNodeRenderers['renderEmptyState'];
  renderFolderDndNodes: SidebarNodeRenderers['renderFolderDndNodes'];
}

const RulesSection: React.FC<RulesSectionProps> = ({
  sectionsExpanded,
  toggleSection,
  createMenuItems,
  rulesNodes,
  rulesFolderDndConfig,
  createNewCollection,
  systemTemplateNodes,
  templateNodes,
  templateFolderDndConfig,
  createNewTemplateCollection,
  renderTreeNodeRow,
  renderEmptyState,
  renderFolderDndNodes,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t('workbench.sidebar.section.rules')}
        expanded={sectionsExpanded.rules}
        onToggle={() => toggleSection('rules')}
        actions={
          <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        }
      />
      {sectionsExpanded.rules && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
          {renderFolderDndNodes(rulesNodes, rulesFolderDndConfig, () => void createNewCollection())}
        </div>
      )}

      <SectionHeader
        title={t('workbench.sidebar.section.templates')}
        expanded={sectionsExpanded.templates}
        onToggle={() => toggleSection('templates')}
        actions={
          <Tooltip title={t('workbench.sidebar.header.newTemplateCollection')} placement="bottom">
            <PlusOutlined
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                void createNewTemplateCollection();
              }}
            />
          </Tooltip>
        }
      />
      {sectionsExpanded.templates && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(() => {
            // System and user templates render side-by-side under the
            // single TEMPLATES section header. When both lists are
            // empty (filter excludes everything, or fresh workspace
            // before any user collection is created), render ONE
            // section-level empty-state instead of one per list —
            // otherwise the section flashes "No items in this section"
            // twice in a row, which reads like a layout bug.
            const createUserCollection = () => void createNewTemplateCollection();
            if (systemTemplateNodes.length === 0 && templateNodes.length === 0) {
              return renderEmptyState(createUserCollection);
            }
            return (
              <>
                {systemTemplateNodes.length > 0 && systemTemplateNodes.map(renderTreeNodeRow)}
                {templateNodes.length > 0 &&
                  renderFolderDndNodes(templateNodes, templateFolderDndConfig, createUserCollection)}
              </>
            );
          })()}
        </div>
      )}
    </>
  );
};

export default RulesSection;
