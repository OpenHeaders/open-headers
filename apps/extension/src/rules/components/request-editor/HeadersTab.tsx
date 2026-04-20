/**
 * HeadersTab — user-defined request headers + a collapsible section
 * for browser-managed headers the extension cannot override from
 * userland code (Host / User-Agent / Accept-Encoding / Connection /
 * etc.). The count badge on the tab label reflects the auto-managed
 * header count so the user knows something's being added on their
 * behalf even before they open the section.
 *
 * The auto-managed rows carry a per-row enable checkbox. Un-checking
 * just flips a local "disabled" set — the row stays visible but
 * dimmed to signal "would have been sent, now suppressed". We keep
 * this local to the component for now since the browser decides what
 * to actually put on the wire either way; the toggle is informational
 * until we swap to a custom fetch pipeline that can honour
 * suppression end-to-end.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import KeyValueTable, { type KeyValueRow, type SuggestionRow } from './KeyValueTable';

const { Text } = Typography;

interface AutoHeaderDef {
  key: string;
  value: string;
  hint: string;
}

export const AUTO_GENERATED_HEADERS: AutoHeaderDef[] = [
  {
    key: 'Host',
    value: '<calculated when request is sent>',
    hint: 'The browser sets Host from the target URL.',
  },
  {
    key: 'User-Agent',
    value: 'OpenHeadersRuntime/5',
    hint: 'Browser-controlled User-Agent string.',
  },
  {
    key: 'Accept',
    value: '*/*',
    hint: 'Default Accept header for the request.',
  },
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate, br',
    hint: 'Compression algorithms the client supports.',
  },
  {
    key: 'Connection',
    value: 'keep-alive',
    hint: 'HTTP/1.1 connection re-use.',
  },
];

interface HeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

const HeadersTab: React.FC<HeadersTabProps> = ({ rows, onChange }) => {
  const { token } = theme.useToken();
  const [showAuto, setShowAuto] = useState(false);
  const [disabledAutoKeys, setDisabledAutoKeys] = useState<Set<string>>(new Set());

  const toggleAutoKey = (key: string, next: boolean) => {
    setDisabledAutoKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  const suggestions: SuggestionRow[] = AUTO_GENERATED_HEADERS.map((h) => ({
    key: h.key,
    value: h.value,
    hint: h.hint,
    enabled: !disabledAutoKeys.has(h.key),
    onToggle: (next) => toggleAutoKey(h.key, next),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text strong style={{ fontSize: 13 }}>
            Headers
          </Text>
          <Button
            size="small"
            type="text"
            icon={showAuto ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowAuto((s) => !s)}
            style={{ color: token.colorTextSecondary, fontSize: 12 }}
          >
            {showAuto ? 'Hide auto-generated headers' : `${AUTO_GENERATED_HEADERS.length} hidden`}
          </Button>
        </div>
      </div>
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        suggestionRows={showAuto ? suggestions : []}
      />
    </div>
  );
};

export default HeadersTab;
