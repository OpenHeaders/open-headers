/**
 * ParamsTab — Query Params editor. A three-column key/value/description
 * table, appended to the request URL as `?k=v` pairs by the executor.
 *
 * The whole surface (layout, ghost row, drag, checkbox, Bulk Edit
 * toggle, column-visibility menu) is the shared `KeyValueTable`; this
 * wrapper only supplies the Params-specific bulk-edit format
 * (`key:value` lines; `//` disables, ` # …` trailing description).
 */

import { Typography } from 'antd';
import type React from 'react';
import { REQUEST_PATHS } from '@/shared/awareness';
import KeyValueTable, {
  type KeyValueRow,
  type KeyValueRowConflictBridge,
  makeKvRow,
} from './KeyValueTable';

const { Text } = Typography;

interface ParamsTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  /** Inline conflict chips for param cells + set-remove rows. */
  conflictBridge?: KeyValueRowConflictBridge;
}

function rowsToText(rows: KeyValueRow[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled ? '' : '//';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}:${r.value}${note}`;
    })
    .join('\n');
}

function textToRows(text: string): KeyValueRow[] {
  const out: KeyValueRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const [key, ...rest] = noteless.split(':');
    out.push(makeKvRow({ key: key?.trim() ?? '', value: rest.join(':').trim(), description, enabled }));
  }
  return out;
}

const PARAMS_BULK_PLACEHOLDER = 'param1:value1\nparam2:value2 # description\n//disabled:value';

/** Any row the user has given a value to gets `hasEquals: true` so
 *  the URL field renders `?key=` instead of `?key` — if they later
 *  clear the value, the `=` stays (matches intuition: "I made a k/v
 *  pair, the `=` belongs here"). Headers / form tabs don't need this
 *  so the annotation lives here, not in the shared `KeyValueTable`. */
function annotateHasEquals(rows: KeyValueRow[]): KeyValueRow[] {
  return rows.map((r) => (r.value !== '' && !r.hasEquals ? { ...r, hasEquals: true } : r));
}

const ParamsTab: React.FC<ParamsTabProps> = ({ rows, onChange, conflictBridge }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Text strong style={{ fontSize: 13 }}>
        Query Params
      </Text>
      <KeyValueTable
        rows={rows}
        onChange={(next) => onChange(annotateHasEquals(next))}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        bulkEdit={{
          serialize: rowsToText,
          parse: textToRows,
          placeholder: PARAMS_BULK_PLACEHOLDER,
        }}
        rowPath={(uid, leaf) => REQUEST_PATHS.param(uid, leaf)}
        conflictBridge={conflictBridge}
      />
    </div>
  );
};

export default ParamsTab;
