/**
 * WsHeadersTab — the user's custom handshake headers plus the
 * auto-generated section behind the shared Show/Hide toggle, listed in
 * wire order as read-only rows so the user sees what actually leaves
 * with the upgrade request. The set depends on who dials: a node host
 * (desktop app, server) sends the `ws` client's six; a browser host
 * hands the handshake to the page's WebSocket API, which adds its own
 * Origin, User-Agent, cache and Accept-* headers — and refuses custom
 * rows, so on that host every user row carries a not-sent warning.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import AutoHeadersToggle from '../request-editor/AutoHeadersToggle';
import KeyValueTable, { type KeyValueRow, type SuggestionRow } from '../request-editor/KeyValueTable';

interface WsAutoHeaderDef {
  key: string;
  /** Literal wire value, or absent for a value computed at connect time. */
  value?: string;
  hintKey: MessageKey;
}

const HOST: WsAutoHeaderDef = { key: 'Host', hintKey: 'workbench.editors.websocket.headers.hint.host' };
const CONNECTION: WsAutoHeaderDef = {
  key: 'Connection',
  value: 'Upgrade',
  hintKey: 'workbench.editors.websocket.headers.hint.connection',
};
const UPGRADE: WsAutoHeaderDef = {
  key: 'Upgrade',
  value: 'websocket',
  hintKey: 'workbench.editors.websocket.headers.hint.upgrade',
};
const KEY: WsAutoHeaderDef = { key: 'Sec-WebSocket-Key', hintKey: 'workbench.editors.websocket.headers.hint.key' };
const VERSION: WsAutoHeaderDef = {
  key: 'Sec-WebSocket-Version',
  value: '13',
  hintKey: 'workbench.editors.websocket.headers.hint.version',
};
const EXTENSIONS: WsAutoHeaderDef = {
  key: 'Sec-WebSocket-Extensions',
  value: 'permessage-deflate; client_max_window_bits',
  hintKey: 'workbench.editors.websocket.headers.hint.extensions',
};

/** The node `ws` client's opening handshake, in the order it writes them. */
const NODE_AUTO_HEADERS: readonly WsAutoHeaderDef[] = [HOST, CONNECTION, UPGRADE, KEY, VERSION, EXTENSIONS];

/** Chromium's opening handshake for a page-realm WebSocket. */
const BROWSER_AUTO_HEADERS: readonly WsAutoHeaderDef[] = [
  HOST,
  CONNECTION,
  { key: 'Pragma', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.cacheControl' },
  { key: 'Cache-Control', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.cacheControl' },
  {
    key: 'User-Agent',
    value: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    hintKey: 'workbench.editors.websocket.headers.hint.userAgent',
  },
  UPGRADE,
  { key: 'Origin', hintKey: 'workbench.editors.websocket.headers.hint.origin' },
  VERSION,
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate, br',
    hintKey: 'workbench.editors.websocket.headers.hint.acceptEncoding',
  },
  { key: 'Accept-Language', hintKey: 'workbench.editors.websocket.headers.hint.acceptLanguage' },
  KEY,
  EXTENSIONS,
];

interface WsHeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

const WsHeadersTab: React.FC<WsHeadersTabProps> = ({ rows, onChange }) => {
  const t = useT();
  const [showAuto, setShowAuto] = useState(false);
  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const autoHeaders = nodeHost ? NODE_AUTO_HEADERS : BROWSER_AUTO_HEADERS;
  const suggestions: SuggestionRow[] = showAuto
    ? autoHeaders.map((h) => ({
        key: h.key,
        value: h.value ?? t('workbench.editors.request.headers.calculated'),
        hint: t(h.hintKey),
        enabled: true,
      }))
    : [];
  const rowWarning = nodeHost
    ? undefined
    : (row: KeyValueRow) =>
        row.enabled && row.key.trim() ? { message: t('workbench.editors.websocket.headers.browserNotSent') } : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AutoHeadersToggle shown={showAuto} count={autoHeaders.length} onToggle={() => setShowAuto((s) => !s)} />
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder={t('workbench.editors.websocket.headers.keyPlaceholder')}
        valuePlaceholder={t('workbench.editors.websocket.headers.valuePlaceholder')}
        suggestionRows={suggestions}
        rowWarning={rowWarning}
      />
    </div>
  );
};

export default WsHeadersTab;
