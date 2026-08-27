/**
 * WsHeadersTab — the user's custom handshake headers plus the
 * auto-generated section behind the shared Show/Hide toggle: the
 * headers every WebSocket opening handshake carries (Host, Connection,
 * Upgrade, the Sec-WebSocket-* trio), listed in wire order as read-only
 * rows so the user sees what actually leaves with the upgrade request.
 */

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

const WS_AUTO_HEADERS: readonly WsAutoHeaderDef[] = [
  { key: 'Host', hintKey: 'workbench.editors.websocket.headers.hint.host' },
  { key: 'Connection', value: 'Upgrade', hintKey: 'workbench.editors.websocket.headers.hint.connection' },
  { key: 'Upgrade', value: 'websocket', hintKey: 'workbench.editors.websocket.headers.hint.upgrade' },
  { key: 'Sec-WebSocket-Key', hintKey: 'workbench.editors.websocket.headers.hint.key' },
  { key: 'Sec-WebSocket-Version', value: '13', hintKey: 'workbench.editors.websocket.headers.hint.version' },
  {
    key: 'Sec-WebSocket-Extensions',
    value: 'permessage-deflate; client_max_window_bits',
    hintKey: 'workbench.editors.websocket.headers.hint.extensions',
  },
];

interface WsHeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

const WsHeadersTab: React.FC<WsHeadersTabProps> = ({ rows, onChange }) => {
  const t = useT();
  const [showAuto, setShowAuto] = useState(false);
  const suggestions: SuggestionRow[] = showAuto
    ? WS_AUTO_HEADERS.map((h) => ({
        key: h.key,
        value: h.value ?? t('workbench.editors.request.headers.calculated'),
        hint: t(h.hintKey),
        enabled: true,
      }))
    : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AutoHeadersToggle shown={showAuto} count={WS_AUTO_HEADERS.length} onToggle={() => setShowAuto((s) => !s)} />
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder={t('workbench.editors.websocket.headers.keyPlaceholder')}
        valuePlaceholder={t('workbench.editors.websocket.headers.valuePlaceholder')}
        suggestionRows={suggestions}
      />
    </div>
  );
};

export default WsHeadersTab;
