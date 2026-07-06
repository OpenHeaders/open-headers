/**
 * ResponseMetaStrip — the glanceable status · time · size line in the
 * response panel header, with hover popovers giving each fact its full
 * story (status meaning, timing ladder, size split, HTTP version).
 *
 * Depth follows the honest-degradation contract: the executor fetches
 * from an extension origin, so timing phases and wire sizes appear only
 * when the server opts in via `Timing-Allow-Origin`; otherwise the
 * popovers say exactly what the platform withheld instead of faking a
 * breakdown.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getStatusCodeInfoContent } from '@openheaders/ui/shared/info-popover/data/http-status';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { formatBytes } from './response-format';
import {
  formatPhaseMs,
  httpVersionLabel,
  mapEntryToTimingView,
  type ResponsePhase,
  type ResponsePhaseKey,
  serializedHeaderListBytes,
} from './response-meta';

const { Text } = Typography;

/** Mid-tone phase hues legible on both themes — mirrors the devtools
 *  panel's waterfall palette (kept local: panel CSS doesn't load in
 *  the workbench). */
const PHASE_COLOR: Record<ResponsePhaseKey, string> = {
  redirect: '#9ca3af',
  stalled: '#9ca3af',
  dns: '#22b8cf',
  connect: '#eab308',
  tls: '#d190ff',
  waiting: '#37be5f',
  download: '#4c8df6',
};

function TimingLadder({ phases, totalMs }: { phases: ResponsePhase[]; totalMs: number }) {
  const { token } = theme.useToken();
  const span = totalMs > 0 ? totalMs : 1;
  const pct = (ms: number) => `${Math.min(100, (ms / span) * 100)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      {phases.map((phase) => (
        <div key={phase.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PHASE_COLOR[phase.key] }}
          />
          <span style={{ width: 110, flexShrink: 0, fontSize: 11 }}>{phase.label}</span>
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              position: 'relative',
              height: 6,
              borderRadius: 2,
              background: token.colorFillQuaternary,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: pct(phase.startMs),
                width: pct(phase.durationMs),
                minWidth: phase.durationMs > 0 ? 2 : 0,
                borderRadius: 2,
                background: PHASE_COLOR[phase.key],
              }}
            />
          </span>
          <span style={{ width: 52, flexShrink: 0, textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {formatPhaseMs(phase.durationMs)}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 2,
          paddingTop: 4,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 11,
        }}
      >
        <span>Total (network)</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPhaseMs(totalMs)}</span>
      </div>
    </div>
  );
}

function timingContent(response: ExecutedRequestSnapshot): InfoPopoverContent {
  const base = {
    title: 'Timing',
    kicker: 'Response meta',
    summary: `Measured around the fetch call: ${formatPhaseMs(response.durationMs)}.`,
  };
  if (!response.timing) {
    return {
      ...base,
      description:
        'The platform recorded no resource-timing entry for this request, so no phase breakdown is available.',
    };
  }
  const view = mapEntryToTimingView(response.timing);
  if (view.kind === 'total-only') {
    return {
      ...base,
      description: `Network total ${formatPhaseMs(view.totalMs)}. The server did not expose timing detail to this cross-origin request (no Timing-Allow-Origin header), so the DNS / connect / TTFB / download phases are hidden.`,
    };
  }
  return {
    ...base,
    description: <TimingLadder phases={view.phases} totalMs={view.totalMs} />,
  };
}

function sizeContent(response: ExecutedRequestSnapshot): InfoPopoverContent {
  const timing = response.timing;
  const wireSizesExposed = timing !== undefined && (timing.transferSize > 0 || timing.encodedBodySize > 0);
  const responseItems: Array<{ label: string; desc: string }> = [
    {
      label: 'Body',
      desc: `${formatBytes(response.bodyBytes)} — decoded text as read by the executor${response.bodyTruncated ? ' (view truncated, full size counted)' : ''}`,
    },
    {
      label: 'Headers',
      desc: `${formatBytes(serializedHeaderListBytes(response.headers))} — as visible; HTTP/2+ compresses header frames on the wire`,
    },
  ];
  if (wireSizesExposed) {
    if (timing.encodedBodySize > 0 && timing.encodedBodySize !== timing.decodedBodySize) {
      responseItems.push({
        label: 'Compressed',
        desc: `${formatBytes(timing.encodedBodySize)} on the wire, ${formatBytes(timing.decodedBodySize)} decoded`,
      });
    }
    if (timing.transferSize > 0) {
      responseItems.push({
        label: 'Transferred',
        desc: `${formatBytes(timing.transferSize)} — total over the network, including headers`,
      });
    }
  }
  const sections = [{ heading: 'Response', items: responseItems }];
  if (response.requestSize) {
    sections.push({
      heading: 'Request',
      items: [
        {
          label: 'Headers',
          desc: `${formatBytes(response.requestSize.headersBytes)} — headers set by this request; the browser adds its own (Host, User-Agent, …)`,
        },
        {
          label: 'Body',
          desc: `${formatBytes(response.requestSize.bodyBytes)}${response.requestSize.bodyApproximate ? ' — approximate (multipart boundary is browser-generated)' : ''}`,
        },
      ],
    });
  }
  return {
    title: 'Size',
    kicker: 'Response meta',
    summary: `Response body: ${formatBytes(response.bodyBytes)}.`,
    description: wireSizesExposed
      ? undefined
      : 'The server did not expose wire sizes to this cross-origin request (no Timing-Allow-Origin header), so compressed and transferred bytes are unavailable.',
    sections,
  };
}

function httpVersionContent(label: string): InfoPopoverContent {
  return {
    title: label,
    kicker: 'Response meta',
    summary: 'The HTTP protocol version this connection negotiated, picked at TLS time via ALPN.',
    sections: [
      {
        heading: 'Common values',
        items: [
          { label: 'HTTP/1.1', desc: 'Text-based; one request at a time per connection by default.' },
          { label: 'HTTP/2', desc: 'Binary and multiplexed over a single TCP connection.' },
          { label: 'HTTP/3', desc: 'Runs on QUIC over UDP — faster handshakes, better loss recovery.' },
        ],
      },
    ],
  };
}

interface ResponseMetaStripProps {
  response: ExecutedRequestSnapshot;
  /** Status-range tint computed by the panel (theme tokens live there). */
  statusColor: string;
}

const ResponseMetaStrip: React.FC<ResponseMetaStripProps> = ({ response, statusColor }) => {
  if (response.error !== null) {
    return (
      <Tag color="error" style={{ marginInlineEnd: 0 }}>
        {response.error}
      </Tag>
    );
  }
  const versionLabel = response.timing ? httpVersionLabel(response.timing.nextHopProtocol) : null;
  const factStyle: React.CSSProperties = { fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' };
  return (
    <>
      <InfoPopover content={getStatusCodeInfoContent(response.status, response.statusText)} trigger="hover">
        <Tag
          color="default"
          // Styled status chip with no semantic role/name — the one
          // response-panel element e2e can't target via getByRole/text.
          data-testid="oh-response-status"
          style={{ color: statusColor, borderColor: statusColor, marginInlineEnd: 0, cursor: 'help' }}
        >
          {response.status} {response.statusText}
        </Tag>
      </InfoPopover>
      <InfoPopover content={timingContent(response)} trigger="hover">
        <Text type="secondary" style={factStyle}>
          {response.durationMs} ms
        </Text>
      </InfoPopover>
      <InfoPopover content={sizeContent(response)} trigger="hover">
        <Text type="secondary" style={factStyle}>
          {formatBytes(response.bodyBytes)}
        </Text>
      </InfoPopover>
      {versionLabel && (
        <InfoPopover content={httpVersionContent(versionLabel)} trigger="hover">
          <Text type="secondary" style={factStyle}>
            {versionLabel}
          </Text>
        </InfoPopover>
      )}
    </>
  );
};

export default ResponseMetaStrip;
