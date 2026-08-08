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
import { useT } from '@openheaders/ui/context/LocaleContext';
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
  /** Reveal-aware expansion predicate (see Sidebar) — the caret must
   *  agree with what the tree hooks actually render, including during
   *  a live filter/search reveal. */
  isExpandedKey: (id: string) => boolean;
  /** Speed-search (search mode): the live query rows highlight, and
   *  the active match's row id. Empty/null outside search. */
  searchHighlightQuery: string;
  activeSearchMatchId: string | null;
  /** True while a FILTER-mode query is live — empty-state create
   *  scaffolds are suppressed (a zero-match section must read as "no
   *  matches", not invite creation). */
  filterActive: boolean;
}

export interface SidebarNodeRenderers {
  renderTreeNodeRow: (node: TreeNode) => React.ReactElement;
  renderEmptyState: (emptyCreate?: () => void) => React.ReactNode;
  renderNodes: (nodes: TreeNode[], emptyCreate?: () => void) => React.ReactNode;
  renderFolderDndNodes: (nodes: TreeNode[], config: FolderDndConfig, emptyCreate?: () => void) => React.ReactNode;
}

export function useSidebarNodeRenderers({
  isSelected,
  isFocused,
  isExportSelected,
  handleItemClick,
  handleItemDoubleClick,
  renamingId,
  setRenamingId,
  isExpandedKey,
  searchHighlightQuery,
  activeSearchMatchId,
  filterActive,
}: UseSidebarNodeRenderersParams): SidebarNodeRenderers {
  const { token } = theme.useToken();
  const t = useT();

  const renderTreeNodeRow = (node: TreeNode) => (
    <TreeNodeRow
      key={node.id}
      node={node}
      isSelected={isSelected(node.id)}
      isFocused={isFocused(node.id)}
      isRenaming={renamingId === node.id}
      isExpanded={node.expandable ? isExpandedKey(node.id) : undefined}
      isExportSelected={isExportSelected(node.id)}
      highlightQuery={searchHighlightQuery}
      isSearchActive={activeSearchMatchId === node.id}
      onClick={(e) => handleItemClick(node, e)}
      onDoubleClick={() => handleItemDoubleClick(node)}
      onStartRename={() => {
        if (renamingId === node.id) setRenamingId(null);
        else setRenamingId(node.id);
      }}
    />
  );

  const renderEmptyState = (emptyCreate?: () => void) =>
    filterActive ? null : (
      <div className="rules-sidebar-empty-state">
        <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>
          {t('workbench.sidebar.emptySection')}
        </span>
        {emptyCreate && (
          <button
            type="button"
            className="rules-sidebar-create-btn"
            style={{ color: token.colorText }}
            onClick={emptyCreate}
          >
            <PlusOutlined style={{ fontSize: 10 }} /> {t('workbench.sidebar.emptySectionCreate')}
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
