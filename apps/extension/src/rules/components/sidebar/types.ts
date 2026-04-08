/**
 * Sidebar tree types — unified model for all sidebar items.
 *
 * Mirrors desktop v5-shell/sidebar/types.ts exactly.
 * Every sidebar item is a TreeNode. The rendering layer (TreeNodeRow)
 * treats all nodes identically.
 */

import type { ItemType } from 'antd/es/menu/interface';

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
  hoverAction?: { icon: React.ReactNode; tooltip: string; onClick: () => void };

  // Placeholder empty state
  placeholderTitle?: string;
  placeholderMessage?: string;
  placeholderActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
}
