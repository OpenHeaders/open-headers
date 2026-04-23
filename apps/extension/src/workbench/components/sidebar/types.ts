/**
 * Sidebar tree types — unified model for all sidebar items.
 *
 * Mirrors desktop v5-shell/sidebar/types.ts exactly.
 * Every sidebar item is a TreeNode. The rendering layer (TreeNodeRow)
 * treats all nodes identically.
 */

import type { ItemType } from 'antd/es/menu/interface';

/**
 * Which management surface the Sidebar renders. Each view shows a
 * different subset of sections but shares the chrome (filter, toolbar,
 * keyboard nav, options menu).
 */
export type SidebarView = 'http-rules' | 'api-requests' | 'variables' | 'workflows';

export type NodeKind = 'group' | 'folder' | 'leaf' | 'placeholder';

export interface TreeNode {
  id: string;
  kind: NodeKind;
  label: string;
  depth: number;
  expandable: boolean;
  parentId?: string;

  // Rendering
  icon: React.ReactNode;
  badge?: React.ReactNode;

  // Capabilities
  canRename: boolean;
  canDelete: boolean;
  canAddChild: boolean;

  // Callbacks
  onOpen?: () => void;
  onRename?: (newName: string) => Promise<void> | void;
  onDelete?: () => void;
  onAddItem?: () => void;
  addMenuItems?: ItemType[];
  hoverActions?: Array<{ icon: React.ReactNode; tooltip: string; onClick: () => void; alwaysVisible?: boolean }>;

  // Placeholder empty state
  placeholderTitle?: string;
  placeholderMessage?: string;
  placeholderActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
}
