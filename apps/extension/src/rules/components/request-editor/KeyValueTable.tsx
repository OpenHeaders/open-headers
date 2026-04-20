/**
 * KeyValueTable — three-column (Key / Value / Description) editable
 * grid used by the Params tab and the Headers tab. A persistent empty
 * row at the bottom lets users add without an explicit "add" button;
 * the row materializes as soon as the user types into any cell and a
 * fresh placeholder appears below.
 *
 * Each row has:
 *   • A leading checkbox (enable / disable) — disabled on the
 *     placeholder row so the user can't check a blank row.
 *   • Three text inputs (Key, Value, Description).
 *   • A trailing delete button (hidden on the placeholder row).
 *
 * `readOnlyRows` renders above the user-editable ones and carries
 * auto-managed entries (browser-supplied headers). They show the same
 * three-column layout but without checkboxes or delete affordance;
 * an `info` tooltip surfaces the per-entry rationale when the user
 * hovers the key cell.
 */

import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

export interface KeyValueRow {
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface ReadOnlyKeyValueRow {
  key: string;
  value: string;
  /** Shown in the info-tooltip on hover. */
  hint?: string;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  readOnlyRows?: ReadOnlyKeyValueRow[];
  /** When true, hides the leading checkbox column. */
  hideEnabled?: boolean;
}

let ROW_ID_COUNTER = 0;
const nextUid = (): string => `kv-${++ROW_ID_COUNTER}`;

export const makeKvRow = (overrides: Partial<KeyValueRow> = {}): KeyValueRow => ({
  uid: nextUid(),
  key: '',
  value: '',
  description: '',
  enabled: true,
  ...overrides,
});

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  readOnlyRows = [],
  hideEnabled = false,
}) => {
  const { token } = theme.useToken();

  const effectiveRows = useMemo(() => {
    // Ensure there is always exactly one trailing empty row so the
    // user can add without hunting for a button.
    const last = rows[rows.length - 1];
    if (!last || last.key || last.value || last.description) {
      return [...rows, makeKvRow()];
    }
    return rows;
  }, [rows]);

  const update = (uid: string, patch: Partial<KeyValueRow>) => {
    const next = effectiveRows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
    // Strip the trailing placeholder so the stored `rows` array stays
    // tight — the derived render re-appends one.
    const tail = next[next.length - 1];
    const tidy = tail && !tail.key && !tail.value && !tail.description ? next.slice(0, -1) : next;
    onChange(tidy);
  };

  const remove = (uid: string) => {
    const next = effectiveRows.filter((r) => r.uid !== uid);
    const tail = next[next.length - 1];
    const tidy = tail && !tail.key && !tail.value && !tail.description ? next.slice(0, -1) : next;
    onChange(tidy);
  };

  const cellFont: React.CSSProperties = {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 12,
  };

  const gridTemplate = hideEnabled
    ? 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) 32px'
    : '28px minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) 32px';

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          background: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 12,
          fontWeight: 500,
          color: token.colorTextSecondary,
        }}
      >
        {!hideEnabled && <span />}
        <span style={{ padding: '6px 10px' }}>Key</span>
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Value</span>
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Description</span>
        <span />
      </div>

      {/* Read-only auto-managed rows */}
      {readOnlyRows.map((r) => (
        <div
          key={`readonly:${r.key}`}
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainerDisabled,
            color: token.colorTextTertiary,
          }}
        >
          {!hideEnabled && (
            <span style={{ textAlign: 'center' }}>
              <Tooltip title="Managed by the browser — cannot be edited">
                <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
              </Tooltip>
            </span>
          )}
          <span style={{ ...cellFont, padding: '6px 10px' }}>{r.key}</span>
          <span
            style={{
              ...cellFont,
              padding: '6px 10px',
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              color: token.colorTextTertiary,
              fontStyle: 'italic',
            }}
          >
            {r.value}
          </span>
          <span
            style={{
              padding: '6px 10px',
              fontSize: 11,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              color: token.colorTextTertiary,
            }}
          >
            {r.hint ?? ''}
          </span>
          <span />
        </div>
      ))}

      {/* Editable rows */}
      {effectiveRows.map((r, i) => {
        const isPlaceholder = i === effectiveRows.length - 1 && !r.key && !r.value && !r.description;
        const dim = !r.enabled || isPlaceholder;
        return (
          <div
            key={r.uid}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              alignItems: 'center',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {!hideEnabled && (
              <span style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  disabled={isPlaceholder}
                  onChange={(e) => update(r.uid, { enabled: e.target.checked })}
                  style={{ width: 14, height: 14, cursor: isPlaceholder ? 'not-allowed' : 'pointer' }}
                />
              </span>
            )}
            <Input
              variant="borderless"
              value={r.key}
              placeholder={keyPlaceholder}
              onChange={(e) => update(r.uid, { key: e.target.value })}
              style={{ ...cellFont, padding: '4px 10px', color: dim ? token.colorTextQuaternary : token.colorText }}
            />
            <Input
              variant="borderless"
              value={r.value}
              placeholder={valuePlaceholder}
              onChange={(e) => update(r.uid, { value: e.target.value })}
              style={{
                ...cellFont,
                padding: '4px 10px',
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
                color: dim ? token.colorTextQuaternary : token.colorText,
              }}
            />
            <Input
              variant="borderless"
              value={r.description ?? ''}
              placeholder="Description"
              onChange={(e) => update(r.uid, { description: e.target.value })}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
                color: dim ? token.colorTextQuaternary : token.colorText,
              }}
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              disabled={isPlaceholder}
              onClick={() => remove(r.uid)}
              style={{ color: token.colorTextTertiary }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default KeyValueTable;
