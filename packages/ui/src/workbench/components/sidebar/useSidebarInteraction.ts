/**
 * useSidebarInteraction — the sidebar's selection + navigation subsystem.
 *
 * Owns the three pieces of interaction-local state that the mouse
 * handlers, the keyboard-nav handler, the multi-select-reset effect, and
 * the auto-select effect all read or write:
 *
 *   - `focusedId`            — keyboard-nav cursor (distinct from the
 *                              active-tab-driven `isSelected`).
 *   - `selectedIds`          — the multi-selection: the rows a drag
 *                              takes along and "Export selected…"
 *                              folds (those with an export identity).
 *   - `anchorRef`            — the row a Shift+click ranges from, with
 *                              the selection it was set on (never
 *                              leaked; consumers clear via
 *                              `clearSelection()`).
 *
 * Everything else it needs — the flat nav item list, the behavior flags,
 * the lifted expansion setters, the collection trees, and the export
 * callback — is passed in, so the hook stays about interaction rather
 * than derivation (`allFlatItems` is memoized next to the node hooks that
 * feed it and handed in here). It calls `useSelectOpenedTab` internally
 * and returns the row/header handlers the component's JSX assembles.
 */

import type { TreeNode as CoreTreeNode } from '@openheaders/core/types';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import { isSelectableRow, rangeSelection, type SelectionAnchor, toggleSelection } from './tree-selection';
import type { SidebarView, TreeNode } from './types';
import { useSelectOpenedTab } from './useSelectOpenedTab';

interface UseSidebarInteractionParams {
  /** Flat, view-scoped nav item list (memoized in the component next to
   *  the node hooks that feed it). */
  allFlatItems: TreeNode[];
  activeTabId?: string | null;
  view: SidebarView;
  filterText: string;
  alwaysSelectOpened: boolean;
  openWithSingleClick: boolean;
  openCollectionsWithSingleClick: boolean;
  openFoldersWithSingleClick: boolean;
  /** Reveal-aware expansion predicate (see Sidebar) — keyboard
   *  Left/Right must agree with what the tree actually renders,
   *  including during a live filter/search reveal. */
  isExpandedKey: (id: string) => boolean;
  localCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  templateCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  requestCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  /** Parent request uid for a response-example uid — see useSelectOpenedTab. */
  resolveResponseExampleParent?: (exampleUid: string) => string | null;
  /** Parent gRPC request uid for a gRPC response-example uid. */
  resolveGrpcResponseExampleParent?: (exampleUid: string) => string | null;
  /** Parent WebSocket request uid for a WebSocket response-example uid. */
  resolveWsResponseExampleParent?: (exampleUid: string) => string | null;
  /** Parent MQTT request uid for an MQTT response-example uid. */
  resolveMqttResponseExampleParent?: (exampleUid: string) => string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  toggleExpand: (key: string) => void;
  setRenamingId: React.Dispatch<React.SetStateAction<string | null>>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onExportSelection?: (entities: SidebarExportEntity[]) => void;
}

export interface SidebarInteraction {
  focusedId: string | null;
  setFocusedId: React.Dispatch<React.SetStateAction<string | null>>;
  /** The multi-selection, in no particular order; readers walk the flat rows for visible order. */
  selectedIds: Set<string>;
  /** How many of the selected rows carry an export identity. */
  exportableSelectedCount: number;
  isMultiSelected: (id: string) => boolean;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  isFocused: (id: string) => boolean;
  handleItemClick: (node: TreeNode, e: React.MouseEvent) => void;
  handleItemDoubleClick: (node: TreeNode) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleExportSelectedClick: () => void;
  selectOpenedFile: () => boolean;
}

export function useSidebarInteraction({
  allFlatItems,
  activeTabId,
  view,
  filterText,
  alwaysSelectOpened,
  openWithSingleClick,
  openCollectionsWithSingleClick,
  openFoldersWithSingleClick,
  isExpandedKey,
  localCollectionTrees,
  templateCollectionTrees,
  requestCollectionTrees,
  resolveResponseExampleParent,
  resolveGrpcResponseExampleParent,
  resolveWsResponseExampleParent,
  resolveMqttResponseExampleParent,
  containerRef,
  toggleExpand,
  setRenamingId,
  setExpandedKeys,
  setSectionsExpanded,
  onExportSelection,
}: UseSidebarInteractionParams): SidebarInteraction {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // The multi-selection. Distinct from `focusedId` / `isSelected` (which
  // track active-tab navigation): these are the rows the user picked
  // as a set — a drag takes them along, "Export selected…" folds the
  // exportable ones. The gestures are the tree-selection contract;
  // cleared on view change, filter change, and explicit Esc.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<SelectionAnchor | null>(null);

  const isMultiSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      if (!alwaysSelectOpened || !activeTabId) return false;
      if (activeTabId === id) return true;
      if (id.startsWith('rule-') && activeTabId === `edit-${id.replace('rule-', '')}`) return true;
      if (id.startsWith('tpl-') && activeTabId === `tpl-edit-${id.replace('tpl-', '')}`) return true;
      if (id.startsWith('workflow-') && activeTabId === `live-wf-${id.replace('workflow-', '')}`) return true;
      return (
        (id === 'vault-row' && activeTabId === 'vault') ||
        (id === 'workspace-vars-row' && activeTabId === 'workspace-vars') ||
        (id === 'live-vars-row' && activeTabId === 'live-vars') ||
        (id === 'script-packages-row' && activeTabId === 'script-packages')
      );
    },
    [activeTabId, alwaysSelectOpened],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  const shouldOpenOnSingleClick = useCallback(
    (node: TreeNode) => {
      if (node.kind === 'group') return openCollectionsWithSingleClick;
      if (node.kind === 'folder') return openFoldersWithSingleClick;
      return openWithSingleClick;
    },
    [openWithSingleClick, openCollectionsWithSingleClick, openFoldersWithSingleClick],
  );

  const handleItemClick = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      const modifierToggle = (e.metaKey || e.ctrlKey) && !e.shiftKey;
      const modifierRange = e.shiftKey;

      if ((modifierToggle || modifierRange) && isSelectableRow(node)) {
        // Multi-select gesture — suppress nav. Cmd/Ctrl toggles the row
        // and anchors on it; Shift ranges from the anchor (the last
        // plain or Cmd/Ctrl click, else the keyboard cursor, else this
        // row) on top of the selection the anchor was set with.
        e.preventDefault();
        if (modifierRange) {
          const anchor: SelectionAnchor =
            anchorRef.current ??
            (focusedId ? { id: focusedId, base: selectedIds } : { id: node.id, base: selectedIds });
          anchorRef.current = anchor;
          setSelectedIds(rangeSelection(allFlatItems, anchor, node.id));
        } else {
          const next = toggleSelection(selectedIds, node.id);
          anchorRef.current = { id: node.id, base: next };
          setSelectedIds(next);
        }
        setFocusedId(node.id);
        containerRef.current?.focus({ preventScroll: true });
        return;
      }

      // Plain click — collapse the selection, anchor here, then normal nav.
      if (selectedIds.size > 0) setSelectedIds(new Set());
      anchorRef.current = { id: node.id, base: new Set() };
      setFocusedId(node.id);
      // Pull keyboard focus onto the tree container so subsequent
      // ArrowUp/Down/Left/Right reach the React onKeyDown handler.
      // The container carries tabIndex={-1} so this is a real focus()
      // (a plain <div> is not focusable, and rows themselves are not
      // focusable either — focus would otherwise stay on document.body
      // and arrow keys would never reach handleKeyDown).
      containerRef.current?.focus({ preventScroll: true });
      if (shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick, allFlatItems, selectedIds, focusedId, containerRef],
  );

  const handleItemDoubleClick = useCallback(
    (node: TreeNode) => {
      if (!shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  const selectOpenedFile = useSelectOpenedTab({
    activeTabId,
    view,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    resolveResponseExampleParent,
    resolveGrpcResponseExampleParent,
    resolveWsResponseExampleParent,
    resolveMqttResponseExampleParent,
    containerRef,
    setExpandedKeys,
    setSectionsExpanded,
    setFocusedId,
  });

  // Auto-select on active-tab change, with retry when tree data arrives async
  const prevActiveTabRef = useRef(activeTabId);
  const pendingSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!alwaysSelectOpened || !activeTabId) return;

    const tabChanged = prevActiveTabRef.current !== activeTabId;
    prevActiveTabRef.current = activeTabId;

    if (tabChanged) {
      const found = selectOpenedFile();
      pendingSelectRef.current = found ? null : activeTabId;
    } else if (pendingSelectRef.current === activeTabId) {
      const found = selectOpenedFile();
      if (found) pendingSelectRef.current = null;
    }
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile]);

  // The selection is bound to the current view + filter context — a
  // pick made under "http-rules" with no filter would silently include
  // hidden nodes if the user switched view or typed a query, so clear it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on view/filter change
  useEffect(() => {
    if (selectedIds.size === 0) return;
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, [view, filterText]);

  const exportSelectionEntities = useMemo((): SidebarExportEntity[] => {
    const entities: SidebarExportEntity[] = [];
    for (const n of allFlatItems) {
      if (selectedIds.has(n.id) && n.exportEntity) entities.push(n.exportEntity);
    }
    return entities;
  }, [allFlatItems, selectedIds]);

  const handleExportSelectedClick = useCallback(() => {
    if (exportSelectionEntities.length === 0) return;
    onExportSelection?.(exportSelectionEntities);
  }, [exportSelectionEntities, onExportSelection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // When the keystroke is being typed into a child input/textarea/
      // contenteditable (most commonly the inline rename input on a
      // tree row), the tree's nav handler must NOT fire — Arrow keys
      // belong to the input's caret, Backspace/Delete to text edit,
      // F2 to nothing here, etc. We mirror the workspace-shortcut
      // gating (`isInputFocused`) at the container level so the
      // window-level shortcut bus stays untouched (no React-side
      // `stopPropagation` to interfere with Cmd+K, Cmd+S, …).
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = allFlatItems.findIndex((n) => n.id === focusedId);
        const nextIdx =
          e.key === 'ArrowDown' ? Math.min(currentIdx + 1, allFlatItems.length - 1) : Math.max(currentIdx - 1, 0);
        const next = allFlatItems[nextIdx];
        if (next) {
          setFocusedId(next.id);
          setTimeout(
            () =>
              containerRef.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }),
            0,
          );
        }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onOpen?.();
      } else if (e.key === 'ArrowRight' && focusedId) {
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && !isExpandedKey(node.id)) {
          e.preventDefault();
          toggleExpand(node.id);
        }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && isExpandedKey(node.id)) toggleExpand(node.id);
        else if (node?.parentId) setFocusedId(node.parentId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onDelete?.();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      } else if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        setSelectedIds(new Set());
        anchorRef.current = null;
      }
    },
    [allFlatItems, focusedId, isExpandedKey, toggleExpand, selectedIds.size, containerRef, setRenamingId],
  );

  return {
    focusedId,
    setFocusedId,
    selectedIds,
    exportableSelectedCount: exportSelectionEntities.length,
    isMultiSelected,
    clearSelection,
    isSelected,
    isFocused,
    handleItemClick,
    handleItemDoubleClick,
    handleKeyDown,
    handleExportSelectedClick,
    selectOpenedFile,
  };
}
