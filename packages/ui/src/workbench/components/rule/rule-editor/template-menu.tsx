import { FolderOutlined } from '@ant-design/icons';
import type { TreeNode } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { MenuProps } from 'antd';
import type { SystemTemplateNode } from '../../../rule-templates';
import { renderTwoToneIcon } from '../../shared/TwoToneIconPicker';

/**
 * Hierarchical dropdown items for the rule editor's template pickers:
 * Collection/Root → Folder → Template leaf. System templates come from
 * `SYSTEM_TEMPLATE_TREE_BY_TYPE`; user templates from the collection trees
 * filtered by the current rule type. Each leaf's `onClick` applies the
 * template via the supplied `applyTemplate`.
 */
export function buildSystemMenuItems(
  nodes: SystemTemplateNode[],
  applyTemplate: (key: string) => void,
  t: Translate,
): NonNullable<MenuProps['items']> {
  return nodes.map((node) => {
    if (node.kind === 'folder') {
      return {
        key: `sys-folder:${node.key}`,
        label: t(node.nameKey),
        icon: <FolderOutlined />,
        children: buildSystemMenuItems(node.children, applyTemplate, t),
      };
    }
    const tpl = node.template;
    return {
      key: `sys:${tpl.key}`,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span>{tpl.icon}</span>
          <span>{t(tpl.nameKey)}</span>
        </span>
      ),
      onClick: () => applyTemplate(tpl.key),
    };
  });
}

export function buildUserMenuItems(
  nodes: TreeNode[],
  ruleType: string,
  applyTemplate: (key: string) => void,
): NonNullable<MenuProps['items']> {
  const items: NonNullable<MenuProps['items']> = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      const childItems = buildUserMenuItems(node.children, ruleType, applyTemplate);
      if (childItems.length > 0) {
        items.push({
          key: `usr-folder:${node.uid}`,
          label: node.name,
          icon: <FolderOutlined />,
          children: childItems,
        });
      }
    } else if (node.type === 'template' && node.ruleType === ruleType) {
      items.push({
        key: `usr:${node.uid}`,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {renderTwoToneIcon(node.icon, { fontSize: 14 })}
            <span>{node.name}</span>
          </span>
        ),
        onClick: () => applyTemplate(node.uid),
      });
    }
  }
  return items;
}
