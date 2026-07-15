/**
 * CollectionPickerPanel — the app-standard "pick a collection" surface,
 * visually matched to the Save modal's browser: a search input above a
 * bordered, keyboard-navigable list of collections.
 *
 * Selection semantics differ from the Save browser (which drills INTO a
 * collection to reach folders): here a row click/Enter SELECTS the
 * collection as the target. A pinned "New collection" row carries the
 * never-block-on-structure contract — it is always visible (search never
 * filters it out) and callers preselect it when the workspace has no
 * collections, so the flow can proceed with an auto-created collection.
 */

import { CheckOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import type { Collection } from '@openheaders/core/types';
import { Input, type InputRef, Typography, theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import type React from 'react';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

/** Sentinel value for the "create a new collection on import" row. */
export const NEW_COLLECTION_VALUE = '__oh-new-collection__';

const NEW_ROW_ID = 'new-collection';

export interface CollectionPickerPanelProps {
  collections: Collection[];
  /** Selected collection uid or {@link NEW_COLLECTION_VALUE}. */
  value: string | null;
  onChange: (id: string) => void;
  /** Name the auto-created collection gets — shown on the pinned row. */
  newCollectionName: string;
  /** List panel height bounds — dense host modals pass smaller values. */
  listMaxHeight?: number;
  listMinHeight?: number;
  /** Fired when Enter lands on the row that is ALREADY selected — the
   *  host's confirm action, so Enter-Enter walks select → import. */
  onConfirm?: () => void;
}

export interface CollectionPickerHandle {
  /** Focus the search input, so hosts can route keyboard flows here. */
  focusSearch: () => void;
}

const CollectionPickerPanel = forwardRef<CollectionPickerHandle, CollectionPickerPanelProps>(function CollectionPickerPanel(
  { collections, value, onChange, newCollectionName, listMaxHeight = 180, listMinHeight = 120, onConfirm },
  ref,
) {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<InputRef>(null);

  useImperativeHandle(ref, () => ({ focusSearch: () => searchInputRef.current?.focus() }), []);

  const filter = search.trim().toLowerCase();
  const filteredCollections = useMemo(
    () => (filter ? collections.filter((c) => c.name.toLowerCase().includes(filter)) : collections),
    [collections, filter],
  );

  // Keyboard-navigable rows: filtered collections + the pinned new-collection row.
  const rowIds = useMemo(() => [...filteredCollections.map((c) => `col-${c.uid}`), NEW_ROW_ID], [filteredCollections]);

  const selectedRowId = value === NEW_COLLECTION_VALUE ? NEW_ROW_ID : value ? `col-${value}` : null;
  const focusValid = focusedId != null && rowIds.includes(focusedId);
  const effectiveFocusId = focusValid
    ? focusedId
    : selectedRowId && rowIds.includes(selectedRowId)
      ? selectedRowId
      : (rowIds[0] ?? null);

  const scrollToId = useCallback((id: string) => {
    setTimeout(() => {
      listRef.current?.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, []);

  const selectRow = useCallback(
    (rowId: string) => {
      if (rowId === NEW_ROW_ID) {
        onChange(NEW_COLLECTION_VALUE);
        return;
      }
      onChange(rowId.slice('col-'.length));
    },
    [onChange],
  );

  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (rowIds.length === 0) return;
        e.preventDefault();
        const cur = rowIds.indexOf(effectiveFocusId ?? '');
        const next =
          e.key === 'ArrowDown' ? (cur < rowIds.length - 1 ? cur + 1 : 0) : cur > 0 ? cur - 1 : rowIds.length - 1;
        setFocusedId(rowIds[next]);
        scrollToId(rowIds[next]);
        return;
      }
      if (e.key === 'Enter' && effectiveFocusId) {
        e.preventDefault();
        const wasSelected = effectiveFocusId === selectedRowId;
        selectRow(effectiveFocusId);
        if (wasSelected) onConfirm?.();
      }
    },
    [rowIds, effectiveFocusId, selectedRowId, scrollToId, selectRow, onConfirm],
  );

  return (
    <div>
      <Input
        ref={searchInputRef}
        placeholder={t('workbench.collectionPicker.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleNavKeyDown}
        size="small"
        allowClear
        style={{ marginBottom: 8, fontSize: 12 }}
        prefix={<span style={{ color: token.colorTextQuaternary, fontSize: 10 }}>=</span>}
      />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled at search input + container onKeyDown */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: container hosts keyboard nav for its rows */}
      <div
        ref={listRef}
        onKeyDown={handleNavKeyDown}
        tabIndex={-1}
        role="listbox"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 6,
          maxHeight: listMaxHeight,
          minHeight: listMinHeight,
          overflowY: 'auto', overscrollBehavior: 'none',
          background: token.colorBgContainer,
          outline: 'none',
        }}
      >
        {collections.length === 0 && (
          <div style={{ padding: '14px 12px 6px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.collectionPicker.empty')}
            </Text>
          </div>
        )}
        {collections.length > 0 && filteredCollections.length === 0 && (
          <div style={{ padding: '14px 12px 6px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.collectionPicker.noMatch')}
            </Text>
          </div>
        )}
        {filteredCollections.map((col) => {
          const rowId = `col-${col.uid}`;
          return renderRow({
            rowId,
            key: col.uid,
            icon: <FolderOpenOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />,
            label: <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>,
            isFocused: rowId === effectiveFocusId,
            isSelected: rowId === selectedRowId,
            token,
            onClick: () => selectRow(rowId),
            setFocusedId,
          });
        })}
        {renderRow({
          rowId: NEW_ROW_ID,
          key: NEW_ROW_ID,
          icon: <PlusOutlined style={{ fontSize: 12, color: token.colorPrimary }} />,
          label: (
            <span style={{ flex: 1 }}>
              <span style={{ color: token.colorPrimary }}>{t('workbench.collectionPicker.newCollection')}</span>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                “{newCollectionName}”
              </Text>
            </span>
          ),
          isFocused: NEW_ROW_ID === effectiveFocusId,
          isSelected: NEW_ROW_ID === selectedRowId,
          token,
          onClick: () => selectRow(NEW_ROW_ID),
          setFocusedId,
        })}
      </div>
    </div>
  );
});

interface RowRenderOptions {
  rowId: string;
  key: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  isFocused: boolean;
  isSelected: boolean;
  token: GlobalToken;
  onClick: () => void;
  setFocusedId: (id: string | null) => void;
}

function renderRow({ rowId, key, icon, label, isFocused, isSelected, token, onClick, setFocusedId }: RowRenderOptions) {
  return (
    <div
      key={key}
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
      onClick={onClick}
      onMouseEnter={(e) => {
        setFocusedId(rowId);
        if (!isFocused) (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
      }}
      onMouseLeave={(e) => {
        if (!isFocused) (e.currentTarget as HTMLElement).style.background = '';
      }}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
    >
      {icon}
      {label}
      {isSelected && <CheckOutlined style={{ fontSize: 11, color: token.colorPrimary }} />}
    </div>
  );
}

export default CollectionPickerPanel;
