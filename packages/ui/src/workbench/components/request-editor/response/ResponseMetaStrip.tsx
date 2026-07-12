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

import { ArrowDownOutlined, ArrowUpOutlined, GlobalOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
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

interface SizeStatRow {
  label: string;
  text: string;
}

/** One stat block: tinted direction icon + bold title with the total
 *  right-aligned, then quiet label/value rows indented under it. */
function SizeStatSection({
  direction,
  title,
  totalText,
  rows,
}: {
  direction: 'down' | 'up';
  title: string;
  totalText: string;
  rows: SizeStatRow[];
}) {
  const { token } = theme.useToken();
  const tintBg = direction === 'down' ? token.colorPrimaryBg : token.colorWarningBg;
  const tintFg = direction === 'down' ? token.colorPrimary : token.colorWarning;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: tintBg,
            color: tintFg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {direction === 'down' ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
        </span>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{title}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {totalText}
        </span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            paddingLeft: 26,
            fontSize: 12,
            color: token.colorTextSecondary,
          }}
        >
          <span>{row.label}</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{row.text}</span>
        </div>
      ))}
    </div>
  );
}

/** The Size popover body: response / request stat blocks in the
 *  Postman-style table shape, with every honesty caveat demoted to
 *  compact footnotes so the numbers stay scannable. */
function SizeStats({ response }: { response: ExecutedRequestSnapshot }) {
  const { token } = theme.useToken();
  const timing = response.timing;
  const wireSizesExposed = timing !== undefined && (timing.transferSize > 0 || timing.encodedBodySize > 0);
  const headersBytes = serializedHeaderListBytes(response.headers);

  const responseRows: SizeStatRow[] = [
    { label: 'Headers', text: formatBytes(headersBytes) },
    { label: 'Body', text: formatBytes(response.bodyBytes) },
  ];
  if (wireSizesExposed && timing.encodedBodySize > 0 && timing.encodedBodySize !== timing.decodedBodySize) {
    responseRows.push({ label: 'Compressed', text: formatBytes(timing.encodedBodySize) });
  }
  if (wireSizesExposed && timing.transferSize > 0) {
    responseRows.push({ label: 'Transferred', text: formatBytes(timing.transferSize) });
  }

  const notes: string[] = ['Header bytes as visible — HTTP/2+ compresses them on the wire.'];
  if (response.requestSize) {
    notes.push('Request headers count only what this send set; the browser adds its own (Host, User-Agent, …).');
  }
  if (response.bodyTruncated) {
    // `bodyCapBytes` records the cap this send actually ran under (a
    // user setting or per-request limit) — label it when present.
    notes.push(
      response.bodyCapBytes !== undefined
        ? `Body truncated at the ${formatBytes(response.bodyCapBytes)} response size limit; the full size is counted.`
        : 'Body view truncated; the full size is counted.',
    );
  }
  if (response.requestSize?.bodyApproximate) {
    notes.push('Request body size is approximate — the multipart boundary is browser-generated.');
  }
  if (!wireSizesExposed) {
    notes.push('Wire sizes (compressed, transferred) hidden: the server sent no Timing-Allow-Origin.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
      <SizeStatSection
        direction="down"
        title="Response Size"
        totalText={formatBytes(headersBytes + response.bodyBytes)}
        rows={responseRows}
      />
      {response.requestSize && (
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 10 }}>
          <SizeStatSection
            direction="up"
            title="Request Size"
            totalText={formatBytes(response.requestSize.headersBytes + response.requestSize.bodyBytes)}
            rows={[
              { label: 'Headers', text: formatBytes(response.requestSize.headersBytes) },
              {
                label: 'Body',
                text: `${response.requestSize.bodyApproximate ? '≈ ' : ''}${formatBytes(response.requestSize.bodyBytes)}`,
              },
            ]}
          />
        </div>
      )}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {notes.map((note) => (
          <span key={note} style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

function sizeContent(response: ExecutedRequestSnapshot): InfoPopoverContent {
  return {
    title: 'Size',
    kicker: 'Response meta',
    summary: 'Bytes in each direction of this exchange.',
    description: <SizeStats response={response} />,
  };
}

/** The globe popover's body: connection-level facts we can honestly
 *  hold, with per-fact absence explained in footnotes. */
function NetworkFacts({ response }: { response: ExecutedRequestSnapshot }) {
  const { token } = theme.useToken();
  const versionLabel = response.timing ? httpVersionLabel(response.timing.nextHopProtocol) : null;
  const ip = response.wire?.ip;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'HTTP Version', value: versionLabel ?? '—' },
    { label: 'Remote Address', value: ip ?? '—' },
  ];
  const notes: string[] = [];
  if (!versionLabel) {
    // Absence reads differently per runtime: the browser withheld a
    // timing entry; the node stack never reports the negotiated
    // protocol at all (its fetch exposes no such fact).
    notes.push(
      (getCapability('requestRuntime')?.() ?? 'browser') === 'node'
        ? 'HTTP version hidden: the app’s network runtime does not report the negotiated protocol.'
        : 'HTTP version hidden: the platform recorded no timing entry for this request.',
    );
  }
  if (ip === undefined) notes.push('Remote address unavailable: the wire capture saw nothing for this fetch.');
  notes.push('Local address, TLS and certificate details are not exposed to extension code on Chromium.');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12 }}>
            <span style={{ width: 110, flexShrink: 0, color: token.colorTextSecondary }}>{row.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {notes.map((note) => (
          <span key={note} style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Popover for the warning tag on a run whose per-request SSL
 *  verification knob was off — the snapshot records the policy the
 *  send actually ran under. */
function unverifiedTlsContent(): InfoPopoverContent {
  return {
    title: 'SSL verification disabled',
    kicker: 'Response meta',
    summary:
      'This request was sent with certificate verification switched off in its Settings. The connection was encrypted, but the server’s identity was not checked — any certificate was accepted, including self-signed and expired ones.',
  };
}

/** Popover for the warning tag on a run whose per-request TLS floor
 *  sat below the runtime's 1.2 default — the snapshot records the
 *  policy the send actually ran under. */
function tlsFloorLoweredContent(): InfoPopoverContent {
  return {
    title: 'TLS floor lowered',
    kicker: 'Response meta',
    summary:
      'This request was sent with its minimum TLS version set below 1.2 in its Settings, so the connection was allowed to negotiate TLS 1.0 or 1.1 — protocol versions with known weaknesses that runtimes disable by default.',
  };
}

/** Popover for the warning tag on a run whose redirect chain actually
 *  re-sent the Authorization header across origins — stamped only when
 *  the `followAuthorizationHeader` opt-in fired, not merely configured. */
function authForwardedContent(): InfoPopoverContent {
  return {
    title: 'Authorization forwarded',
    kicker: 'Response meta',
    summary:
      'A redirect took this request to a different origin, and its Settings keep the Authorization header across origins — so the credentials were re-sent to the new host. Normally the header is dropped when a redirect leaves the original origin.',
  };
}

function networkContent(response: ExecutedRequestSnapshot): InfoPopoverContent {
  return {
    title: 'Network',
    kicker: 'Response meta',
    summary: 'Connection-level facts for this exchange.',
    description: <NetworkFacts response={response} />,
  };
}

interface ResponseMetaStripProps {
  response: ExecutedRequestSnapshot;
  /** Status-range tint computed by the panel (theme tokens live there). */
  statusColor: string;
}

/** Tiny round separator between the strip's facts. */
const MetaDot: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden="true"
      style={{ width: 3, height: 3, borderRadius: '50%', flexShrink: 0, background: token.colorTextQuaternary }}
    />
  );
};

const ResponseMetaStrip: React.FC<ResponseMetaStripProps> = ({ response, statusColor }) => {
  const { token } = theme.useToken();
  const factStyle: React.CSSProperties = { fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' };
  // The strip leads with the on-wire size when the server exposes it
  // (matches devtools' Size column); decoded bytes otherwise. The
  // popover carries both figures either way.
  const stripBytes =
    response.timing && response.timing.transferSize > 0 ? response.timing.transferSize : response.bodyBytes;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
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
      <MetaDot />
      <InfoPopover content={timingContent(response)} trigger="hover">
        <Text type="secondary" style={factStyle}>
          {response.durationMs} ms
        </Text>
      </InfoPopover>
      <MetaDot />
      <InfoPopover content={sizeContent(response)} trigger="hover">
        <Text type="secondary" style={factStyle}>
          {formatBytes(stripBytes)}
        </Text>
      </InfoPopover>
      {response.sslVerificationDisabled && (
        <>
          <MetaDot />
          <InfoPopover content={unverifiedTlsContent()} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-tls-unverified"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              Unverified TLS
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.tlsFloorLowered && (
        <>
          <MetaDot />
          <InfoPopover content={tlsFloorLoweredContent()} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-tls-floor-lowered"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              TLS floor lowered
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.authorizationForwarded && (
        <>
          <MetaDot />
          <InfoPopover content={authForwardedContent()} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-auth-forwarded"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              Authorization forwarded
            </Tag>
          </InfoPopover>
        </>
      )}
      <MetaDot />
      <InfoPopover content={networkContent(response)} trigger="hover">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'help',
            color: token.colorTextSecondary,
            fontSize: 13,
          }}
        >
          <GlobalOutlined />
        </span>
      </InfoPopover>
    </span>
  );
};

export default ResponseMetaStrip;
