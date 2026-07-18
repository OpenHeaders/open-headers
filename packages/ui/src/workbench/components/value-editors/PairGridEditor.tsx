/**
 * PairGridEditor — the name/value grid body for pair-shaped detected
 * values (cookie, query-string). A structured VIEW over the decoded
 * line-per-segment text: rows decode from the incoming text, every
 * edit / add / remove / reorder serializes straight back through the
 * pair-grid model and hands the caller the SAME decoded text shape the
 * plain editors emit — the write path stays `encodeDetectedValue`, so
 * an illegal cell surfaces as the codec's cannot-encode state and Save
 * disables, exactly like a bad line in the textarea. Row identity is
 * ephemeral (minted at decode, stable across cell edits and reorder,
 * never persisted). Bare cookie flags (`Secure`) are rows with a null
 * value; typing into their value cell turns them into pairs. Token-
 * styled inline so it renders in both the workbench modal and the
 * panel document tab without surface-specific CSS.
 */

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import {
  decodePairSegments,
  detectValueType,
  encodePairSegments,
  type PairGridType,
  type PairSegment,
} from '@openheaders/ui/shared/value-detection';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { createEditableHistory, type EditableHistory } from '../template-input/editable-history';
import { useValueViewAction } from './useValueViewAction';

const { Text } = Typography;

interface PairGridRow extends PairSegment {
  id: number;
}

interface ColumnKeys {
  name: MessageKey;
  value: MessageKey;
  ariaPairs: MessageKey;
  ariaRowName: MessageKey;
  ariaRowValue: MessageKey;
}

const COLUMN_KEYS: Record<PairGridType, ColumnKeys> = {
  cookie: {
    name: 'shared.valueEditors.grid.name',
    value: 'shared.valueEditors.grid.value',
    ariaPairs: 'shared.valueEditors.grid.ariaNamePairs',
    ariaRowName: 'shared.valueEditors.grid.ariaRowName',
    ariaRowValue: 'shared.valueEditors.grid.ariaRowValue',
  },
  'query-string': {
    name: 'shared.valueEditors.grid.key',
    value: 'shared.valueEditors.grid.value',
    ariaPairs: 'shared.valueEditors.grid.ariaKeyPairs',
    ariaRowName: 'shared.valueEditors.grid.ariaRowKey',
    ariaRowValue: 'shared.valueEditors.grid.ariaRowValue',
  },
};

interface GridCellInputProps {
  value: string;
  onValueChange: (next: string) => void;
  'aria-label': string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  readOnly?: boolean;
}

/** A grid cell input with an owned undo/redo stack (⌘Z / ⌘⇧Z /
 *  Ctrl+Z / Ctrl+Y) over the shared editable-history factory —
 *  controlled inputs lose native undo, and a re-encoding grid must
 *  not. DOM-first (value + caret set before the state sync) so the
 *  controlled re-render can't clobber the caret. */
function GridCellInput({
  value,
  onValueChange,
  'aria-label': ariaLabel,
  placeholder,
  inputRef,
  readOnly,
}: GridCellInputProps) {
  const { token } = theme.useToken();
  const historyRef = useRef<EditableHistory | null>(null);
  if (!historyRef.current) historyRef.current = createEditableHistory(value);
  const history = historyRef.current;
  const pasteBoundaryRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.currentTarget.value;
    history.record(next, e.currentTarget.selectionStart ?? next.length, { boundary: pasteBoundaryRef.current });
    pasteBoundaryRef.current = false;
    onValueChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const key = e.key.toLowerCase();
    if ((isMac ? e.metaKey : e.ctrlKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault();
      e.stopPropagation();
      const entry = key === 'y' || e.shiftKey ? history.redo() : history.undo();
      if (entry) {
        const input = e.currentTarget;
        input.value = entry.text;
        input.setSelectionRange(entry.caret, entry.caret);
        onValueChange(entry.text);
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      readOnly={readOnly}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={() => {
        pasteBoundaryRef.current = true;
      }}
      onSelect={(e) =>
        history.record(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)
      }
      spellCheck={false}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
        color: token.colorText,
        fontFamily: token.fontFamilyCode,
        fontSize: 12,
        lineHeight: 1.5,
        padding: '3px 6px',
        outline: 'none',
      }}
    />
  );
}

/** Nested decode for one pair's value: a cell holding its own detected
 *  value (a JWT cookie, a base64 query param) gets the eye — glance →
 *  read-only viewer, one level deeper than the grid it sits in. Detection
 *  is memoized per cell value; plain cells render nothing. */
function PairValueView({ value }: { value: string | null }) {
  const detected = useMemo(() => (value ? detectValueType(value) : null), [value]);
  const { viewProps, glance, viewerModal } = useValueViewAction(detected);
  if (!('viewTooltip' in viewProps)) return null;
  return (
    <>
      {glance(
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          title={viewProps.viewTooltip}
          aria-label={viewProps.viewTooltip}
        />,
      )}
      {viewerModal}
    </>
  );
}

interface PairGridEditorProps {
  gridType: PairGridType;
  /** The decoded line-per-segment text — the same buffer the plain
   *  editors edit. */
  value: string;
  onChange: (text: string) => void;
  /** Viewer mode: cells read-only, row actions hidden. */
  readOnly?: boolean;
}

export const PairGridEditor: React.FC<PairGridEditorProps> = ({ gridType, value, onChange, readOnly }) => {
  const { token } = theme.useToken();
  const t = useT();
  const nextIdRef = useRef(0);
  const mintRows = useCallback((segments: PairSegment[]): PairGridRow[] => {
    return segments.map((s) => {
      nextIdRef.current += 1;
      return { ...s, id: nextIdRef.current };
    });
  }, []);

  const [rows, setRows] = useState<PairGridRow[]>(() => mintRows(decodePairSegments(value)));
  // The text this grid last produced (or seeded from) — an incoming
  // value that differs is EXTERNAL movement (canonical adoption,
  // draft discard), and the rows re-derive from it.
  const lastTextRef = useRef(value);
  if (value !== lastTextRef.current) {
    lastTextRef.current = value;
    setRows(mintRows(decodePairSegments(value)));
  }

  const pendingFocusRef = useRef<number | null>(null);
  const focusFreshRow = useCallback(
    (id: number) =>
      (el: HTMLInputElement | null): void => {
        if (el !== null && pendingFocusRef.current === id) {
          pendingFocusRef.current = null;
          el.focus();
        }
      },
    [],
  );

  const commit = useCallback(
    (next: PairGridRow[]): void => {
      setRows(next);
      const text = encodePairSegments(gridType, next);
      // Blank rows serialize away — only push genuinely changed text
      // up so an untouched added row doesn't dirty the draft.
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        onChange(text);
      }
    },
    [gridType, onChange],
  );

  const updateCell = useCallback(
    (id: number, field: 'name' | 'value', text: string): void => {
      commit(rows.map((r) => (r.id === id ? { ...r, [field]: text } : r)));
    },
    [rows, commit],
  );

  const addRow = useCallback((): void => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    pendingFocusRef.current = id;
    commit([...rows, { id, name: '', value: '' }]);
  }, [rows, commit]);

  const removeRow = useCallback(
    (id: number): void => {
      commit(rows.filter((r) => r.id !== id));
    },
    [rows, commit],
  );

  const moveRow = useCallback(
    (id: number, delta: -1 | 1): void => {
      const index = rows.findIndex((r) => r.id === id);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      commit(next);
    },
    [rows, commit],
  );

  const columns = COLUMN_KEYS[gridType];
  const cellLabel = (row: PairGridRow, index: number, column: 'name' | 'value'): string =>
    t(column === 'name' ? columns.ariaRowName : columns.ariaRowValue, { row: index + 1 });

  return (
    <div role="group" aria-label={t(columns.ariaPairs)}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(90px, 1fr) minmax(120px, 1.6fr) auto',
          gap: 4,
          alignItems: 'center',
        }}
      >
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t(columns.name)}
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t(columns.value)}
        </Text>
        <span />
        {rows.map((row, index) => (
          <div key={row.id} style={{ display: 'contents' }}>
            <GridCellInput
              value={row.name}
              onValueChange={(text) => updateCell(row.id, 'name', text)}
              aria-label={cellLabel(row, index, 'name')}
              inputRef={focusFreshRow(row.id)}
              readOnly={readOnly}
            />
            <GridCellInput
              value={row.value ?? ''}
              onValueChange={(text) => updateCell(row.id, 'value', text)}
              aria-label={cellLabel(row, index, 'value')}
              placeholder={row.value === null ? t('shared.valueEditors.grid.flag') : undefined}
              readOnly={readOnly}
            />
            {readOnly ? (
              <span style={{ display: 'inline-flex', gap: 0 }}>
                <PairValueView value={row.value} />
              </span>
            ) : (
              <span style={{ display: 'inline-flex', gap: 0 }}>
                <PairValueView value={row.value} />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  aria-label={t('shared.valueEditors.grid.moveRowUp', { row: index + 1 })}
                  disabled={index === 0}
                  onClick={() => moveRow(row.id, -1)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  aria-label={t('shared.valueEditors.grid.moveRowDown', { row: index + 1 })}
                  disabled={index === rows.length - 1}
                  onClick={() => moveRow(row.id, 1)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={t('shared.valueEditors.grid.deleteRow', { row: index + 1 })}
                  onClick={() => removeRow(row.id)}
                />
              </span>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={addRow}
          style={{ fontSize: 11, padding: 0, height: 'auto', marginTop: 6, color: token.colorTextSecondary }}
        >
          {t('shared.valueEditors.grid.addRow')}
        </Button>
      )}
    </div>
  );
};
