/**
 * ResponseLiveMetaStrip — the tab-bar meta facts of an IN-FLIGHT send:
 * a pulsing dot saying the exchange is alive, the head status as soon
 * as it arrives, the elapsed time ticking live, and the bytes received
 * so far. Same anatomy and alignment as the settled ResponseMetaStrip
 * so the strip doesn't jump when the materialized snapshot takes over.
 */

import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { LiveSendStream } from '../useLiveSendStream';
import { MetaDot } from './ResponseMetaStrip';
import { formatBytes } from './response-format';
import { formatDurationRolled } from './response-meta';

const { Text } = Typography;

const ResponseLiveMetaStrip: React.FC<{ live: LiveSendStream }> = ({ live }) => {
  const { token } = theme.useToken();
  const [now, setNow] = useState(() => Date.now());

  // Tick the elapsed fact while mounted — the strip exists only for
  // the send's flight window, so the interval is send-bounded.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const statusColor =
    live.head === null
      ? token.colorTextSecondary
      : live.head.status >= 500
        ? token.colorError
        : live.head.status >= 400
          ? token.colorWarning
          : live.head.status >= 200 && live.head.status < 300
            ? token.colorSuccess
            : token.colorTextSecondary;

  const factStyle: React.CSSProperties = { fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

  return (
    <span
      data-testid="oh-response-live-meta"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}
    >
      <span
        aria-hidden="true"
        className="rules-dot rules-dot-blink"
        style={{ width: 8, height: 8, background: token.colorTextQuaternary, flexShrink: 0 }}
      />
      {live.head !== null && (
        <>
          <Tag
            color="default"
            data-testid="oh-response-live-status"
            style={{ color: statusColor, borderColor: statusColor, marginInlineEnd: 0 }}
          >
            {live.head.status} {live.head.statusText}
          </Tag>
          <MetaDot />
        </>
      )}
      <Text type="secondary" data-testid="oh-response-live-elapsed" style={factStyle}>
        {formatDurationRolled(now - live.startedAt)}
      </Text>
      <MetaDot />
      <Text type="secondary" style={factStyle}>
        {formatBytes(live.totalBytes)}
      </Text>
    </span>
  );
};

export default ResponseLiveMetaStrip;
