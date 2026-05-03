/**
 * KeyValueTable — flat key/value/description editor backed by the
 * shared `EditableGridTable` shell. Every "list of named rows" table
 * in the extension goes through `EditableGridTable`; this wrapper
 * supplies the row shape + adapters for plain text values (Params,
 * Headers). Form-data uses the same shell with a custom Value cell
 * that switches between a text input and a file picker (see
 * `MultipartEditor`).
 *
 * Public surface kept stable so existing callers (ParamsTab /
 * HeadersTab) don't have to change.
 */

import { generateUid } from '@openheaders/core/utils';
import { theme } from 'antd';
import type React from 'react';
import { TemplateInput } from '../template-input';
import {
  type BulkEditConfig,
  EditableGridTable,
  type EditableRowAdapter,
  type SuggestionRow,
} from './EditableGridTable';

export type { SuggestionRow };

export interface KeyValueRow {
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
  /** Carries the `?key=` vs `?key` distinction when this row came
   *  from URL parsing. See `@openheaders/core/utils/url` —
   *  `QueryParam.hasEquals` — for the semantics. Unused by rows that
   *  aren't URL-derived (headers, form fields). */
  hasEquals?: boolean;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  suggestionRows?: SuggestionRow[];
  /** When true, hides the leading checkbox column. */
  hideEnabled?: boolean;
  /** Enable Bulk Edit mode with a caller-supplied serialize / parse
   *  pair — Params uses `key:value` lines, Headers uses `key: value`,
   *  form-urlencoded uses `key=value`. Absent → no Bulk Edit toggle. */
  bulkEdit?: BulkEditConfig<KeyValueRow>;
  /** Optional per-cell awareness path (forwarded to
   *  `EditableGridTable.rowPath`). Caller composes the canonical
   *  schema-aligned path string per row index + leaf. */
  rowPath?: (rowId: string, leaf: 'key' | 'value' | 'description') => string;
}

/**
 * Row uid is the persisted itemId in `RequestHeaderSchema` /
 * `QueryParamSchema` — the sync engine keys set members by it for LWW
 * (§7.2) and `moveBefore` (§7.3 fractional indexing). Minted via the
 * shared 8-char-hex `generateUid()` so the editor and import pipelines
 * agree on row identity from creation onward; round-tripping a row
 * through save preserves it.
 */
export const makeKvRow = (overrides: Partial<KeyValueRow> = {}): KeyValueRow => ({
  uid: generateUid(),
  key: '',
  value: '',
  description: '',
  enabled: true,
  ...overrides,
});

const KV_ADAPTER: EditableRowAdapter<KeyValueRow> = {
  getId: (r) => r.uid,
  getEnabled: (r) => r.enabled,
  setEnabled: (r, v) => ({ ...r, enabled: v }),
  getKey: (r) => r.key,
  setKey: (r, v) => ({ ...r, key: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => makeKvRow(),
  isEmpty: (r) => !r.key && !r.value && !r.description,
};

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  suggestionRows,
  hideEnabled = false,
  bulkEdit,
  rowPath,
}) => {
  const { token } = theme.useToken();

  return (
    <EditableGridTable<KeyValueRow>
      rows={rows}
      onChange={onChange}
      adapter={KV_ADAPTER}
      keyPlaceholder={keyPlaceholder}
      hideEnabled={hideEnabled}
      suggestionRows={suggestionRows}
      bulkEdit={bulkEdit}
      rowPath={rowPath}
      renderValueCell={(row, update, ctx) => (
        <TemplateInput
          variant="borderless"
          value={row.value}
          placeholder={valuePlaceholder}
          onChange={(next) => update({ ...row, value: next })}
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

export default KeyValueTable;
