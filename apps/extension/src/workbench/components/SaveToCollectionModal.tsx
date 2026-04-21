/**
 * SaveToCollectionModal — "Save to Collection" modal for draft workbench.
 *
 * Shows a browsable tree of collections with folders and existing workbench,
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
import type { V5 } from '@openheaders/core/types';
import { buildBreadcrumbTrail, findNodeChildren } from '@openheaders/core/utils';
import { Button, Input, type InputRef, Modal, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const { Text } = Typography;

interface SaveToCollectionModalProps {
  open: boolean;
  entityName: string;
  collectionTrees: V5.CollectionTree[];
  collections: V5.Collection[];
  onSave: (params: { name: string; collectionId: string; folderPath?: string }) => void;
  onCreateCollection: (name: string) => Promise<V5.Collection | null>;
  onCreateFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  onCancel: () => void;
}

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
  const [name, setName] = useState(entityName);
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | undefined>(undefined);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const nameInputRef = useRef<InputRef>(null);
  const newCollectionInputRef = useRef<InputRef>(null);
  const newFolderInputRef = useRef<InputRef>(null);

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
  const currentNodes = useMemo((): V5.TreeNode[] => {
    if (!selectedTree) return [];
    return findNodeChildren(selectedTree.tree, selectedFolderPath) ?? [];
  }, [selectedTree, selectedFolderPath]);

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
    }
  }, [newFolderName, currentParentPath, onCreateFolder]);

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>SAVE RULE</span>}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {selectedCollectionId ? (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => setCreatingFolder(true)}
            >
              New folder
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => setCreatingCollection(true)}
            >
              New collection
            </Button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onCancel} size="small">
              Cancel
            </Button>
            <Tooltip
              title={!selectedCollectionId ? 'Select a collection first' : !name.trim() ? 'Enter a name' : undefined}
            >
              <span>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  disabled={!selectedCollectionId || !name.trim()}
                  onClick={handleSave}
                  style={
                    selectedCollectionId && name.trim() ? { background: '#f5722d', borderColor: '#f5722d' } : undefined
                  }
                >
                  Save
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
      }
      width={480}
      destroyOnClose
    >
      {/* Rule name */}
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rule name</Text>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        placeholder="Search for collection"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        allowClear
        style={{ marginBottom: 8, fontSize: 12 }}
        prefix={<span style={{ color: token.colorTextQuaternary, fontSize: 10 }}>=</span>}
      />

      {/* Collection/folder browser */}
      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 6,
          maxHeight: 300,
          minHeight: 200,
          overflowY: 'auto',
          background: token.colorBgContainer,
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
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    style={{ fontSize: 12, padding: 0 }}
                    onClick={() => setCreatingCollection(true)}
                  >
                    Create collection
                  </Button>
                )}
              </div>
            )}
            {filteredCollections.map((col) => (
              <div
                key={col.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
                onClick={() => {
                  setSelectedCollectionId(col.uid);
                  setSearch('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedCollectionId(col.uid);
                    setSearch('');
                  }
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '';
                }}
                role="button"
                tabIndex={0}
              >
                <FolderOpenOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
                <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>
                <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
              </div>
            ))}
          </>
        )}

        {/* Browse: inside a collection (folders + existing workbench) */}
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

            {currentNodes.map((node) => {
              if (node.type === 'folder') {
                return (
                  <div
                    key={node.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                    onClick={() => {
                      setSelectedFolderPath(node.path);
                      setCreatingFolder(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedFolderPath(node.path);
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '';
                    }}
                    role="button"
                    tabIndex={0}
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

            {currentNodes.length === 0 && !creatingFolder && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  padding: '16px 12px',
                  gap: 8,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  This {selectedFolderPath ? 'folder' : 'collection'} is empty.
                </Text>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SaveToCollectionModal;
