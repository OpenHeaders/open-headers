/**
 * ResponseLiveTail — the Body tab's live phase for a streaming send:
 * the body received so far, updated live until the user stops the send
 * or the stream ends (at which point the materialized snapshot takes
 * over and the full format plane engages). SSE sends (the head
 * declared `text/event-stream`) render the event LIST here instead of
 * the text tail — the same surface the materialized snapshot shows, so
 * Stop/close never switches views. The status / elapsed / bytes facts
 * live in the tab bar's ResponseLiveMetaStrip, exactly where the
 * settled meta strip sits.
 *
 * Perf laws honored: the tail is ONE text node inside a plain <pre> —
 * no per-line spans, no grammar, no parsing — and the hook feeding it
 * already rAF-batches commits, so the render cost per flush is a single
 * text swap. Auto-follow pins the scroller to the bottom only while the
 * user is already there; scrolling up to read holds the position.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import type { LiveSendStream } from '../useLiveSendStream';
import ResponseSseEventList from './ResponseSseEventList';

/** Within this many px of the bottom counts as "following" — a burst of
 *  appends between scroll events must not break the follow. */
const FOLLOW_SLACK_PX = 32;

interface ResponseLiveTailProps {
  live: LiveSendStream;
}

const ResponseLiveTail: React.FC<ResponseLiveTailProps> = ({ live }) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);

  // Pin to the bottom on new tail text while the user is following.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tailText is the change signal — the effect reads the DOM, not the value.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller && followRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [live.tailText]);

  return (
    <div
      data-testid="oh-response-live-tail"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}
    >
      {live.sse !== null && live.head !== null ? (
        // SSE: the event list, newest-first — new rows land at the top,
        // so no scroll-follow is needed. Timestamps mint at frame
        // arrival; the connected row derives from the head.
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
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
          style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', paddingTop: 8 }}
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
