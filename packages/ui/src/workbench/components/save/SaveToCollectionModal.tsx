/**
 * SaveToCollectionModal — "Save to Collection" modal for draft rules.
 *
 * Shows a browsable tree of collections with folders and existing rules,
 * inline collection and folder creation, and a search bar.
 *
 * Tree navigation uses shared utilities from @openheaders/core/utils.
 */

import { FolderOpenOutlined, FolderOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { Collection, CollectionTree, Rule } from '@openheaders/core/types';
import { Button, Input, type InputRef, Modal, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NEW_RULES_COLLECTION_NAME, uniqueName } from '@openheaders/ui/shared/naming';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { renderCollectionRows, renderNodeRows } from './save-browser-rows';
import { useSaveBrowser } from './use-save-browser';

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
  /** Full workspace rules — lets rule rows render the same stateful icon
   *  as the sidebar (direction arrow + active/draft color). Absent for
   *  the request/template variants, which never list rule nodes. */
  rules?: Rule[];
  pausedUids?: Set<string>;
  unresolvableRuleUids?: Set<string>;
  /** Base name for the Enter-from-Name prefilled collection create — the
   *  entity family's default ("New Requests Collection", "User Templates").
   *  Deduped with the shared `(2)` scheme against existing collections. */
  defaultNewCollectionName?: string;
}

const SaveToCollectionModal: React.FC<SaveToCollectionModalProps> = ({
  open,
  entityName,
  rules,
  pausedUids,
  unresolvableRuleUids,
  collectionTrees,
  collections,
  onSave,
  onCreateCollection,
  onCreateFolder,
  onCancel,
  defaultNewCollectionName = NEW_RULES_COLLECTION_NAME,
}) => {
  const { token } = theme.useToken();
  const saveLabel = useShortcutLabel('save');
  // Platform-appropriate label for the "new folder/collection" chord — local to this modal.
  // Uses literal Control on both platforms (Cmd+N / Cmd+Shift+N are reserved by the
  // browser; Alt+N inserts a character inside the inline name input on macOS).
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const newLabel = isMac ? '⌃⇧N' : 'Ctrl+Shift+N';
  const [name, setName] = useState(entityName);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const nameInputRef = useRef<InputRef>(null);
  const searchInputRef = useRef<InputRef>(null);
  const newCollectionInputRef = useRef<InputRef>(null);
  const newFolderInputRef = useRef<InputRef>(null);

  const {
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
    drillIntoFocusedRow,
  } = useSaveBrowser({ collections, collectionTrees, setCreatingFolder });

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
    if (creatingCollection) setTimeout(() => newCollectionInputRef.current?.focus({ cursor: 'end' }), 50);
  }, [creatingCollection]);

  useEffect(() => {
    if (creatingFolder) setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, [creatingFolder]);

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

  // Enter in the Name input walks the fastest save path instead of dead-ending:
  // with a collection selected it saves; at the root it drills into the focused
  // (first) collection and moves focus to the folder search; on an empty
  // workspace it opens the inline create row prefilled with the deduped
  // default collection name, so Enter-Enter-Enter completes a first save.
  const handleNameEnter = useCallback(() => {
    if (canSave) {
      handleSave();
      return;
    }
    if (selectedCollectionId || !name.trim()) return;
    if (collections.length === 0) {
      setNewCollectionName(uniqueName(defaultNewCollectionName, new Set(collections.map((c) => c.name))));
      setCreatingCollection(true);
      return;
    }
    if (drillIntoFocusedRow()) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [canSave, handleSave, selectedCollectionId, name, collections, defaultNewCollectionName, drillIntoFocusedRow]);

  // Search input + browser share nav keys; Enter on an empty folder view
  // (nothing left to drill into) saves right where the user is standing.
  const handleBrowseKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && selectedCollectionId && effectiveFocusId === null) {
        e.preventDefault();
        if (canSave) handleSave();
        return;
      }
      handleNavKeyDown(e);
    },
    [selectedCollectionId, effectiveFocusId, canSave, handleSave, handleNavKeyDown],
  );

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
          onPressEnter={handleNameEnter}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              searchInputRef.current?.focus();
            }
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
        onKeyDown={handleBrowseKeyDown}
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
        onKeyDown={handleBrowseKeyDown}
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
            {renderCollectionRows({
              filteredCollections,
              effectiveFocusId,
              token,
              setSelectedCollectionId,
              setSearch,
              setFocusedId,
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

            {renderNodeRows({
              filteredCurrentNodes,
              effectiveFocusId,
              token,
              setSelectedFolderPath,
              setCreatingFolder,
              setFocusedId,
              rules,
              pausedUids,
              unresolvableRuleUids,
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
