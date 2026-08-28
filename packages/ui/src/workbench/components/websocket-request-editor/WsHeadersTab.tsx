/**
 * WsHeadersTab — the user's custom handshake headers plus the
 * auto-generated section behind the shared Show/Hide toggle, listed in
 * wire order as read-only rows so the user sees what actually leaves
 * with the upgrade request. The set depends on who dials: a node host
 * (desktop app, server) sends undici's WebSocket handshake, identifying
 * itself with the product token; a browser host
 * hands the handshake to the page's WebSocket API, which adds its own
 * Origin, User-Agent, cache and Accept-* headers — and refuses custom
 * rows, so on that host every user row carries a not-sent warning.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import AutoHeadersToggle from '../request-editor/AutoHeadersToggle';
import KeyValueTable, { type KeyValueRow, type SuggestionRow } from '../request-editor/KeyValueTable';
import { wsAutoHeaderDefs } from './ws-auto-headers';

interface WsHeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

const WsHeadersTab: React.FC<WsHeadersTabProps> = ({ rows, onChange }) => {
  const t = useT();
  const [showAuto, setShowAuto] = useState(false);
  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const autoHeaders = wsAutoHeaderDefs();
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
