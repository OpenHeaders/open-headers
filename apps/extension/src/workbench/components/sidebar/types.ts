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
  /**
   * Awareness identity for the entity this node represents — drives the
   * per-field presence chip beside the inline-rename input (and any
   * future per-row awareness affordances). Tree builders for entity
   * leaves (rules, requests, templates, workflows, live variables, envs)
   * populate this; container nodes (collections, folders, groups) leave
   * it absent.
   *
   * `entityType` strings come from `@openheaders/core/sync` (e.g.
   * `RULE_ENTITY_TYPE`, `REQUEST_ENTITY_TYPE`, …). Adding a new entity
   * type means populating this in the relevant `useXTreeNodes` hook —
   * no infrastructure changes here or in `TreeNodeRow`.
   */
  awareness?: {
    entityType: string;
    entityId: string;
  };

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
  /**
   * Open the workspace-export modal for this leaf. Wired only for rule
   * leaves in PR 1B; PR 5 extends to every exportable entity type.
   */
  onExport?: () => void;
  /**
   * Identity of this node as an exportable entity. Present iff the node
   * carries `onExport`; consumed by the sidebar's multi-select aggregator
   * so cmd/ctrl+click and shift+click can build a single combined export
   * across heterogeneous picks (rules, requests, collections, …).
   */
  exportEntity?: import('../../App').SidebarExportEntity;
  /** Items shown on `+` — create affordances only (Add Rule / Add
   *  Request / Add Folder). */
  addMenuItems?: ItemType[];
  /** Items shown on `⋯` — modify affordances only (Rename, Delete,
   *  Pause toggles, etc.). Never creates. */
  actionMenuItems?: ItemType[];
  hoverActions?: Array<{ icon: React.ReactNode; tooltip: string; onClick: () => void; alwaysVisible?: boolean }>;

  // Placeholder empty state
  placeholderTitle?: string;
  placeholderMessage?: string;
  placeholderActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
}
