/**
 * EditableKVGrid — compact key/value grid for the example editor's
 * captured rows (params, headers, form fields). Deliberately lighter
 * than the request editor's grids: no drag-reorder, no description
 * column, no variable autocomplete — an example documents literal
 * values. Rows toggle (enabled), edit in place, delete, and append;
 * unknown extra fields on a row (uid, hasEquals, …) pass through
 * untouched so editing never strips capture metadata.
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Typography, theme } from 'antd';
import type React from 'react';

const monoFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** Quiet uppercase section caption shared by the editor's halves. */
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography.Text
    type="secondary"
    style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}
  >
    {children}
  </Typography.Text>
);

export interface EditableKVRow {
  key: string;
  value: string;
  enabled?: boolean;
}

interface EditableKVGridProps<Row extends EditableKVRow> {
  rows: readonly Row[];
  onChange: (rows: Row[]) => void;
  /** Factory for an appended row — supplies entity-specific defaults
   *  (fresh uid on request rows; bare `{key, value}` on response
   *  headers, which carry no row identity). */
  makeRow: (key: string, value: string) => Row;
  /** Hide the enabled checkbox for row shapes that have no `enabled`
   *  semantic (response headers). */
  toggleable?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

function EditableKVGrid<Row extends EditableKVRow>({
  rows,
  onChange,
  makeRow,
  toggleable = true,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: EditableKVGridProps<Row>): React.ReactElement {
  const { token } = theme.useToken();

  const patchRow = (index: number, patch: Partial<EditableKVRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const cellInput: React.CSSProperties = { ...monoFont, border: 'none', background: 'transparent', borderRadius: 0 };

  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}>
      {rows.map((row, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled positional rows; response headers carry no row identity
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: toggleable
              ? '24px minmax(140px, 1fr) 2fr 28px'
              : 'minmax(140px, 1fr) 2fr 28px',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            opacity: row.enabled === false ? 0.5 : 1,
          }}
        >
          {toggleable && (
            <Checkbox
              checked={row.enabled !== false}
              onChange={(e) => patchRow(i, { enabled: e.target.checked })}
              style={{ justifySelf: 'center' }}
            />
          )}
          <Input
            size="small"
            variant="borderless"
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => patchRow(i, { key: e.target.value })}
            style={{ ...cellInput, fontWeight: 600 }}
          />
          <Input
            size="small"
            variant="borderless"
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => patchRow(i, { value: e.target.value })}
            style={{ ...cellInput, borderLeft: `1px solid ${token.colorBorderSecondary}` }}
          />
          <Button
            size="small"
            type="text"
            icon={<DeleteOutlined style={{ fontSize: 11 }} />}
            aria-label="Delete row"
            onClick={() => removeRow(i)}
          />
        </div>
      ))}
      <Button
        size="small"
        type="text"
        icon={<PlusOutlined style={{ fontSize: 10 }} />}
        onClick={() => onChange([...rows, makeRow('', '')])}
        style={{ fontSize: 11, color: token.colorTextTertiary, margin: 2 }}
      >
        Add row
      </Button>
    </div>
  );
}

export default EditableKVGrid;
