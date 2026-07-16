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
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { formatBytes } from './response-format';
import {
  formatDurationRolled,
  formatPhaseMs,
  httpVersionLabel,
  mapEntryToTimingView,
  mapPhaseTimingsToView,
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
  const t = useT();
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
          <span style={{ width: 110, flexShrink: 0, fontSize: 11 }}>{t(phase.labelKey)}</span>
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
        <span>{t('workbench.editors.request.response.meta.totalNetwork')}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPhaseMs(totalMs)}</span>
      </div>
    </div>
  );
}

/** The node runtime's ladder: the same TimingLadder over the manual
 *  phase marks, plus the honesty note about the legs the node network
 *  stack cannot observe per send (they sit inside Waiting). */
function NodePhaseLadder({ timings }: { timings: NonNullable<ExecutedRequestSnapshot['phaseTimings']> }) {
  const { token } = theme.useToken();
  const t = useT();
  const view = mapPhaseTimingsToView(timings);
  if (view.kind !== 'detailed') return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <TimingLadder phases={view.phases} totalMs={view.totalMs} />
      <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
        {t('workbench.editors.request.response.meta.noteNodePhaseLegs')}
      </span>
    </div>
  );
}

function timingContent(response: ExecutedRequestSnapshot, t: Translate): InfoPopoverContent {
  const base = {
    title: t('workbench.editors.request.response.meta.timingTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.timingSummary', {
      duration: formatPhaseMs(response.durationMs),
    }),
  };
  if (!response.timing) {
    // The node runtime records manual phase marks instead of a
    // resource-timing entry — same ladder, honesty note attached.
    if (response.phaseTimings !== undefined) {
      return { ...base, description: <NodePhaseLadder timings={response.phaseTimings} /> };
    }
    return {
      ...base,
      description: t('workbench.editors.request.response.meta.timingNoEntry'),
    };
  }
  const view = mapEntryToTimingView(response.timing);
  if (view.kind === 'total-only') {
    return {
      ...base,
      description: t('workbench.editors.request.response.meta.timingTotalOnly', {
        duration: formatPhaseMs(view.totalMs),
      }),
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
  const t = useT();
  const timing = response.timing;
  const wireSizesExposed = timing !== undefined && (timing.transferSize > 0 || timing.encodedBodySize > 0);
  const headersBytes = serializedHeaderListBytes(response.headers);

  const responseRows: SizeStatRow[] = [
    { label: t('workbench.editors.request.response.meta.rowHeaders'), text: formatBytes(headersBytes) },
    { label: t('workbench.editors.request.response.meta.rowBody'), text: formatBytes(response.bodyBytes) },
  ];
  if (wireSizesExposed && timing.encodedBodySize > 0 && timing.encodedBodySize !== timing.decodedBodySize) {
    responseRows.push({
      label: t('workbench.editors.request.response.meta.rowCompressed'),
      text: formatBytes(timing.encodedBodySize),
    });
  }
  if (wireSizesExposed && timing.transferSize > 0) {
    responseRows.push({
      label: t('workbench.editors.request.response.meta.rowTransferred'),
      text: formatBytes(timing.transferSize),
    });
  }

  const notes: string[] = [t('workbench.editors.request.response.meta.noteHeaderBytes')];
  if (response.requestSize) {
    notes.push(t('workbench.editors.request.response.meta.noteRequestHeaders'));
  }
  if (response.bodyTruncated) {
    // `bodyCapBytes` records the cap this send actually ran under (a
    // user setting or per-request limit) — label it when present.
    notes.push(
      response.bodyCapBytes !== undefined
        ? t('workbench.editors.request.response.meta.noteTruncatedAtCap', {
            cap: formatBytes(response.bodyCapBytes),
          })
        : t('workbench.editors.request.response.meta.noteTruncated'),
    );
  }
  if (response.requestSize?.bodyApproximate) {
    notes.push(t('workbench.editors.request.response.meta.noteBodyApproximate'));
  }
  if (!wireSizesExposed) {
    notes.push(t('workbench.editors.request.response.meta.noteWireHidden'));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
      <SizeStatSection
        direction="down"
        title={t('workbench.editors.request.response.meta.responseSize')}
        totalText={formatBytes(headersBytes + response.bodyBytes)}
        rows={responseRows}
      />
      {response.requestSize && (
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 10 }}>
          <SizeStatSection
            direction="up"
            title={t('workbench.editors.request.response.meta.requestSize')}
            totalText={formatBytes(response.requestSize.headersBytes + response.requestSize.bodyBytes)}
            rows={[
              {
                label: t('workbench.editors.request.response.meta.rowHeaders'),
                text: formatBytes(response.requestSize.headersBytes),
              },
              {
                label: t('workbench.editors.request.response.meta.rowBody'),
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

function sizeContent(response: ExecutedRequestSnapshot, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.sizeTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.sizeSummary'),
    description: <SizeStats response={response} />,
  };
}

/** The globe popover's body: connection-level facts we can honestly
 *  hold, with per-fact absence explained in footnotes. */
function NetworkFacts({ response }: { response: ExecutedRequestSnapshot }) {
  const { token } = theme.useToken();
  const t = useT();
  const versionLabel = response.timing ? httpVersionLabel(response.timing.nextHopProtocol) : null;
  const ip = response.wire?.ip;

  const rows: Array<{ label: string; value: string }> = [
    { label: t('workbench.editors.request.response.meta.httpVersion'), value: versionLabel ?? '—' },
    { label: t('workbench.editors.request.response.meta.remoteAddress'), value: ip ?? '—' },
  ];
  const notes: string[] = [];
  if (!versionLabel) {
    // Absence reads differently per runtime: the browser withheld a
    // timing entry; the node stack never reports the negotiated
    // protocol at all (its fetch exposes no such fact).
    notes.push(
      (getCapability('requestRuntime')?.() ?? 'browser') === 'node'
        ? t('workbench.editors.request.response.meta.noteVersionHiddenNode')
        : t('workbench.editors.request.response.meta.noteVersionHiddenBrowser'),
    );
  }
  if (ip === undefined) notes.push(t('workbench.editors.request.response.meta.noteNoIp'));
  notes.push(t('workbench.editors.request.response.meta.noteNoTls'));

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
function unverifiedTlsContent(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.unverifiedTlsTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.unverifiedTlsSummary'),
  };
}

/** Popover for the warning tag on a run whose per-request TLS floor
 *  sat below the runtime's 1.2 default — the snapshot records the
 *  policy the send actually ran under. */
function tlsFloorLoweredContent(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.tlsFloorLowered'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.tlsFloorLoweredSummary'),
  };
}

/** Popover for the warning tag on a run whose redirect chain actually
 *  re-sent the Authorization header across origins — stamped only when
 *  the `followAuthorizationHeader` opt-in fired, not merely configured. */
function authForwardedContent(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.authForwarded'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.authForwardedSummary'),
  };
}

/** Body of the redirects popover: the per-hop chain the send followed
 *  — each hop's request line, the 3xx + Location it answered, and the
 *  method/auth transitions where they happened — then the final
 *  response the snapshot itself holds. Recorded by the executing
 *  host's redirect follower; pure attribution. */
function RedirectChainFacts({ response }: { response: ExecutedRequestSnapshot }) {
  const { token } = theme.useToken();
  const t = useT();
  const chain = response.redirectChain ?? [];
  const requestLine: React.CSSProperties = { fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' };
  const noteLine: React.CSSProperties = { fontSize: 11, color: token.colorTextTertiary };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260, maxWidth: 420 }}>
      {chain.map((hop, index) => (
        <div
          key={`${index}-${hop.url}`}
          data-testid="oh-response-redirect-hop"
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <span style={requestLine}>
            {hop.method} {hop.url}
          </span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            → {hop.status}
            {hop.statusText ? ` ${hop.statusText}` : ''} · Location: {hop.location}
          </span>
          {hop.methodChangedTo !== undefined && (
            <span style={noteLine}>
              {t('workbench.editors.request.response.meta.redirectMethodChanged', { method: hop.methodChangedTo })}
            </span>
          )}
          {hop.authorization === 'stripped' && (
            <span style={noteLine}>{t('workbench.editors.request.response.meta.redirectAuthStripped')}</span>
          )}
          {hop.authorization === 'forwarded' && (
            <span style={{ fontSize: 11, color: token.colorWarning }}>
              {t('workbench.editors.request.response.meta.redirectAuthForwarded')}
            </span>
          )}
        </div>
      ))}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={requestLine}>{response.url}</span>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
          → {response.status}
          {response.statusText ? ` ${response.statusText}` : ''} ·{' '}
          {t('workbench.editors.request.response.meta.redirectFinal')}
        </span>
      </div>
    </div>
  );
}

/** Popover for the neutral tag on a run that followed redirects —
 *  attribution of the chain the send actually chased (informational,
 *  like the cookie-jar tag): each hop as sent, recorded at run time. */
function redirectChainContent(response: ExecutedRequestSnapshot, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.redirectsTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.redirectsSummary'),
    description: <RedirectChainFacts response={response} />,
  };
}

/** Tag label for a streamed capture — how the stream ended. */
function streamedTagLabel(endedBy: NonNullable<ExecutedRequestSnapshot['streamedCapture']>['endedBy'], t: Translate) {
  switch (endedBy) {
    case 'end':
      return t('workbench.editors.request.response.meta.streamedEnd');
    case 'stop':
      return t('workbench.editors.request.response.meta.streamedStop');
    case 'cap':
      return t('workbench.editors.request.response.meta.streamedCap');
    case 'timeout':
      return t('workbench.editors.request.response.meta.streamedTimeout');
    case 'error':
      return t('workbench.editors.request.response.meta.streamedError');
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return '';
    }
  }
}

/** Popover for the streamed-capture tag — attribution of how a live
 *  stream ended and, for stop/cap/timeout/error, that the body is the
 *  partial capture up to that point ("stop and snapshot"). */
function streamedCaptureContent(
  capture: NonNullable<ExecutedRequestSnapshot['streamedCapture']>,
  t: Translate,
): InfoPopoverContent {
  const summary =
    capture.endedBy === 'end'
      ? t('workbench.editors.request.response.meta.streamedEndSummary')
      : t('workbench.editors.request.response.meta.streamedPartialSummary');
  return {
    title: streamedTagLabel(capture.endedBy, t),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary,
    ...(capture.message !== undefined ? { description: capture.message } : {}),
  };
}

/** Body of the cookie-jar popover: what the jar attached on the first
 *  hop and what it stored across the chain — the snapshot's record of
 *  what the send actually did, never a live jar read. */
function CookieJarFacts({ response }: { response: ExecutedRequestSnapshot }) {
  const { token } = theme.useToken();
  const t = useT();
  const captured = response.cookiesCaptured ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220, maxWidth: 360 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.editors.request.response.meta.jarAttachedLabel')}
        </span>
        {response.cookieHeaderAttached !== undefined ? (
          <span style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            Cookie: {response.cookieHeaderAttached}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
            {t('workbench.editors.request.response.meta.jarAttachedNone')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.editors.request.response.meta.jarStoredLabel')}
        </span>
        {captured.length > 0 ? (
          <span style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{captured.join(', ')}</span>
        ) : (
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
            {t('workbench.editors.request.response.meta.jarStoredNone')}
          </span>
        )}
      </div>
    </div>
  );
}

/** Popover for the neutral tag on a run sent with its cookie-jar knob
 *  on — attribution of what the jar did (informational), unlike the
 *  warning tags above: using the jar relaxes no trust decision. */
function cookieJarContent(response: ExecutedRequestSnapshot, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.cookieJar'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.cookieJarSummary'),
    description: <CookieJarFacts response={response} />,
  };
}

/** Popover for the neutral tag on a run a REMOTE host executed on this
 *  surface's behalf (a forwarded send answered by the connected
 *  back-end) — attribution of where the egress connection was actually
 *  made, stamped by the answering host at run time. */
function executedOnContent(name: string, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.executedOnTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.executedOnSummary', { name }),
  };
}

function networkContent(response: ExecutedRequestSnapshot, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.networkTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.request.response.meta.networkSummary'),
    description: <NetworkFacts response={response} />,
  };
}

interface ResponseMetaStripProps {
  response: ExecutedRequestSnapshot;
  /** Status-range tint computed by the panel (theme tokens live there). */
  statusColor: string;
}

/** Tiny round separator between the strip's facts — shared with the
 *  live variant so both phases align identically. */
export const MetaDot: React.FC = () => {
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
  const t = useT();
  const factStyle: React.CSSProperties = { fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' };
  // The strip leads with the on-wire size when the server exposes it
  // (matches devtools' Size column); decoded bytes otherwise. The
  // popover carries both figures either way. Streamed captures always
  // show the captured bytes — the browser's timing entry for a send
  // stopped mid-stream reports a stale, near-empty transfer figure.
  const stripBytes =
    response.streamedCapture === undefined && response.timing && response.timing.transferSize > 0
      ? response.timing.transferSize
      : response.bodyBytes;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <InfoPopover content={getStatusCodeInfoContent(t, response.status, response.statusText)} trigger="hover">
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
      <InfoPopover content={timingContent(response, t)} trigger="hover">
        <Text type="secondary" data-testid="oh-response-duration" style={factStyle}>
          {formatDurationRolled(response.durationMs)}
        </Text>
      </InfoPopover>
      <MetaDot />
      <InfoPopover content={sizeContent(response, t)} trigger="hover">
        <Text type="secondary" style={factStyle}>
          {formatBytes(stripBytes)}
        </Text>
      </InfoPopover>
      {response.sslVerificationDisabled && (
        <>
          <MetaDot />
          <InfoPopover content={unverifiedTlsContent(t)} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-tls-unverified"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              {t('workbench.editors.request.response.meta.tagUnverifiedTls')}
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.tlsFloorLowered && (
        <>
          <MetaDot />
          <InfoPopover content={tlsFloorLoweredContent(t)} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-tls-floor-lowered"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              {t('workbench.editors.request.response.meta.tlsFloorLowered')}
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.authorizationForwarded && (
        <>
          <MetaDot />
          <InfoPopover content={authForwardedContent(t)} trigger="hover">
            <Tag
              color="warning"
              data-testid="oh-response-auth-forwarded"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              {t('workbench.editors.request.response.meta.authForwarded')}
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.redirectChain !== undefined && response.redirectChain.length > 0 && (
        <>
          <MetaDot />
          <InfoPopover content={redirectChainContent(response, t)} trigger="hover">
            <Tag color="default" data-testid="oh-response-redirects" style={{ marginInlineEnd: 0, cursor: 'help' }}>
              {t('workbench.editors.request.response.meta.redirects', { count: response.redirectChain.length })}
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.streamedCapture !== undefined && (
        <>
          <MetaDot />
          <InfoPopover content={streamedCaptureContent(response.streamedCapture, t)} trigger="hover">
            <Tag
              color={response.streamedCapture.endedBy === 'end' ? 'default' : 'warning'}
              data-testid="oh-response-streamed"
              style={{ marginInlineEnd: 0, cursor: 'help' }}
            >
              {streamedTagLabel(response.streamedCapture.endedBy, t)}
            </Tag>
          </InfoPopover>
        </>
      )}
      {response.executedOn !== undefined && (
        <>
          <MetaDot />
          <InfoPopover content={executedOnContent(response.executedOn.name, t)} trigger="hover">
            <Tag color="default" data-testid="oh-response-executed-on" style={{ marginInlineEnd: 0, cursor: 'help' }}>
              {t('workbench.editors.request.response.meta.executedOnTag', { name: response.executedOn.name })}
            </Tag>
          </InfoPopover>
        </>
      )}
      {(response.cookieHeaderAttached !== undefined || response.cookiesCaptured !== undefined) && (
        <>
          <MetaDot />
          <InfoPopover content={cookieJarContent(response, t)} trigger="hover">
            <Tag color="default" data-testid="oh-response-cookie-jar" style={{ marginInlineEnd: 0, cursor: 'help' }}>
              {t('workbench.editors.request.response.meta.cookieJar')}
            </Tag>
          </InfoPopover>
        </>
      )}
      <MetaDot />
      <InfoPopover content={networkContent(response, t)} trigger="hover">
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
