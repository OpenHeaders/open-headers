/**
 * ParamsTab — the request's two parameter tables.
 *
 * Query Params: a three-column key/value/description table, appended
 * to the request URL as `?k=v` pairs by the executor. The whole
 * surface (layout, ghost row, drag, checkbox, Bulk Edit toggle,
 * column-visibility menu) is the shared `KeyValueTable`; this wrapper
 * only supplies the Params-specific bulk-edit format (`key:value`
 * lines; `//` disables, ` # …` trailing description).
 *
 * Path Parameters: the rows the URL's `/:name` segments name, DERIVED
 * from the URL (typing `:x` adds a row, removing the segment removes
 * it — see `derivePathParamRows`), on the same shell under
 * `lockedKeys`: the key is read-only, the value a template field, a
 * description beside it; no ghost row, no checkbox, no drag. A row
 * without a value names itself under the table — the send gate's
 * `path-param-missing` reason, which the executors refuse by the same
 * list — and an empty URL says how to add one.
 */

import type { AuthConfig } from '@openheaders/core/types';
import { missingPathParamKeys } from '@openheaders/core/utils';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import { previewAuthContributions, previewedAuth } from './auth-preview';
import { type InheritedAuthAttribution, inheritSourceLabel } from './inherited-auth';
import KeyValueTable, {
  type KeyValueRow,
  type KeyValueRowConflictBridge,
  makeKvRow,
  type SuggestionRow,
} from './KeyValueTable';

const { Text } = Typography;

interface ParamsTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  /** The Path Parameters rows — derived from `url`, edited here. */
  pathRows: KeyValueRow[];
  onPathChange: (rows: KeyValueRow[]) => void;
  /** The draft URL (query split off) — names the path parameters the
   *  missing-value line reports through the one core list. */
  url: string;
  /** Drives the auth-derived query-param preview (API Key / OAuth 2.0
   *  configured to send the credential on the URL). */
  auth: AuthConfig;
  /** What Inherit resolves to — the preview row describes that entry. */
  inheritedFrom?: InheritedAuthAttribution;
  /** Jump to the Authorization tab from the generated credential row. */
  onNavigateTab?: (tab: 'authorization') => void;
  /** Inline conflict chips for param cells + set-remove rows. */
  conflictBridge?: KeyValueRowConflictBridge;
  /** The same, for the Path Parameters rows. */
  pathConflictBridge?: KeyValueRowConflictBridge;
}

export function paramRowsToText(rows: KeyValueRow[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled ? '' : '//';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}:${r.value}${note}`;
    })
    .join('\n');
}

export function paramTextToRows(text: string): KeyValueRow[] {
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

export const PARAMS_BULK_PLACEHOLDER = 'param1:value1\nparam2:value2 # description\n//disabled:value';

/** Any row the user has given a value to gets `hasEquals: true` so
 *  the URL field renders `?key=` instead of `?key` — if they later
 *  clear the value, the `=` stays (matches intuition: "I made a k/v
 *  pair, the `=` belongs here"). Headers / form tabs don't need this
 *  so the annotation lives here, not in the shared `KeyValueTable`. */
export function annotateHasEquals(rows: KeyValueRow[]): KeyValueRow[] {
  return rows.map((r) => (r.value !== '' && !r.hasEquals ? { ...r, hasEquals: true } : r));
}

/** The small uppercase caption over each table — the Body tab's
 *  section-title idiom. */
const SectionTitle: React.FC<{ children: string }> = ({ children }) => {
  const { token } = theme.useToken();
  return (
    <Text
      strong
      style={{ fontSize: 11, letterSpacing: 0.5, color: token.colorTextSecondary, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
};

const ParamsTab: React.FC<ParamsTabProps> = ({
  rows,
  onChange,
  pathRows,
  onPathChange,
  url,
  auth,
  inheritedFrom,
  onNavigateTab,
  conflictBridge,
  pathConflictBridge,
}) => {
  const t = useT();
  // The gate's own list — a blank value on a parameter the URL names.
  const missingPathParams = useMemo(() => missingPathParamKeys(url, pathRows), [url, pathRows]);
  // Always-visible preview rows for an auth credential that rides on
  // the URL (API Key → Query Params, OAuth 2.0 → Request URL). Unlike
  // Headers there are no browser-managed auto-params to hide, so the
  // auth row shows directly — no Show/Hide toggle. LOCKED like the
  // Headers row: greyed check, placeholder value; enabling, disabling
  // and editing live on the Authorization tab.
  const effective = useMemo(() => previewedAuth(auth, inheritedFrom), [auth, inheritedFrom]);
  const inherited = auth.type === 'inherit';
  const authParams = useMemo(() => {
    if (effective === null) return [];
    const source = inherited && inheritedFrom?.source ? inheritSourceLabel(t, inheritedFrom.source) : null;
    return previewAuthContributions(effective, t).params.map((p) =>
      source === null
        ? p
        : { ...p, hint: `${p.hint} ${t('workbench.editors.request.authPreview.inheritedFrom', { source })}` },
    );
  }, [effective, inherited, inheritedFrom, t]);
  const suggestions: SuggestionRow[] = authParams.map((p) => ({
    key: p.key,
    value: p.value,
    hint: p.hint,
    enabled: auth.disabled !== true,
    action: onNavigateTab
      ? { label: t('workbench.editors.request.goToAuthorization'), onClick: () => onNavigateTab('authorization') }
      : undefined,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionTitle>{t('workbench.editors.request.params.queryHeading')}</SectionTitle>
      <KeyValueTable
        rows={rows}
        onChange={(next) => onChange(annotateHasEquals(next))}
        suggestionRows={suggestions}
        bulkEdit={{
          serialize: paramRowsToText,
          parse: paramTextToRows,
          placeholder: PARAMS_BULK_PLACEHOLDER,
        }}
        rowPath={(uid, leaf) => REQUEST_PATHS.param(uid, leaf)}
        conflictBridge={conflictBridge}
      />
      <SectionTitle>{t('workbench.editors.request.params.pathHeading')}</SectionTitle>
      {pathRows.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="oh-path-params-empty">
          {t('workbench.editors.request.params.pathEmpty')}
        </Text>
      ) : (
        <KeyValueTable
          rows={pathRows}
          onChange={onPathChange}
          hideEnabled
          lockedKeys
          rowPath={(uid, leaf) => REQUEST_PATHS.pathParam(uid, leaf)}
          conflictBridge={pathConflictBridge}
        />
      )}
      {missingPathParams.length > 0 && (
        <Text type="danger" style={{ fontSize: 12 }} data-testid="oh-path-params-missing">
          {t('workbench.editors.request.params.pathMissing', {
            keys: missingPathParams.map((key) => `:${key}`).join(', '),
          })}
        </Text>
      )}
    </div>
  );
};

export default ParamsTab;
