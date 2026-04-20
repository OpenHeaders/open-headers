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
 * `suggestionRows` renders above the user-editable rows. Suggestions
 * are read-only informational entries (e.g. the browser-managed
 * auto-generated headers) that carry an enable checkbox the user
 * can un-check + an info-icon right-aligned on the Key cell with a
 * tooltip explaining the row. Key + Value display as static text —
 * suggestion values can't be edited from here; the user authors
 * their own override in the editable rows below.
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

export interface SuggestionRow {
  key: string;
  value: string;
  /** Tooltip body shown under the info icon on the Key cell. */
  hint?: string;
  /** Current enable state — toggled by the row's checkbox. */
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /**
   * Suggestion rows rendered above the user-editable ones. Read-only
   * keys/values with a toggleable checkbox + info tooltip on the Key
   * cell. Useful for surfacing browser-managed auto-generated headers.
   */
  suggestionRows?: SuggestionRow[];
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
  suggestionRows = [],
  hideEnabled = false,
}) => {
  const { token } = theme.useToken();

  const effectiveRows = useMemo(() => {
    const last = rows[rows.length - 1];
    if (!last || last.key || last.value || last.description) {
      return [...rows, makeKvRow()];
    }
    return rows;
  }, [rows]);

  const update = (uid: string, patch: Partial<KeyValueRow>) => {
    const next = effectiveRows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
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
        overflow: 'visible',
      }}
    >
      {/* Header row — sticky to the parent scroll container so Key /
          Value / Description labels stay visible while the table body
          scrolls under them. */}
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
          position: 'sticky',
          top: 0,
          zIndex: 2,
          boxShadow: `0 1px 0 ${token.colorBorderSecondary}`,
        }}
      >
        {!hideEnabled && <span />}
        <span style={{ padding: '6px 10px' }}>Key</span>
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Value</span>
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Description</span>
        <span />
      </div>

      {/* Suggestion rows (read-only, toggleable) */}
      {suggestionRows.map((s) => (
        <div
          key={`suggestion:${s.key}`}
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillAlter,
          }}
        >
          {!hideEnabled && (
            <span style={{ textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => s.onToggle(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
            </span>
          )}
          <span
            style={{
              ...cellFont,
              padding: '6px 10px',
              color: s.enabled ? token.colorText : token.colorTextQuaternary,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.key}
            </span>
            {s.hint && (
              <Tooltip title={s.hint}>
                <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 12, cursor: 'help' }} />
              </Tooltip>
            )}
          </span>
          <span
            style={{
              ...cellFont,
              padding: '6px 10px',
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              color: s.enabled ? token.colorTextSecondary : token.colorTextQuaternary,
              fontStyle: 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {s.value}
          </span>
          <span
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              color: token.colorTextTertiary,
            }}
          />
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
