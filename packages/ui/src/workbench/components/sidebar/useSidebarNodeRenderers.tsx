/**
 * useSidebarNodeRenderers — the four shared row/section renderers every
 * sidebar view assembles from: a single tree-row renderer, a section
 * empty-state, and the plain + folder-dnd node-list wrappers.
 *
 * They're closures over interaction state the parent owns — the
 * selection / focus / export-select predicates, the mouse handlers, the
 * rename cursor, and the expanded-key set — all passed in so the
 * renderers stay pure view-assembly. `theme.useToken()` is read
 * internally: the empty-state is the only consumer of the token here, so
 * it owns that read rather than threading it (matching
 * `SidebarHeaderActions`). Returned as plain functions (recreated each
 * render, like the inline helpers they replace) for the view JSX to call;
 * this is a mild render-prop-via-hook shape, acceptable because each
 * renderer is just a bound component render.
 */

import { PlusOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { FolderDndTree, type FolderDndConfig } from './FolderDndTree';
import { TreeNodeRow } from './TreeNodeRow';
import type { TreeNode } from './types';

interface UseSidebarNodeRenderersParams {
  isSelected: (id: string) => boolean;
  isFocused: (id: string) => boolean;
  isExportSelected: (id: string) => boolean;
  handleItemClick: (node: TreeNode, e: React.MouseEvent) => void;
  handleItemDoubleClick: (node: TreeNode) => void;
  renamingId: string | null;
  setRenamingId: React.Dispatch<React.SetStateAction<string | null>>;
  expandedKeys: Set<string>;
}

export interface SidebarNodeRenderers {
  renderTreeNodeRow: (node: TreeNode) => React.ReactElement;
  renderEmptyState: (emptyCreate?: () => void) => React.ReactElement;
  renderNodes: (nodes: TreeNode[], emptyCreate?: () => void) => React.ReactNode;
  renderFolderDndNodes: (nodes: TreeNode[], config: FolderDndConfig, emptyCreate?: () => void) => React.ReactElement;
}

export function useSidebarNodeRenderers({
  isSelected,
  isFocused,
  isExportSelected,
  handleItemClick,
  handleItemDoubleClick,
  renamingId,
  setRenamingId,
  expandedKeys,
}: UseSidebarNodeRenderersParams): SidebarNodeRenderers {
  const { token } = theme.useToken();

  const renderTreeNodeRow = (node: TreeNode) => (
    <TreeNodeRow
      key={node.id}
      node={node}
      isSelected={isSelected(node.id)}
      isFocused={isFocused(node.id)}
      isRenaming={renamingId === node.id}
      isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
      isExportSelected={isExportSelected(node.id)}
      onClick={(e) => handleItemClick(node, e)}
      onDoubleClick={() => handleItemDoubleClick(node)}
      onStartRename={() => {
        if (renamingId === node.id) setRenamingId(null);
        else setRenamingId(node.id);
      }}
    />
  );

  const renderEmptyState = (emptyCreate?: () => void) => (
    <div className="rules-sidebar-empty-state">
      <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this section</span>
      {emptyCreate && (
        <button
          type="button"
          className="rules-sidebar-create-btn"
          style={{ color: token.colorText }}
          onClick={emptyCreate}
        >
          <PlusOutlined style={{ fontSize: 10 }} /> Create
        </button>
      )}
    </div>
  );

  const renderNodes = (nodes: TreeNode[], emptyCreate?: () => void) => {
    if (nodes.length === 0) return renderEmptyState(emptyCreate);
    return nodes.map(renderTreeNodeRow);
  };

  /** Variant of `renderNodes` that wraps folder rows in dnd-kit so
   *  same-parent reorder gestures emit `moveFolder` mutations. The
   *  per-tree config supplies the id prefixes + mutator binding. */
  const renderFolderDndNodes = (nodes: TreeNode[], config: FolderDndConfig, emptyCreate?: () => void) => {
    if (nodes.length === 0) return renderEmptyState(emptyCreate);
    return <FolderDndTree nodes={nodes} renderNode={renderTreeNodeRow} config={config} />;
  };

  return { renderTreeNodeRow, renderEmptyState, renderNodes, renderFolderDndNodes };
}
