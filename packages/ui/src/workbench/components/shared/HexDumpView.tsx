/**
 * HexDumpView — the classic `xxd` dump as three columns, each ONE text
 * node regardless of row count (a 512 KB dump is 32k rows — per-row
 * elements would jank): a line-number gutter sticky through horizontal
 * scroll, the colored offsets, then the dump itself. Only rows carrying
 * a detected file signature split off spans, so their ASCII column
 * highlights (hover names the format). Shared by the HTTP response
 * body's Hex view and the session timelines' message viewers.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { HexDump } from '../request-editor/response/response-encoding';
import { formatBytes } from '../request-editor/response/response-format';

const { Text } = Typography;

export const HEX_PRE_STYLE: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
  margin: 0,
  whiteSpace: 'pre',
};

interface HexDumpViewProps {
  dump: HexDump;
  /** Pin prefix — `<prefix>-offsets` and `<prefix>` on the two dump
   *  columns; the response body keeps its historical ids. */
  testIdPrefix?: string;
}

const HexDumpView: React.FC<HexDumpViewProps> = ({ dump, testIdPrefix = 'oh-response-hex' }) => {
  const { token } = theme.useToken();
  const t = useT();
  const lineNumbers = useMemo(() => Array.from({ length: dump.rowCount }, (_, i) => i + 1).join('\n'), [dump]);
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      {dump.capped && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
          {t('workbench.editors.request.response.body.hexCapNotice', {
            shown: formatBytes(dump.shownBytes),
            total: formatBytes(dump.totalBytes),
          })}
        </Text>
      )}
      <div style={{ display: 'flex', width: 'fit-content', minWidth: '100%' }}>
        <pre
          aria-hidden="true"
          style={{
            ...HEX_PRE_STYLE,
            color: token.geekblue7,
            textAlign: 'right',
            userSelect: 'none',
            position: 'sticky',
            left: 0,
            background: token.colorBgContainer,
            paddingRight: 12,
            minWidth: 34,
          }}
        >
          {lineNumbers}
        </pre>
        <pre data-testid={`${testIdPrefix}-offsets`} style={{ ...HEX_PRE_STYLE, color: token.magenta7 }}>
          {dump.offsetsText}
        </pre>
        <pre data-testid={testIdPrefix} style={{ ...HEX_PRE_STYLE, color: token.colorText }}>
          {dump.pieces.map((piece, i) => {
            const nl = i < dump.pieces.length - 1 ? '\n' : '';
            if (piece.kind === 'plain') return `${piece.text}${nl}`;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: pieces are positional derivations of one immutable dump
              <span key={i}>
                {piece.head}
                <span title={piece.label} style={{ color: token.colorInfoText, fontWeight: 600 }}>
                  {piece.ascii}
                </span>
                {nl}
              </span>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

export default HexDumpView;
