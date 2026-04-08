/**
 * SaveToCollectionModal — "Save to Collection" modal for draft entities.
 *
 * Appears when saving a draft entity that has no collection context.
 * Shows a browsable tree of collections/folders with existing items,
 * inline collection and folder creation, and a search bar.
 *
 * Tree navigation uses shared utilities from @openheaders/core/utils.
 */

import {
  ApiOutlined,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const { Text } = Typography;

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

const SECTION_TITLES: Record<V5.WorkspaceSection, string> = {
  requests: 'SAVE REQUEST',
  rules: 'SAVE RULE',
  environments: 'SAVE ENVIRONMENT',
  recordings: 'SAVE RECORDING',
  'proxy-rules': 'SAVE PROXY RULE',
};

interface SaveToCollectionModalProps {
  open: boolean;
  section: V5.WorkspaceSection;
  entityName: string;
  collections: V5.Collection[];
  collectionTrees: V5.CollectionTree[];
  workspaceName: string;
  onSave: (params: { name: string; collectionId: string; folderId?: string }) => void;
  onCreateCollection: (name: string, section: V5.WorkspaceSection) => Promise<V5.Collection | null>;
  onCreateFolder: (collectionUid: string, section: V5.WorkspaceSection, name: string, parentPath?: string) => Promise<V5.FolderNode | null>;
  onCancel: () => void;
}

export function SaveToCollectionModal({
  open,
  section,
  entityName,
  collections,
  collectionTrees,
  workspaceName,
  onSave,
  onCreateCollection,
  onCreateFolder,
  onCancel,
}: SaveToCollectionModalProps) {
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

  // Reset state when modal opens
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

  // Filter collections by search
  const filter = search.toLowerCase();
  const filteredCollections = useMemo(
    () => (filter ? collections.filter((c) => c.name.toLowerCase().includes(filter)) : collections),
    [collections, filter],
  );

  const selectedCollection = selectedCollectionId ? collections.find((c) => c.uid === selectedCollectionId) : null;
  const selectedTree = selectedCollectionId ? collectionTrees.find((c) => c.uid === selectedCollectionId) : null;

  // Current folder's children (uses shared tree utility)
  const currentNodes = useMemo((): V5.TreeNode[] => {
    if (!selectedTree) return [];
    return findNodeChildren(selectedTree.tree, selectedFolderPath) ?? [];
  }, [selectedTree, selectedFolderPath]);

  // Breadcrumb segments (uses shared tree utility)
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
    // If inside a folder, extract the folder uid for the save callback
    const folderNode = selectedFolderPath
      ? currentNodes.length >= 0 // we have a valid folder path
        ? (() => {
          // Find the folder node to get its uid
          const findFolder = (nodes: V5.TreeNode[], path: string): V5.FolderNode | null => {
            for (const n of nodes) {
              if (n.type === 'folder' && n.path === path) return n;
              if (n.type === 'folder') {
                const found = findFolder(n.children, path);
                if (found) return found;
              }
            }
            return null;
          };
          return selectedTree ? findFolder(selectedTree.tree, selectedFolderPath) : null;
        })()
        : null
      : null;
    onSave({ name: name.trim(), collectionId: selectedCollectionId, folderId: folderNode?.uid });
  }, [name, selectedCollectionId, selectedFolderPath, selectedTree, currentNodes, onSave]);

  const handleCreateCollection = useCallback(async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    const col = await onCreateCollection(trimmed, section);
    if (col) {
      setSelectedCollectionId(col.uid);
      setSelectedFolderPath(undefined);
      setCreatingCollection(false);
      setNewCollectionName('');
    }
  }, [newCollectionName, section, onCreateCollection]);

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !selectedCollectionId) return;
    // parentPath: current folder path, or the collection's root path
    const parentPath = selectedFolderPath ?? selectedTree?.path;
    const folder = await onCreateFolder(selectedCollectionId, section, trimmed, parentPath);
    if (folder) {
      setSelectedFolderPath(folder.path);
      setCreatingFolder(false);
      setNewFolderName('');
    }
  }, [newFolderName, selectedCollectionId, selectedFolderPath, selectedTree, section, onCreateFolder]);

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{SECTION_TITLES[section]}</span>}
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
      {/* Entity name */}
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {section === 'requests' ? 'Request name' : section === 'rules' ? 'Rule name' : 'Environment name'}
        </Text>
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
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: breadcrumb nav */}
        <span
          className={selectedCollectionId ? 'v5-save-modal-breadcrumb' : undefined}
          style={{
            color: selectedCollectionId ? token.colorPrimary : token.colorText,
            cursor: selectedCollectionId ? 'pointer' : undefined,
            fontWeight: selectedCollectionId ? 400 : 600,
          }}
          onClick={() => {
            if (selectedCollectionId) {
              setSelectedCollectionId(null);
              setSelectedFolderPath(undefined);
              setCreatingFolder(false);
            }
          }}
        >
          {workspaceName}
        </span>
        {breadcrumb.map((seg, i) => (
          <span key={i}>
            <span style={{ color: token.colorTextTertiary }}>{' / '}</span>
            {seg.onClick ? (
              // biome-ignore lint/a11y/useKeyWithClickEvents: breadcrumb nav
              <span
                className="v5-save-modal-breadcrumb"
                style={{ color: token.colorPrimary, cursor: 'pointer' }}
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
        placeholder="Search for collection or folder"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        allowClear
        style={{ marginBottom: 8, fontSize: 12 }}
        prefix={<span style={{ color: token.colorTextQuaternary, fontSize: 10 }}>=</span>}
      />

      {/* Tree browser */}
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
            <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }} onClick={() => void handleCreateCollection()}>
              Create
            </Button>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 11, color: token.colorTextSecondary }}
              onClick={() => { setCreatingCollection(false); setNewCollectionName(''); }}
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
                className="v5-save-modal-row"
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
                  setSelectedFolderPath(undefined);
                  setSearch('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedCollectionId(col.uid);
                    setSelectedFolderPath(undefined);
                    setSearch('');
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <FolderOpenOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
                <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>
                <RightOutlined
                  className="v5-save-modal-row-chevron"
                  style={{ fontSize: 10, color: token.colorTextQuaternary }}
                />
              </div>
            ))}
          </>
        )}

        {/* Browse: inside a collection (folders + existing items) */}
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
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }} onClick={() => void handleCreateFolder()}>
                  Create
                </Button>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 11, color: token.colorTextSecondary }}
                  onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
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
                    className="v5-save-modal-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                    onClick={() => { setSelectedFolderPath(node.path); setCreatingFolder(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedFolderPath(node.path); }}
                    role="button"
                    tabIndex={0}
                  >
                    <FolderOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                    <span style={{ flex: 1, color: token.colorText }}>{node.name}</span>
                    <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
                  </div>
                );
              }
              if (node.type === 'request') {
                return (
                  <div
                    key={node.uid}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12, color: token.colorTextSecondary }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: METHOD_COLORS[node.method] || '#999',
                        width: 36,
                        textTransform: 'uppercase',
                      }}
                    >
                      {node.method}
                    </span>
                    <span>{node.name}</span>
                  </div>
                );
              }
              if (node.type === 'rule') {
                return (
                  <div
                    key={node.uid}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12, color: token.colorTextSecondary }}
                  >
                    <ThunderboltOutlined style={{ fontSize: 11, color: node.enabled ? token.colorPrimary : token.colorTextTertiary }} />
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
}
