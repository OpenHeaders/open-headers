/**
 * SaveToCollectionModal — "Save to Collection" modal for draft entities.
 *
 * Appears when saving a draft entity that has no collection context.
 * Shows a browsable tree of collections/folders filtered by the entity's section,
 * with inline folder creation and a search bar.
 */

import { FolderOpenOutlined, FolderOutlined, PlusOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';

type CollectionSection = 'requests' | 'rules' | 'environments' | 'recordings';
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

interface SaveToCollectionModalProps {
  open: boolean;
  section: CollectionSection;
  entityName: string;
  collections: V5.Collection[];
  /** Requests in the current workspace — used to show existing items in a collection */
  sources: V5.RequestNode[];
  /** Workspace name shown as the root level in the breadcrumb */
  workspaceName: string;
  onSave: (params: { name: string; collectionId: string; folderId?: string }) => void;
  onCreateCollection: (name: string, section: CollectionSection) => Promise<V5.Collection | null>;
  onCancel: () => void;
}

const CollectionIcon = FolderOpenOutlined;

const SECTION_TITLES: Record<CollectionSection, string> = {
  requests: 'SAVE REQUEST',
  rules: 'SAVE RULE',
  environments: 'SAVE ENVIRONMENT',
  recordings: 'SAVE RECORDING',
};

export function SaveToCollectionModal({
  open,
  section,
  entityName,
  collections,
  sources,
  workspaceName,
  onSave,
  onCreateCollection,
  onCancel,
}: SaveToCollectionModalProps) {
  const { token } = theme.useToken();
  const [name, setName] = useState(entityName);
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const nameInputRef = useRef<InputRef>(null);
  const newCollectionInputRef = useRef<InputRef>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName(entityName);
      setSearch('');
      setSelectedCollectionId(null);
      setSelectedFolderId(undefined);
      setCreatingCollection(false);
      setNewCollectionName('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open, entityName]);

  // Focus new collection/folder input when toggled
  useEffect(() => {
    if (creatingCollection) setTimeout(() => newCollectionInputRef.current?.focus(), 50);
  }, [creatingCollection]);

  // Collection icon (same across all sections)

  // Filter collections by section
  // V5 collections don't have a section field — all passed collections are valid for the current section
  const sectionCollections = collections;

  // Filter by search
  const filter = search.toLowerCase();
  const filteredCollections = useMemo(
    () => (filter ? sectionCollections.filter((c) => c.name.toLowerCase().includes(filter)) : sectionCollections),
    [sectionCollections, filter],
  );

  // Existing items in the selected collection
  const existingItems = useMemo(() => {
    if (!selectedCollectionId || section !== 'requests') return [];
    return sources
      .filter((s) => s.path.startsWith(`requests/${selectedCollectionId}`))
      .map((s) => ({ name: s.name || 'Untitled', method: s.method || 'GET' }));
  }, [selectedCollectionId, sources, section]);

  // Build breadcrumb path
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selectedCollectionId) {
      const col = sectionCollections.find((c) => c.uid === selectedCollectionId);
      if (col) parts.push(col.name);
    }
    return parts;
  }, [selectedCollectionId, sectionCollections]);

  const handleSave = useCallback(() => {
    if (!selectedCollectionId || !name.trim()) return;
    onSave({ name: name.trim(), collectionId: selectedCollectionId, folderId: selectedFolderId });
  }, [name, selectedCollectionId, selectedFolderId, onSave]);

  const handleCreateCollection = useCallback(async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    const col = await onCreateCollection(trimmed, section);
    if (col) {
      setSelectedCollectionId(col.uid);
      setSelectedFolderId(undefined);
      setCreatingCollection(false);
      setNewCollectionName('');
    }
  }, [newCollectionName, section, onCreateCollection]);

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{SECTION_TITLES[section]}</span>}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            style={{ padding: 0, fontSize: 12 }}
            onClick={() => {
              setCreatingCollection(true);
            }}
          >
            New collection
          </Button>
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
              setSelectedFolderId(undefined);
            }
          }}
        >
          {workspaceName}
        </span>
        {breadcrumb[0] && (
          <>
            <span style={{ color: token.colorTextTertiary }}>{' / '}</span>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: breadcrumb nav */}
            <span
              className={selectedFolderId ? 'v5-save-modal-breadcrumb' : undefined}
              style={{
                color: selectedFolderId ? token.colorPrimary : token.colorText,
                cursor: selectedFolderId ? 'pointer' : undefined,
                fontWeight: selectedFolderId ? 400 : 600,
              }}
              onClick={() => {
                if (selectedFolderId) {
                  setSelectedFolderId(undefined);
                }
              }}
            >
              {breadcrumb[0]}
            </span>
          </>
        )}
        {breadcrumb[1] && (
          <>
            <span style={{ color: token.colorTextTertiary }}>{' / '}</span>
            <span style={{ fontWeight: 600 }}>{breadcrumb[1]}</span>
          </>
        )}
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
            <CollectionIcon style={{ fontSize: 12, color: token.colorTextTertiary }} />
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

        {/* Browse: not inside a collection yet */}
        {!selectedCollectionId && (
          <>
            {filteredCollections.length === 0 && !creatingCollection && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, display: 'block', marginBottom: sectionCollections.length === 0 ? 12 : 0 }}
                >
                  {sectionCollections.length === 0 ? 'No collections yet.' : 'No matching collections.'}
                </Text>
                {sectionCollections.length === 0 && (
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
                  setSelectedFolderId(undefined);
                  setSearch('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedCollectionId(col.uid);
                    setSelectedFolderId(undefined);
                    setSearch('');
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <CollectionIcon style={{ fontSize: 13, color: token.colorTextTertiary }} />
                <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>
                <RightOutlined
                  className="v5-save-modal-row-chevron"
                  style={{ fontSize: 10, color: token.colorTextQuaternary }}
                />
              </div>
            ))}
          </>
        )}

        {/* Browse: inside a collection */}
        {selectedCollectionId && (
          <>
            {/* Existing items in current location */}
            {existingItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
              >
                {section === 'requests' && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: METHOD_COLORS[item.method] || '#999',
                      width: 36,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.method}
                  </span>
                )}
                <span>{item.name}</span>
              </div>
            ))}

            {existingItems.length === 0 && (
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
                  This {selectedFolderId ? 'folder' : 'collection'} is empty.
                </Text>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
