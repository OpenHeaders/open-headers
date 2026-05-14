/**
 * SaveToCollectionModal — "Save to Collection" modal for draft rules.
 *
 * Shows a browsable tree of collections with folders and existing rules,
 * inline collection and folder creation, and a search bar.
 *
 * Tree navigation uses shared utilities from @openheaders/core/utils.
 */

import {
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { Collection, CollectionTree, TreeNode } from '@openheaders/core/types';
import { buildBreadcrumbTrail, findNodeChildren } from '@openheaders/core/utils';
import { Button, Input, type InputRef, Modal, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

const { Text } = Typography;

interface SaveToCollectionModalProps {
  open: boolean;
  entityName: string;
  collectionTrees: CollectionTree[];
  collections: Collection[];
  onSave: (params: { name: string; collectionId: string; folderPath?: string }) => void;
  onCreateCollection: (name: string) => Promise<Collection | null>;
  onCreateFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  onCancel: () => void;
}

type SelectableRow =
  | { kind: 'collection'; id: string; collection: Collection }
  | { kind: 'folder'; id: string; node: TreeNode & { type: 'folder' } };

const SaveToCollectionModal: React.FC<SaveToCollectionModalProps> = ({
  open,
  entityName,
  collectionTrees,
  collections,
  onSave,
  onCreateCollection,
  onCreateFolder,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const saveLabel = useShortcutLabel('save');
  // Platform-appropriate label for the "new folder/collection" chord — local to this modal.
  // Uses literal Control on both platforms (Cmd+N / Cmd+Shift+N are reserved by the
  // browser; Alt+N inserts a character inside the inline name input on macOS).
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const newLabel = isMac ? '⌃⇧N' : 'Ctrl+Shift+N';
  const [name, setName] = useState(entityName);
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | undefined>(undefined);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const nameInputRef = useRef<InputRef>(null);
  const searchInputRef = useRef<InputRef>(null);
  const newCollectionInputRef = useRef<InputRef>(null);
  const newFolderInputRef = useRef<InputRef>(null);
  const browserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setName(entityName);
      setSearch('');
      setSelectedCollectionId(null);
      setSelectedFolderPath(undefined);
      setCreatingCollection(false);
      setNewCollectionName('');
      setCreatingFolder(false);
      setNewFolderName('');
      setFocusedId(null);
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open, entityName]);

  useEffect(() => {
    if (creatingCollection) setTimeout(() => newCollectionInputRef.current?.focus(), 50);
  }, [creatingCollection]);

  useEffect(() => {
    if (creatingFolder) setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, [creatingFolder]);

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

  const canSave = !!selectedCollectionId && !!name.trim();

  const handleSave = useCallback(() => {
    if (!selectedCollectionId || !name.trim()) return;
    onSave({ name: name.trim(), collectionId: selectedCollectionId, folderPath: selectedFolderPath });
  }, [name, selectedCollectionId, selectedFolderPath, onSave]);

  const handleCreateCollection = useCallback(async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    const col = await onCreateCollection(trimmed);
    if (col) {
      setSelectedCollectionId(col.uid);
      setSelectedFolderPath(undefined);
      setCreatingCollection(false);
      setNewCollectionName('');
      setFocusedId(null);
      // Focus the search input so ← / ↑↓ / ⌘S work immediately
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [newCollectionName, onCreateCollection]);

  // Compute the parent path for new folders — current folder path, or the collection's root path
  const currentParentPath = useMemo(() => {
    if (!selectedCollectionId || !selectedTree) return '';
    return selectedFolderPath ?? selectedTree.path;
  }, [selectedCollectionId, selectedTree, selectedFolderPath]);

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !currentParentPath) return;
    const folder = await onCreateFolder(trimmed, currentParentPath);
    if (folder) {
      setSelectedFolderPath(folder.path);
      setCreatingFolder(false);
      setNewFolderName('');
      setFocusedId(null);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [newFolderName, currentParentPath, onCreateFolder]);

  // Imperative scroll for keyboard nav
  const scrollToId = useCallback((id: string) => {
    setTimeout(() => {
      browserRef.current?.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, []);

  const drillIntoRow = useCallback((row: SelectableRow) => {
    if (row.kind === 'collection') {
      setSelectedCollectionId(row.collection.uid);
      setSelectedFolderPath(undefined);
    } else {
      setSelectedFolderPath(row.node.path);
    }
    setSearch('');
    setFocusedId(null);
    setCreatingFolder(false);
  }, []);

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
  }, [selectedCollectionId, selectedFolderPath, selectedTree]);

  // Global key handling while modal is open:
  //   Cmd/Ctrl+S — save
  //   Alt+N      — start creating a folder (inside a collection) or collection (at root).
  //                Cmd/Ctrl+N can't be used; the browser reserves it for new-window.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && k === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (canSave) handleSave();
        return;
      }
      if (e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey && k === 'n') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedCollectionId) setCreatingFolder(true);
        else setCreatingCollection(true);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, canSave, handleSave, selectedCollectionId]);

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
    [selectableRows, effectiveFocusId, scrollToId, drillIntoRow, drillBack, search, selectedCollectionId, selectedFolderPath],
  );

  const saveTooltip = !selectedCollectionId
    ? 'Select a collection first'
    : !name.trim()
      ? 'Enter a name'
      : saveLabel
        ? `Save (${saveLabel})`
        : 'Save';

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>SAVE</span>}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {selectedCollectionId ? (
              <Tooltip title={`New folder (${newLabel})`}>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ padding: 0, fontSize: 12 }}
                  onClick={() => setCreatingFolder(true)}
                >
                  New folder
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title={`New collection (${newLabel})`}>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ padding: 0, fontSize: 12 }}
                  onClick={() => setCreatingCollection(true)}
                >
                  New collection
                </Button>
              </Tooltip>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={onCancel} size="small">
                Cancel
              </Button>
              <Tooltip title={saveTooltip}>
                <span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    disabled={!canSave}
                    onClick={handleSave}
                    style={canSave ? { background: '#f5722d', borderColor: '#f5722d' } : undefined}
                  >
                    Save
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 10,
              color: token.colorTextTertiary,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              paddingTop: 6,
            }}
          >
            <span>↑↓ navigate</span>
            <span>→ open</span>
            {(selectedCollectionId || selectedFolderPath) && <span>← back</span>}
            <span>{newLabel} new</span>
            {saveLabel && <span>{saveLabel} save</span>}
            <span style={{ marginLeft: 'auto' }}>esc close</span>
          </div>
        </div>
      }
      width={480}
      destroyOnClose
    >
      {/* Rule name */}
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Name</Text>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={() => {
            if (canSave) handleSave();
          }}
          size="small"
          style={{ fontSize: 12 }}
        />
      </div>

      {/* Save to breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: 600 }}>Save to </Text>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: decorative breadcrumb nav — keyboard access via the confirm button */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative breadcrumb nav */}
        <span
          style={{
            color: selectedCollectionId ? token.colorPrimary : token.colorText,
            cursor: selectedCollectionId ? 'pointer' : undefined,
            fontWeight: selectedCollectionId ? 400 : 600,
            padding: '1px 3px',
            borderRadius: 3,
          }}
          onClick={() => {
            if (selectedCollectionId) {
              setSelectedCollectionId(null);
              setSelectedFolderPath(undefined);
              setCreatingFolder(false);
              setFocusedId(null);
            }
          }}
        >
          Local Rules
        </span>
        {breadcrumb.map((seg, i) => (
          <span key={i}>
            <span style={{ color: token.colorTextTertiary }}>{' / '}</span>
            {seg.onClick ? (
              // biome-ignore lint/a11y/useKeyWithClickEvents: breadcrumb nav
              // biome-ignore lint/a11y/noStaticElementInteractions: breadcrumb nav
              <span
                style={{ color: token.colorPrimary, cursor: 'pointer', padding: '1px 3px', borderRadius: 3 }}
                onClick={seg.onClick}
              >
                {seg.label}
              </span>
            ) : (
              <span style={{ fontWeight: 600 }}>{seg.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Search */}
      <Input
        ref={searchInputRef}
        placeholder={selectedCollectionId ? 'Search folders' : 'Search for collection'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleNavKeyDown}
        size="small"
        allowClear
        style={{ marginBottom: 8, fontSize: 12 }}
        prefix={<span style={{ color: token.colorTextQuaternary, fontSize: 10 }}>=</span>}
      />

      {/* Collection/folder browser */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled at search input + container onKeyDown */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: container hosts keyboard nav for its rows */}
      <div
        ref={browserRef}
        onKeyDown={handleNavKeyDown}
        tabIndex={-1}
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 6,
          maxHeight: 300,
          minHeight: 200,
          overflowY: 'auto',
          background: token.colorBgContainer,
          outline: 'none',
        }}
      >
        {/* Inline new collection */}
        {creatingCollection && !selectedCollectionId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <FolderOpenOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            <Input
              ref={newCollectionInputRef}
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Name your collection"
              size="small"
              style={{ flex: 1, fontSize: 12 }}
              onPressEnter={() => void handleCreateCollection()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreatingCollection(false);
                  setNewCollectionName('');
                }
              }}
            />
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 11 }}
              onClick={() => void handleCreateCollection()}
            >
              Create
            </Button>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 11, color: token.colorTextSecondary }}
              onClick={() => {
                setCreatingCollection(false);
                setNewCollectionName('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Browse: collection list */}
        {!selectedCollectionId && (
          <>
            {filteredCollections.length === 0 && !creatingCollection && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, display: 'block', marginBottom: collections.length === 0 ? 12 : 0 }}
                >
                  {collections.length === 0 ? 'No collections yet.' : 'No matching collections.'}
                </Text>
                {collections.length === 0 && (
                  <>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      style={{ fontSize: 12, padding: 0 }}
                      onClick={() => setCreatingCollection(true)}
                    >
                      Create collection
                    </Button>
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        or press <kbd style={kbdStyle(token)}>{newLabel}</kbd>
                      </Text>
                    </div>
                  </>
                )}
              </div>
            )}
            {filteredCollections.map((col) => {
              const rowId = `col-${col.uid}`;
              const isFocused = rowId === effectiveFocusId;
              return (
                <div
                  key={col.uid}
                  data-row-id={rowId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    background: isFocused ? token.colorPrimaryBg : undefined,
                  }}
                  onClick={() => {
                    setSelectedCollectionId(col.uid);
                    setSearch('');
                    setFocusedId(null);
                  }}
                  onMouseEnter={(e) => {
                    setFocusedId(rowId);
                    if (!isFocused) (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isFocused) (e.currentTarget as HTMLElement).style.background = '';
                  }}
                  role="option"
                  aria-selected={isFocused}
                  tabIndex={-1}
                >
                  <FolderOpenOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
                  <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>
                  <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
                </div>
              );
            })}
          </>
        )}

        {/* Browse: inside a collection (folders + existing rules) */}
        {selectedCollectionId && (
          <>
            {/* Inline new folder */}
            {creatingFolder && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <FolderOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                <Input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Name your folder"
                  size="small"
                  style={{ flex: 1, fontSize: 12 }}
                  onPressEnter={() => void handleCreateFolder()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                />
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 11 }}
                  onClick={() => void handleCreateFolder()}
                >
                  Create
                </Button>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 11, color: token.colorTextSecondary }}
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {filteredCurrentNodes.map((node) => {
              if (node.type === 'folder') {
                const rowId = `fld-${node.uid}`;
                const isFocused = rowId === effectiveFocusId;
                return (
                  <div
                    key={node.uid}
                    data-row-id={rowId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      background: isFocused ? token.colorPrimaryBg : undefined,
                    }}
                    onClick={() => {
                      setSelectedFolderPath(node.path);
                      setCreatingFolder(false);
                      setFocusedId(null);
                    }}
                    onMouseEnter={(e) => {
                      setFocusedId(rowId);
                      if (!isFocused) (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isFocused) (e.currentTarget as HTMLElement).style.background = '';
                    }}
                    role="option"
                    aria-selected={isFocused}
                    tabIndex={-1}
                  >
                    <FolderOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                    <span style={{ flex: 1, color: token.colorText }}>{node.name}</span>
                    <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
                  </div>
                );
              }
              if (node.type === 'rule') {
                return (
                  <div
                    key={node.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      color: token.colorTextSecondary,
                    }}
                  >
                    <ThunderboltOutlined
                      style={{ fontSize: 11, color: node.enabled ? token.colorPrimary : token.colorTextTertiary }}
                    />
                    <span>{node.name}</span>
                  </div>
                );
              }
              return null;
            })}

            {filteredCurrentNodes.length === 0 && !creatingFolder && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  padding: '16px 12px',
                  gap: 6,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  This {selectedFolderPath ? 'folder' : 'collection'} is empty.
                </Text>
                {canSave && saveLabel && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Press <kbd style={kbdStyle(token)}>{saveLabel}</kbd> to save here, or{' '}
                    <kbd style={kbdStyle(token)}>{newLabel}</kbd> for a new folder.
                  </Text>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

function kbdStyle(token: { colorBgElevated: string; colorTextSecondary: string; colorBorderSecondary: string }) {
  return {
    background: token.colorBgElevated,
    color: token.colorTextSecondary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 3,
    padding: '0 5px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 10,
  } as const;
}

export default SaveToCollectionModal;
