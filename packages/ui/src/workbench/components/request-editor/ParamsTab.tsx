/**
 * ParamsTab — Query Params editor. A three-column key/value/description
 * table, appended to the request URL as `?k=v` pairs by the executor.
 *
 * The whole surface (layout, ghost row, drag, checkbox, Bulk Edit
 * toggle, column-visibility menu) is the shared `KeyValueTable`; this
 * wrapper only supplies the Params-specific bulk-edit format
 * (`key:value` lines; `//` disables, ` # …` trailing description).
 */

import type { AuthConfig } from '@openheaders/core/types';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import { previewAuthContributions } from './auth-preview';
import KeyValueTable, {
  type KeyValueRow,
  type KeyValueRowConflictBridge,
  makeKvRow,
  type SuggestionRow,
} from './KeyValueTable';

interface ParamsTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  /** Drives the auth-derived query-param preview (API Key / OAuth 2.0
   *  configured to send the credential on the URL). */
  auth: AuthConfig;
  /** Writes back auth edits made from this table — the auth row's
   *  checkbox (suspend/resume via `auth.disabled`) and inline edits of
   *  a query-borne API-key value. */
  onAuthChange: (auth: AuthConfig) => void;
  /** Jump to the Authorization tab from the generated credential row. */
  onNavigateTab?: (tab: 'authorization') => void;
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

const ParamsTab: React.FC<ParamsTabProps> = ({ rows, onChange, auth, onAuthChange, onNavigateTab, conflictBridge }) => {
  const t = useT();
  // Always-visible preview rows for an auth credential that rides on
  // the URL (API Key → Query Params, OAuth 2.0 → Request URL). Unlike
  // Headers there are no browser-managed auto-params to hide, so the
  // auth row shows directly — no Show/Hide toggle. Live, not locked:
  // the checkbox suspends/resumes the auth contribution
  // (`auth.disabled`), and a query-borne API-key value is editable
  // inline, two-way bound to the auth config. OAuth 2.0's runtime
  // token stays a read-only placeholder.
  const authParams = useMemo(() => previewAuthContributions(auth, t).params, [auth, t]);
  const authRowToggle = (next: boolean) => onAuthChange({ ...auth, disabled: next ? undefined : true });
  const suggestions: SuggestionRow[] = authParams.map((p) => {
    const row: SuggestionRow = {
      key: p.key,
      value: p.value,
      hint: p.hint,
      enabled: !auth.disabled,
      onToggle: authRowToggle,
      action: onNavigateTab
        ? { label: t('workbench.editors.request.goToAuthorization'), onClick: () => onNavigateTab('authorization') }
        : undefined,
    };
    if (auth.type === 'api-key' && auth.in === 'query') {
      row.value = auth.value;
      row.editableValue = {
        secret: true,
        onChange: (next) => onAuthChange({ ...auth, value: next }),
      };
    }
    return row;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <KeyValueTable
        rows={rows}
        onChange={(next) => onChange(annotateHasEquals(next))}
        suggestionRows={suggestions}
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
