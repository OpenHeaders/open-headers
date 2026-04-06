/**
 * Sidebar tree types — unified model for all sidebar items.
 *
 * Every sidebar item (collection, folder, request, rule, environment)
 * is represented as a TreeNode. The rendering layer (TreeNodeRow) treats
 * all nodes identically — differentiation comes from the node's icon,
 * badge, and attached callbacks.
 */

import type { MenuItemType } from 'antd/es/menu/interface';

export type NodeKind = 'group' | 'folder' | 'leaf' | 'placeholder';

export interface TreeNode {
  /** Unique sidebar ID (e.g. 'source-123', 'folder-f-1', 'col-MyAPI') */
  id: string;
  kind: NodeKind;
  label: string;
  depth: number;
  expandable: boolean;

  /** Parent node ID (for ArrowLeft → jump to parent) */
  parentId?: string;

  // ── Rendering ──────────────────────────────────────
  icon: React.ReactNode;
  /** Right-aligned badge (method badge, "off", "active") */
  badge?: React.ReactNode;

  // ── Capabilities ───────────────────────────────────
  canRename: boolean;
  canDelete: boolean;
  /** Shows + and ... hover action buttons */
  canAddChild: boolean;

  // ── Callbacks ──────────────────────────────────────
  /** Open as tab (leaves) or toggle expand (groups/folders) */
  onOpen?: () => void;
  onRename?: (newName: string) => Promise<void> | void;
  onDelete?: () => void;
  /** + button default action */
  onAddItem?: () => void;
  /** ... dropdown menu items */
  addMenuItems?: MenuItemType[];

  // ── Empty state placeholder ────────────────────────
  /** Title shown when container is empty (e.g. "Collection is empty") */
  placeholderTitle?: string;
  /** Description text below the title */
  placeholderMessage?: string;
  /** Action buttons shown in the empty state */
  placeholderActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
}
