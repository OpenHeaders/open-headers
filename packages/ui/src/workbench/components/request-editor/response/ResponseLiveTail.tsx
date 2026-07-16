/**
 * ResponseLiveTail — the response panel's live phase for a streaming
 * send: the head (status) as soon as it arrives plus the body received
 * so far, updated live until the user stops the send or the stream
 * ends (at which point the materialized snapshot takes over and the
 * full format plane engages). SSE sends (the head declared
 * `text/event-stream`) render the event LIST here instead of the text
 * tail — the same surface the materialized snapshot shows, so
 * Stop/close never switches views.
 *
 * Perf laws honored: the tail is ONE text node inside a plain <pre> —
 * no per-line spans, no grammar, no parsing — and the hook feeding it
 * already rAF-batches commits, so the render cost per flush is a single
 * text swap. Auto-follow pins the scroller to the bottom only while the
 * user is already there; scrolling up to read holds the position.
 */

import { LoadingOutlined } from '@ant-design/icons';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { LiveSendStream } from '../useLiveSendStream';
import ResponseSseEventList from './ResponseSseEventList';
import { formatBytes } from './response-format';

const { Text } = Typography;

/** Within this many px of the bottom counts as "following" — a burst of
 *  appends between scroll events must not break the follow. */
const FOLLOW_SLACK_PX = 32;

interface ResponseLiveTailProps {
  live: LiveSendStream;
}

const ResponseLiveTail: React.FC<ResponseLiveTailProps> = ({ live }) => {
  const { token } = theme.useToken();
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);

  // Pin to the bottom on new tail text while the user is following.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tailText is the change signal — the effect reads the DOM, not the value.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller && followRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [live.tailText]);

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

  return (
    <div
      data-testid="oh-response-live-tail"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {live.head !== null && (
          <Tag
            color="default"
            data-testid="oh-response-live-status"
            style={{ color: statusColor, borderColor: statusColor, marginInlineEnd: 0 }}
          >
            {live.head.status} {live.head.statusText}
          </Tag>
        )}
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.request.response.streamReceiving', { size: formatBytes(live.totalBytes) })}
        </Text>
      </div>
      {live.sse !== null && live.head !== null ? (
        // SSE: the event list, newest-first — new rows land at the top,
        // so no scroll-follow is needed. Timestamps mint at frame
        // arrival; the connected row derives from the head.
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px' }}>
          <ResponseSseEventList
            items={live.sse.items}
            count={live.sse.count}
            timestamps={live.sse.timestamps}
            lifecycle={{ url: live.head.url, connectedAt: live.sse.connectedAt }}
          />
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="rules-thin-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX;
          }}
          style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', padding: '8px 16px' }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: "'SF Mono', Consolas, monospace",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {live.tailText}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ResponseLiveTail;
