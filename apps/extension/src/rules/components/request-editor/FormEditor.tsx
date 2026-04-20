/**
 * FormEditor — `application/x-www-form-urlencoded` body editor.
 * Shares the same `EditableGridTable` shell as Params / Headers /
 * form-data so all four surfaces carry the same row chrome, drag +
 * delete hover behavior, and sticky header.
 *
 * Storage model: the body carries `formParts: FormField[]` (structured
 * rows with per-row enabled + description) alongside the legacy
 * `content` string. The executor prefers `formParts` when present —
 * disabled rows stay on disk but aren't sent, and `description` is
 * UI-only metadata that round-trips through YAML. Callers that only
 * have the raw encoded string (legacy importers) can still produce a
 * valid form body by populating `content`; the executor falls back.
 */

import type { V5 } from '@openheaders/core/types';
import { Input, theme } from 'antd';
import type React from 'react';
import { useRef } from 'react';
import { EditableGridTable, type EditableRowAdapter } from './EditableGridTable';

interface FormEditorProps {
  fields: V5.FormField[];
  onChange: (fields: V5.FormField[]) => void;
}

// Transient id for drag-stable reorder + in-place edits. The persisted
// shape has no `uid` — form fields are positional.
let rowIdCounter = 0;
const nextRowId = (): string => `ff-${++rowIdCounter}`;

type IdentifiedField = V5.FormField & { __id: string };

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const ADAPTER: EditableRowAdapter<IdentifiedField> = {
  getId: (r) => r.__id,
  getEnabled: (r) => r.enabled !== false,
  setEnabled: (r, v) => ({ ...r, enabled: v }),
  getKey: (r) => r.key,
  setKey: (r, v) => ({ ...r, key: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ __id: nextRowId(), key: '', value: '', description: '', enabled: true }),
  isEmpty: (r) => r.key === '' && r.value === '' && (r.description ?? '') === '',
};

function stripId(row: IdentifiedField): V5.FormField {
  const { __id: _id, ...field } = row;
  return field;
}

function fieldsToText(rows: IdentifiedField[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled === false ? '//' : '';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}=${r.value}${note}`;
    })
    .join('\n');
}

function textToFields(text: string): IdentifiedField[] {
  const out: IdentifiedField[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const eqIdx = noteless.indexOf('=');
    const key = eqIdx >= 0 ? noteless.slice(0, eqIdx) : noteless;
    const value = eqIdx >= 0 ? noteless.slice(eqIdx + 1) : '';
    out.push({ __id: nextRowId(), key: key.trim(), value, description, enabled });
  }
  return out;
}

const FormEditor: React.FC<FormEditorProps> = ({ fields, onChange }) => {
  const { token } = theme.useToken();

  // Hydrate transient ids. `idsRef` preserves ids across re-renders so
  // drag reorders + in-place edits don't remount the underlying row
  // controls. The persisted shape is positional, so matching by index
  // is correct.
  const idsRef = useRef<string[]>([]);
  if (idsRef.current.length !== fields.length) {
    idsRef.current = fields.map((_, i) => idsRef.current[i] ?? nextRowId());
  }
  const rows: IdentifiedField[] = fields.map((f, i) => ({ ...f, __id: idsRef.current[i] }));

  const handleChange = (next: IdentifiedField[]) => {
    idsRef.current = next.map((r) => r.__id);
    onChange(next.map(stripId));
  };

  return (
    <EditableGridTable<IdentifiedField>
      rows={rows}
      onChange={handleChange}
      adapter={ADAPTER}
      bulkEdit={{
        serialize: fieldsToText,
        parse: textToFields,
        placeholder: 'key1=value1\nkey2=value2 # description\n//disabled=value',
      }}
      renderValueCell={(row, update, ctx) => (
        <Input
          variant="borderless"
          value={row.value}
          placeholder="Value"
          onChange={(e) => update({ ...row, value: e.target.value })}
          style={{
            ...cellFont,
            flex: 1,
            padding: '4px 6px',
            color: ctx.dim ? token.colorTextQuaternary : token.colorText,
          }}
        />
      )}
    />
  );
};

export default FormEditor;
