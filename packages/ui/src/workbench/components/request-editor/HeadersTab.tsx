/**
 * HeadersTab — user-defined request headers + an auto-generated
 * section the user can reveal with a Show/Hide toggle. The auto rows
 * surface what the dialing host puts on the wire beyond the user's own
 * rows: a browser host sends the page fetch's Cache-Control / Host /
 * User-Agent / Accept family, a node host (desktop app, server) the
 * undici client's — plus, when the request carries a body, the
 * `Content-Type` + `Content-Length` entries the executor computes from
 * the body itself.
 *
 * Auto rows are read-only text but carry a live checkbox the user
 * can un-check. The checkbox state is local — the runtime decides
 * what actually goes on the wire for these regardless — so the
 * toggle's job is informational / "don't rely on this" signalling.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { AuthConfig, RequestBody } from '@openheaders/core/types';
import { productUserAgent } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import AutoHeadersToggle from './AutoHeadersToggle';
import { previewAuthContributions, previewedAuth } from './auth-preview';
import { type InheritedAuthAttribution, inheritSourceLabel } from './inherited-auth';
import KeyValueTable, {
  type KeyValueRow,
  type KeyValueRowConflictBridge,
  makeKvRow,
  type SuggestionRow,
} from './KeyValueTable';

declare const __APP_VERSION__: string;

function headerRowsToText(rows: KeyValueRow[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled ? '' : '//';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}: ${r.value}${note}`;
    })
    .join('\n');
}

function headerTextToRows(text: string): KeyValueRow[] {
  const out: KeyValueRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const colonIdx = noteless.indexOf(':');
    const key = colonIdx >= 0 ? noteless.slice(0, colonIdx) : noteless;
    const value = colonIdx >= 0 ? noteless.slice(colonIdx + 1).trim() : '';
    out.push(makeKvRow({ key: key.trim(), value, description, enabled }));
  }
  return out;
}

interface AutoHeaderDef {
  key: string;
  /** Literal wire value, or absent when the value is a keyed
   *  descriptive placeholder (`placeholderKey`, defaulting to the
   *  "<calculated when request is sent>" one). */
  value?: string;
  placeholderKey?: MessageKey;
  hintKey: MessageKey;
  /** When true, only include this row when the request has a body. */
  bodyOnly?: boolean;
  /** A user row with the same key actually replaces this value on the
   *  wire — the generated row renders struck through when that happens.
   *  Absent for browser-managed headers the user can't override. */
  overridable?: boolean;
  /** Editor tab that owns the generated value — renders the
   *  hover-revealed "Go to …" jump link on the row. */
  goTo?: 'body';
}

const CONTENT_TYPE: AutoHeaderDef = {
  key: 'Content-Type',
  hintKey: 'workbench.editors.request.headers.hint.contentType',
  bodyOnly: true,
  overridable: true,
  goTo: 'body',
};
const CONTENT_LENGTH: AutoHeaderDef = {
  key: 'Content-Length',
  hintKey: 'workbench.editors.request.headers.hint.contentLength',
  bodyOnly: true,
  goTo: 'body',
};
const ACCEPT: AutoHeaderDef = {
  key: 'Accept',
  value: '*/*',
  hintKey: 'workbench.editors.request.headers.hint.accept',
  overridable: true,
};

// Rows are listed in the order they appear on the wire — the visual
// matches what a proxy / HAR view would show.

/** A browser host's page fetch (the transport dials with `cache:
 *  'no-store'`, which the browser stamps as Cache-Control: no-cache). */
const BROWSER_AUTO_HEADERS: readonly AutoHeaderDef[] = [
  {
    key: 'Cache-Control',
    value: 'no-cache',
    hintKey: 'workbench.editors.request.headers.hint.cacheControl',
    overridable: true,
  },
  CONTENT_TYPE,
  CONTENT_LENGTH,
  { key: 'Host', hintKey: 'workbench.editors.request.headers.hint.host' },
  {
    key: 'User-Agent',
    value: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    placeholderKey: 'workbench.editors.request.headers.browserUserAgent',
    hintKey: 'workbench.editors.request.headers.hint.userAgent',
    overridable: true,
  },
  ACCEPT,
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate, br',
    hintKey: 'workbench.editors.request.headers.hint.acceptEncoding',
  },
  {
    key: 'Connection',
    value: 'keep-alive',
    hintKey: 'workbench.editors.request.headers.hint.connection',
  },
];

/** A node host's undici fetch — the desktop app's main process and
 *  the server — identifying itself with the product token. No
 *  cache-busting header: the client has no HTTP cache. Every row but
 *  the computed Content-Length yields to a user row. */
const NODE_AUTO_HEADERS: readonly AutoHeaderDef[] = [
  CONTENT_TYPE,
  CONTENT_LENGTH,
  { key: 'Host', hintKey: 'workbench.editors.request.headers.hint.node.host', overridable: true },
  {
    key: 'Connection',
    value: 'keep-alive',
    hintKey: 'workbench.editors.request.headers.hint.node.connection',
    overridable: true,
  },
  ACCEPT,
  {
    key: 'Accept-Language',
    value: '*',
    hintKey: 'workbench.editors.request.headers.hint.node.acceptLanguage',
    overridable: true,
  },
  {
    key: 'Sec-Fetch-Mode',
    value: 'cors',
    hintKey: 'workbench.editors.request.headers.hint.node.secFetchMode',
    overridable: true,
  },
  {
    key: 'User-Agent',
    value: productUserAgent(__APP_VERSION__),
    hintKey: 'workbench.editors.request.headers.hint.node.userAgent',
    overridable: true,
  },
  {
    key: 'Accept-Encoding',
    value: 'br, gzip, deflate',
    hintKey: 'workbench.editors.request.headers.hint.node.acceptEncoding',
    overridable: true,
  },
];

interface HeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  /** Needed so `Content-Type` / `Content-Length` only show when a body exists. */
  body: RequestBody;
  /** Drives the auth-derived `Authorization` preview row. */
  auth: AuthConfig;
  /** What Inherit resolves to — the preview row describes that entry. */
  inheritedFrom?: InheritedAuthAttribution;
  /** Jump to the editor tab that owns a generated row's value —
   *  drives the hover-revealed "Go to …" links. */
  onNavigateTab?: (tab: 'authorization' | 'body' | 'settings') => void;
  /** Inline conflict chips for header cells + set-remove rows. */
  conflictBridge?: KeyValueRowConflictBridge;
}

const HeadersTab: React.FC<HeadersTabProps> = ({
  rows,
  onChange,
  body,
  auth,
  inheritedFrom,
  onNavigateTab,
  conflictBridge,
}) => {
  const t = useT();
  const [showAuto, setShowAuto] = useState(false);
  const [disabledAutoKeys, setDisabledAutoKeys] = useState<Set<string>>(new Set());

  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const autoHeaders = useMemo(() => {
    const hasBody = body.type !== 'none';
    return (nodeHost ? NODE_AUTO_HEADERS : BROWSER_AUTO_HEADERS).filter((h) => !h.bodyOnly || hasBody);
  }, [body.type, nodeHost]);

  const toggleAutoKey = (key: string, next: boolean) => {
    setDisabledAutoKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  // Auth-derived rows are always visible so the user sees the
  // synthesized `Authorization` header the moment they pick an auth
  // type — LOCKED: the check is greyed and the value is the scheme's
  // placeholder (never the credential); enabling, disabling and
  // editing live on the Authorization tab, the hover-revealed
  // "Go to authorization" the way in. The browser-managed
  // auto-headers stay behind the Show/Hide toggle since they're
  // environment noise the user rarely cares about.
  // Under Inherit the row describes the resolved ancestor entry — the
  // header still goes on the wire — read-only, the hint naming the
  // level it comes from.
  const effective = useMemo(() => previewedAuth(auth, inheritedFrom), [auth, inheritedFrom]);
  const inherited = auth.type === 'inherit';
  const authHeaders = useMemo(() => {
    if (effective === null) return [];
    const source = inherited && inheritedFrom?.source ? inheritSourceLabel(t, inheritedFrom.source) : null;
    return previewAuthContributions(effective, t).headers.map((h) =>
      source === null
        ? h
        : { ...h, hint: `${h.hint} ${t('workbench.editors.request.authPreview.inheritedFrom', { source })}` },
    );
  }, [effective, inherited, inheritedFrom, t]);

  // Keys of the user's own enabled rows — a generated row with the same
  // key renders struck through (the user's row wins on the wire).
  const userRowKeys = useMemo(() => {
    const out = new Set<string>();
    for (const r of rows) {
      if (r.enabled && r.key.trim()) out.add(r.key.trim().toLowerCase());
    }
    return out;
  }, [rows]);
  const overrideBy = (key: string): string | undefined => (userRowKeys.has(key.toLowerCase()) ? key : undefined);

  // Auth wins over a same-key user row (the executor replaces it —
  // see `setAuthHeader`), so the USER row is the one that renders
  // struck through, via `rowWarning` below. Postman semantics.
  const authHeaderKeys = useMemo(() => {
    if (auth.disabled) return new Set<string>();
    return new Set(authHeaders.map((h) => h.key.toLowerCase()));
  }, [auth.disabled, authHeaders]);
  const rowWarning = (row: KeyValueRow) =>
    row.enabled && row.key.trim() && authHeaderKeys.has(row.key.trim().toLowerCase())
      ? {
          message: t('workbench.editors.request.headers.duplicateAuthOverride', { header: row.key.trim() }),
          action: onNavigateTab
            ? { label: t('workbench.editors.request.goToAuthorization'), onClick: () => onNavigateTab('authorization') }
            : undefined,
        }
      : null;

  const authSuggestions: SuggestionRow[] = authHeaders.map((h) => ({
    key: h.key,
    value: h.value,
    hint: h.hint,
    enabled: auth.disabled !== true,
    action: onNavigateTab
      ? { label: t('workbench.editors.request.goToAuthorization'), onClick: () => onNavigateTab('authorization') }
      : undefined,
  }));
  const browserSuggestions: SuggestionRow[] = autoHeaders.map((h) => ({
    key: h.key,
    value: h.value ?? t(h.placeholderKey ?? 'workbench.editors.request.headers.calculated'),
    hint: t(h.hintKey),
    enabled: !disabledAutoKeys.has(h.key),
    onToggle: (next: boolean) => toggleAutoKey(h.key, next),
    overriddenBy: h.overridable ? overrideBy(h.key) : undefined,
    action:
      h.goTo !== undefined && onNavigateTab
        ? { label: t('workbench.editors.request.goToBody'), onClick: () => onNavigateTab('body') }
        : undefined,
  }));
  const suggestions: SuggestionRow[] = showAuto
    ? [...authSuggestions, ...browserSuggestions]
    : authSuggestions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AutoHeadersToggle
        shown={showAuto}
        count={browserSuggestions.length}
        onToggle={() => setShowAuto((s) => !s)}
      />
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder={t('workbench.editors.request.headers.keyPlaceholder')}
        suggestionRows={suggestions}
        bulkEdit={{
          serialize: headerRowsToText,
          parse: headerTextToRows,
          placeholder: 'Content-Type: application/json\nAuthorization: Bearer {{token}} # auth\n//X-Disabled: value',
        }}
        rowPath={(uid, leaf) => REQUEST_PATHS.header(uid, leaf)}
        rowWarning={rowWarning}
        conflictBridge={conflictBridge}
      />
    </div>
  );
};

export default HeadersTab;
