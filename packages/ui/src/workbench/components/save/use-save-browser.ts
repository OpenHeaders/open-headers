/**
 * Browse state + keyboard navigation for {@link SaveToCollectionModal} —
 * search/selection/focus state, the filtered collection/node derivations,
 * breadcrumb segments, and the drill-in/drill-back + arrow-key handlers.
 * `creatingFolder` stays component-owned (it belongs to the inline-create
 * cluster); its setter rides in so drilling closes an open create row.
 */

import type { Collection, CollectionTree, TreeNode } from '@openheaders/core/types';
import { buildBreadcrumbTrail, findNodeChildren } from '@openheaders/core/utils';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

type SelectableRow =
  | { kind: 'collection'; id: string; collection: Collection }
  | { kind: 'folder'; id: string; node: TreeNode & { type: 'folder' } };

interface SaveBrowserInputs {
  collections: Collection[];
  collectionTrees: CollectionTree[];
  setCreatingFolder: (creating: boolean) => void;
}

export function useSaveBrowser({ collections, collectionTrees, setCreatingFolder }: SaveBrowserInputs) {
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | undefined>(undefined);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const browserRef = useRef<HTMLDivElement>(null);

  const filter = search.toLowerCase();
  const filteredCollections = useMemo(
    () => (filter ? collections.filter((c) => c.name.toLowerCase().includes(filter)) : collections),
    [collections, filter],
  );

  const selectedCollection = selectedCollectionId ? collections.find((c) => c.uid === selectedCollectionId) : null;
  const selectedTree = selectedCollectionId ? collectionTrees.find((c) => c.uid === selectedCollectionId) : null;

  // Current folder's children (shared tree utility)
  const currentNodes = useMemo((): TreeNode[] => {
    if (!selectedTree) return [];
    return findNodeChildren(selectedTree.tree, selectedFolderPath) ?? [];
  }, [selectedTree, selectedFolderPath]);

  const filteredCurrentNodes = useMemo((): TreeNode[] => {
    if (!filter) return currentNodes;
    return currentNodes.filter((n) => n.name.toLowerCase().includes(filter));
  }, [currentNodes, filter]);

  // Flat list of keyboard-selectable rows in the current view
  const selectableRows = useMemo<SelectableRow[]>(() => {
    if (!selectedCollectionId) {
      return filteredCollections.map((col) => ({ kind: 'collection', id: `col-${col.uid}`, collection: col }));
    }
    return filteredCurrentNodes
      .filter((n): n is TreeNode & { type: 'folder' } => n.type === 'folder')
      .map((node) => ({ kind: 'folder', id: `fld-${node.uid}`, node }));
  }, [selectedCollectionId, filteredCollections, filteredCurrentNodes]);

  // Clamp focusedId — if it points to a row that no longer exists, snap to first
  const focusValid = focusedId != null && selectableRows.some((r) => r.id === focusedId);
  const effectiveFocusId = focusValid ? focusedId : (selectableRows[0]?.id ?? null);

  // Breadcrumb segments (shared tree utility)
  const breadcrumb = useMemo(() => {
    if (!selectedCollection || !selectedTree) return [];
    const folderTrail = buildBreadcrumbTrail(selectedTree.tree, selectedFolderPath);
    return [
      {
        label: selectedCollection.name,
        onClick: selectedFolderPath ? () => setSelectedFolderPath(undefined) : undefined,
      },
      ...folderTrail.map((seg, i) => ({
        label: seg.name,
        onClick: i < folderTrail.length - 1 ? () => setSelectedFolderPath(seg.path) : undefined,
      })),
    ];
  }, [selectedCollection, selectedTree, selectedFolderPath]);

  // Compute the parent path for new folders — current folder path, or the collection's root path
  const currentParentPath = useMemo(() => {
    if (!selectedCollectionId || !selectedTree) return '';
    return selectedFolderPath ?? selectedTree.path;
  }, [selectedCollectionId, selectedTree, selectedFolderPath]);

  // Imperative scroll for keyboard nav
  const scrollToId = useCallback((id: string) => {
    setTimeout(() => {
      browserRef.current?.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, []);

  const drillIntoRow = useCallback(
    (row: SelectableRow) => {
      if (row.kind === 'collection') {
        setSelectedCollectionId(row.collection.uid);
        setSelectedFolderPath(undefined);
      } else {
        setSelectedFolderPath(row.node.path);
      }
      setSearch('');
      setFocusedId(null);
      setCreatingFolder(false);
    },
    [setCreatingFolder],
  );

  const drillBack = useCallback(() => {
    if (selectedFolderPath && selectedTree) {
      // Use the breadcrumb trail to derive the parent path — same source the
      // breadcrumb UI uses, so manual string slicing can't drift from it.
      const trail = buildBreadcrumbTrail(selectedTree.tree, selectedFolderPath);
      const parent = trail.length >= 2 ? trail[trail.length - 2].path : undefined;
      setSelectedFolderPath(parent);
      setFocusedId(null);
      setCreatingFolder(false);
      return;
    }
    if (selectedCollectionId) {
      setSelectedCollectionId(null);
      setSelectedFolderPath(undefined);
      setFocusedId(null);
      setCreatingFolder(false);
    }
  }, [selectedCollectionId, selectedFolderPath, selectedTree, setCreatingFolder]);

  // Keyboard nav handler — bound to search input and to the list container
  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (selectableRows.length === 0) return;
        e.preventDefault();
        const cur = selectableRows.findIndex((r) => r.id === effectiveFocusId);
        const next =
          e.key === 'ArrowDown'
            ? cur < selectableRows.length - 1
              ? cur + 1
              : 0
            : cur > 0
              ? cur - 1
              : selectableRows.length - 1;
        const row = selectableRows[next];
        setFocusedId(row.id);
        scrollToId(row.id);
        return;
      }
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        const row = selectableRows.find((r) => r.id === effectiveFocusId);
        if (!row) return;
        e.preventDefault();
        drillIntoRow(row);
        return;
      }
      if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && search === '')) {
        if (selectedCollectionId || selectedFolderPath) {
          e.preventDefault();
          drillBack();
        }
      }
    },
    [
      selectableRows,
      effectiveFocusId,
      scrollToId,
      drillIntoRow,
      drillBack,
      search,
      selectedCollectionId,
      selectedFolderPath,
    ],
  );

  return {
    search,
    setSearch,
    selectedCollectionId,
    setSelectedCollectionId,
    selectedFolderPath,
    setSelectedFolderPath,
    setFocusedId,
    effectiveFocusId,
    filteredCollections,
    filteredCurrentNodes,
    breadcrumb,
    currentParentPath,
    browserRef,
    handleNavKeyDown,
  };
}
