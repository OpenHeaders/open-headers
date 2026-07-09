/**
 * useSidebarInteraction — the sidebar's selection + navigation subsystem.
 *
 * Owns the three pieces of interaction-local state that the mouse
 * handlers, the keyboard-nav handler, the multi-select-reset effect, and
 * the auto-select effect all read or write:
 *
 *   - `focusedId`            — keyboard-nav cursor (distinct from the
 *                              active-tab-driven `isSelected`).
 *   - `exportSelectedIds`    — the multi-select "Export selected…" set.
 *   - `lastExportSelectAnchorRef` — shift-click range anchor (never
 *                              leaked; consumers clear via
 *                              `clearExportSelection()`).
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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
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
  expandedKeys: Set<string>;
  localCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  templateCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  requestCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  /** Parent request uid for a response-example uid — see useSelectOpenedTab. */
  resolveResponseExampleParent?: (exampleUid: string) => string | null;
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
  exportSelectedIds: Set<string>;
  isExportSelected: (id: string) => boolean;
  clearExportSelection: () => void;
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
  expandedKeys,
  localCollectionTrees,
  templateCollectionTrees,
  requestCollectionTrees,
  resolveResponseExampleParent,
  containerRef,
  toggleExpand,
  setRenamingId,
  setExpandedKeys,
  setSectionsExpanded,
  onExportSelection,
}: UseSidebarInteractionParams): SidebarInteraction {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Multi-select export selection state. Distinct from `focusedId` /
  // `isSelected` (which track active-tab navigation) — these track which
  // sidebar entities are queued for a combined "Export selected…" call.
  // Cmd/Ctrl+click toggles a single entry; Shift+click extends a range
  // anchored at the last toggled exportable id. Plain click clears.
  // Cleared on view change, filter change, and explicit Esc.
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(() => new Set());
  const lastExportSelectAnchorRef = useRef<string | null>(null);

  const isExportSelected = useCallback((id: string) => exportSelectedIds.has(id), [exportSelectedIds]);

  const clearExportSelection = useCallback(() => {
    setExportSelectedIds(new Set());
    lastExportSelectAnchorRef.current = null;
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

      if ((modifierToggle || modifierRange) && node.exportEntity) {
        // Multi-select gesture — suppress nav. Cmd/Ctrl toggles, Shift
        // extends a contiguous range over exportable nodes anchored at
        // the last toggled id (or this node if no anchor yet).
        e.preventDefault();
        if (modifierRange) {
          const exportableIds = allFlatItems.filter((n) => n.exportEntity).map((n) => n.id);
          const anchor = lastExportSelectAnchorRef.current ?? node.id;
          const a = exportableIds.indexOf(anchor);
          const b = exportableIds.indexOf(node.id);
          if (a >= 0 && b >= 0) {
            const [from, to] = a <= b ? [a, b] : [b, a];
            setExportSelectedIds((prev) => {
              const next = new Set(prev);
              for (let i = from; i <= to; i++) next.add(exportableIds[i]!);
              return next;
            });
            lastExportSelectAnchorRef.current = node.id;
          }
        } else {
          setExportSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          });
          lastExportSelectAnchorRef.current = node.id;
        }
        setFocusedId(node.id);
        return;
      }

      // Plain click — clear any multi-select set, then normal nav.
      if (exportSelectedIds.size > 0) setExportSelectedIds(new Set());
      lastExportSelectAnchorRef.current = null;
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
    [shouldOpenOnSingleClick, allFlatItems, exportSelectedIds.size],
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

  // Multi-select set is bound to the current view + filter context — a
  // pick made under "http-rules" with no filter would silently include
  // hidden nodes if the user switched view or typed a query, so clear it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on view/filter change
  useEffect(() => {
    if (exportSelectedIds.size === 0) return;
    setExportSelectedIds(new Set());
    lastExportSelectAnchorRef.current = null;
  }, [view, filterText]);

  const resolveExportSelectionEntities = useCallback((): SidebarExportEntity[] => {
    const byId = new Map<string, SidebarExportEntity>();
    for (const n of allFlatItems) {
      if (exportSelectedIds.has(n.id) && n.exportEntity) byId.set(n.id, n.exportEntity);
    }
    return Array.from(byId.values());
  }, [allFlatItems, exportSelectedIds]);

  const handleExportSelectedClick = useCallback(() => {
    const entities = resolveExportSelectionEntities();
    if (entities.length === 0) return;
    onExportSelection?.(entities);
  }, [resolveExportSelectionEntities, onExportSelection]);

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
        if (node?.expandable && !expandedKeys.has(node.id)) {
          e.preventDefault();
          toggleExpand(node.id);
        }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && expandedKeys.has(node.id)) toggleExpand(node.id);
        else if (node?.parentId) setFocusedId(node.parentId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onDelete?.();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      } else if (e.key === 'Escape' && exportSelectedIds.size > 0) {
        e.preventDefault();
        setExportSelectedIds(new Set());
        lastExportSelectAnchorRef.current = null;
      }
    },
    [allFlatItems, focusedId, expandedKeys, toggleExpand, exportSelectedIds.size],
  );

  return {
    focusedId,
    setFocusedId,
    exportSelectedIds,
    isExportSelected,
    clearExportSelection,
    isSelected,
    isFocused,
    handleItemClick,
    handleItemDoubleClick,
    handleKeyDown,
    handleExportSelectedClick,
    selectOpenedFile,
  };
}
