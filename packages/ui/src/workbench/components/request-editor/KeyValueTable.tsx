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
import { TEMPLATE_INPUT_LINE_HEIGHT, TemplateInput } from '../template-input';
import {
  type BulkEditConfig,
  EditableGridTable,
  type EditableRowAdapter,
  type KeyValueRowConflictBridge,
  type SuggestionRow,
} from './EditableGridTable';

export type { KeyValueRowConflictBridge, SuggestionRow };

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
  /** Inline conflict bridge — forwarded to `EditableGridTable` so each
   *  cell can render a `<ConflictDiffChip>` and a per-row
   *  `<SetRowConflictChip>` driven by the entity-level tracker. */
  conflictBridge?: KeyValueRowConflictBridge;
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

// Center the collapsed single line inside the 32px cell with symmetric
// padding. Padding (unlike a taller line-height) keeps the line box
// metrics identical between the collapsed and focus-expanded states, so
// the text doesn't shift vertically when a click expands the row.
const CELL_LINE_PX = 12 * TEMPLATE_INPUT_LINE_HEIGHT;
const CELL_VERTICAL_PADDING = (32 - CELL_LINE_PX) / 2;

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  suggestionRows,
  hideEnabled = false,
  bulkEdit,
  rowPath,
  conflictBridge,
}) => {
  const { token } = theme.useToken();

  // Every cell (Key / Value / Description) is the same rich field: a
  // borderless `TemplateInput` with `{{ref}}` highlighting that shows an
  // ellipsis when idle and expands to a word-wrapped, auto-growing
  // editor on focus (`expandOnFocus`) — so long values are editable
  // without a horizontal scrollbar. They differ only by which field
  // they read/write + the placeholder.
  const cellRenderer =
    (
      get: (r: KeyValueRow) => string,
      set: (r: KeyValueRow, v: string) => KeyValueRow,
      placeholder: string,
      // Key + Value resolve `{{vars}}` (flag a missing one); Description
      // is plain metadata, so it never flags.
      flagUnresolved: boolean,
    ) =>
    (
      row: KeyValueRow,
      update: (next: KeyValueRow) => void,
      ctx: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
    ) => (
      <TemplateInput
        variant="borderless"
        expandOnFocus
        expanded={ctx.expanded}
        flagUnresolved={flagUnresolved}
        value={get(row)}
        placeholder={placeholder}
        onChange={(next) => update(set(row, next))}
        style={{
          ...cellFont,
          flex: 1,
          padding: `${CELL_VERTICAL_PADDING}px 6px`,
          color: ctx.dim ? token.colorTextQuaternary : token.colorText,
        }}
      />
    );

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
      conflictBridge={conflictBridge}
      renderKeyCell={cellRenderer(
        (r) => r.key,
        (r, v) => ({ ...r, key: v }),
        keyPlaceholder,
        true,
      )}
      renderValueCell={cellRenderer(
        (r) => r.value,
        (r, v) => ({ ...r, value: v }),
        valuePlaceholder,
        true,
      )}
      renderDescriptionCell={cellRenderer(
        (r) => r.description ?? '',
        (r, v) => ({ ...r, description: v }),
        'Description',
        false,
      )}
    />
  );
};

export default KeyValueTable;
