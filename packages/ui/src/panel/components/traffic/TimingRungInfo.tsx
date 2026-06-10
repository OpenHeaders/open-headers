/**
 * Per-phase `(i)` info-popover content for the timing ladder — the same
 * pattern as the network table's `NetworkColumnInfo`: a hover-revealed
 * glyph that opens an `<InfoPopover>`.
 *
 * Every popover leads with the same canonical example request rendered as
 * one compact timing strip; the phase's own slice of that strip is the
 * highlighted segment, so reading across all the popovers builds one
 * coherent picture of a single request seen phase by phase. The strip
 * deliberately includes the two untracked gaps (the slivers between
 * phases the network stack attributes to neither side), so the
 * "Timing notes" popover can light them up the same way.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { TimingBand, TimingRungKey } from '../../data/timing-ladder';

/** One canonical example request, in wire order. `gap` slots are the
 * untracked slivers between phases; ms values are schematic but realistic
 * (a cold HTTPS request totaling ~322 ms). */
const EXAMPLE_STRIP: ReadonlyArray<{ id: TimingRungKey | 'gap'; band?: TimingBand; ms: number; label: string }> = [
  { id: 'queueing', band: 'before-wire', ms: 2, label: 'Queueing' },
  { id: 'stalled', band: 'before-wire', ms: 4, label: 'Stalled' },
  { id: 'dns', band: 'connecting', ms: 28, label: 'DNS' },
  { id: 'gap', ms: 3, label: 'gap' },
  { id: 'connect', band: 'connecting', ms: 40, label: 'TCP' },
  { id: 'ssl', band: 'connecting', ms: 36, label: 'TLS' },
  { id: 'gap', ms: 4, label: 'gap' },
  { id: 'send', band: 'exchange', ms: 2, label: 'Send' },
  { id: 'wait', band: 'exchange', ms: 110, label: 'Waiting' },
  { id: 'receive', band: 'exchange', ms: 93, label: 'Download' },
];

const EXAMPLE_TOTAL_MS = EXAMPLE_STRIP.reduce((a, s) => a + s.ms, 0);

export type StripMoment = 'queued' | 'started' | 'response' | 'ended';

/** `stop` illustrates a terminal request: lit up to the stop line, never past it. */
type StripHighlight = TimingRungKey | 'gap' | TimingBand | StripMoment | 'stop';

/** Where the example's terminal request dies: right after its DNS lookup. */
const STOP_AT_MS = 34;

const MOMENT_LABEL: Record<StripMoment, string> = {
  queued: 'Queued',
  started: 'Started',
  response: 'Response',
  ended: 'Ended',
};

/** Cumulative ms position of a moment on the example strip — the boundary
 * instant the moment marks. */
function momentAtMs(moment: StripMoment): number {
  if (moment === 'queued') return 0;
  if (moment === 'ended') return EXAMPLE_TOTAL_MS;
  const upTo = moment === 'started' ? 'queueing' : 'wait';
  let acc = 0;
  for (const seg of EXAMPLE_STRIP) {
    acc += seg.ms;
    if (seg.id === upTo) return acc;
  }
  return acc;
}

const BAND_IDS: Record<TimingBand, ReadonlyArray<TimingRungKey>> = {
  'before-wire': ['queueing', 'stalled'],
  connecting: ['dns', 'connect', 'ssl'],
  exchange: ['send', 'wait', 'receive'],
};

function isMoment(h: StripHighlight): h is StripMoment {
  return h === 'queued' || h === 'started' || h === 'response' || h === 'ended';
}

function isBand(h: StripHighlight): h is TimingBand {
  return h === 'before-wire' || h === 'connecting' || h === 'exchange';
}

/** The caption under the strip, naming exactly what is lit / marked. */
function stripLine(highlight: StripHighlight): string {
  if (highlight === 'stop') return 'marked: where the request stopped — the later phases never ran';
  if (isMoment(highlight)) return `marked: ${MOMENT_LABEL[highlight]} at ${momentAtMs(highlight)} ms`;
  if (highlight === 'gap') return 'highlighted: the untracked gaps (3 + 4 ms)';
  if (isBand(highlight)) {
    const segs = EXAMPLE_STRIP.filter((s) => s.band === highlight);
    const sum = segs.reduce((a, s) => a + s.ms, 0);
    return `highlighted: ${segs.map((s) => s.label).join(' + ')} (${sum} ms)`;
  }
  const seg = EXAMPLE_STRIP.find((s) => s.id === highlight);
  return `highlighted: ${seg?.label} (${seg?.ms} ms)`;
}

/**
 * The shared example timing strip. A phase / band / gap `highlight` lights
 * its segment(s) and dims the rest; a moment draws a boundary marker at its
 * instant instead; `stop` lights everything up to a red stop line and dims
 * the phases that never ran. Every segment keeps its proportional width
 * with a small floor so the sub-ms phases stay visible.
 */
function ExampleStrip({ highlight }: { highlight: StripHighlight }) {
  const marker = highlight === 'stop' ? STOP_AT_MS : isMoment(highlight) ? momentAtMs(highlight) : null;
  let cursor = 0;
  const lit = (seg: (typeof EXAMPLE_STRIP)[number], startMs: number): boolean => {
    if (highlight === 'stop') return startMs + seg.ms <= STOP_AT_MS;
    if (isMoment(highlight)) return false;
    if (isBand(highlight)) return seg.band === highlight;
    return seg.id === highlight;
  };
  return (
    <div className="dt-rung-eg">
      <div className="dt-rung-eg-cap">Example request — {EXAMPLE_TOTAL_MS} ms end to end</div>
      <div className="dt-rung-eg-track">
        {EXAMPLE_STRIP.map((seg, i) => {
          const startMs = cursor;
          cursor += seg.ms;
          const cls = [
            'dt-rung-eg-seg',
            seg.id === 'gap' ? 'dt-rung-eg-seg--gap' : `dt-wf-fill--${seg.id}`,
            lit(seg, startMs) ? 'dt-rung-eg-seg--hl' : 'dt-rung-eg-seg--dim',
          ].join(' ');
          return <span key={`${seg.id}-${i}`} className={cls} style={{ flexGrow: seg.ms }} title={seg.label} />;
        })}
        {marker !== null && (
          <span
            className={`dt-rung-eg-marker${highlight === 'stop' ? ' dt-rung-eg-marker--stop' : ''}`}
            style={{ left: `${(marker / EXAMPLE_TOTAL_MS) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="dt-rung-eg-line">{stripLine(highlight)}</div>
    </div>
  );
}

const RUNG_INFO: Record<TimingRungKey, InfoPopoverContent> = {
  queueing: {
    title: 'Queueing',
    kicker: 'Timing',
    summary: 'Time the request spent waiting in the browser before it was allowed to start.',
    description:
      'The browser defers requests for lower-priority resources, while higher-priority ones load first, and while it checks the disk cache. On HTTP/1.x it also waits here when all sockets to the host are busy.',
    diagram: <ExampleStrip highlight="queueing" />,
  },
  stalled: {
    title: 'Stalled',
    kicker: 'Timing',
    summary: 'Allowed to start, but waiting for a usable connection before any network work could begin.',
    description: 'Typically waiting for a socket to become available or for a proxy decision. Ends the moment the first network step (DNS, TCP, or sending) starts.',
    diagram: <ExampleStrip highlight="stalled" />,
  },
  dns: {
    title: 'DNS Lookup',
    kicker: 'Timing',
    summary: 'Resolving the host name to an IP address to connect to.',
    description: 'Shows "connection reused" when the request rode an already-open connection — no lookup was needed on this request\'s clock.',
    diagram: <ExampleStrip highlight="dns" />,
  },
  connect: {
    title: 'TCP',
    kicker: 'Timing',
    summary: 'The TCP handshake only — the round trip that opens the socket to the server.',
    description:
      'Chrome\'s Timing tab draws one "Initial connection" bar spanning this AND the TLS handshake (its SSL bar is drawn inside it). We split them into separate, non-overlapping phases so every millisecond is counted exactly once — TCP + TLS here equals Chrome\'s Initial connection bar.',
    diagram: <ExampleStrip highlight="connect" />,
  },
  ssl: {
    title: 'TLS',
    kicker: 'Timing',
    summary: 'The TLS handshake — negotiating keys and verifying certificates so the connection is encrypted.',
    description: 'Only on https:// requests (n/a on plain http://). "Connection reused" means an earlier request already paid this cost on the same socket.',
    diagram: <ExampleStrip highlight="ssl" />,
  },
  send: {
    title: 'Request sent',
    kicker: 'Timing',
    summary: 'Pushing the request bytes — headers and any body — onto the wire.',
    description: 'Usually well under a millisecond for header-only requests; grows with large uploads.',
    diagram: <ExampleStrip highlight="send" />,
  },
  wait: {
    title: 'Waiting for server',
    kicker: 'Timing',
    summary: 'From the last request byte sent to the first response byte received (time to first byte).',
    description: 'Server think time plus one network round trip — the phase backend work shows up in.',
    diagram: <ExampleStrip highlight="wait" />,
  },
  receive: {
    title: 'Content Download',
    kicker: 'Timing',
    summary: 'Downloading the response body, first byte to last.',
    description: 'Grows live while a response is still streaming; the caution line below the chart flags a download that never finished.',
    diagram: <ExampleStrip highlight="receive" />,
  },
};

const TIMING_NOTES_INFO: InfoPopoverContent = {
  title: 'Timing notes',
  kicker: 'Timing',
  summary:
    'Bookkeeping for the slivers of time between phases — recorded end to end, but belonging to no phase.',
  description:
    'Each phase is measured between its own start and stop instants, while the total is measured end to end — so tiny "untracked gaps" can sit between two phases (e.g. between the DNS answer arriving and the TCP handshake starting). They are why the phases don\'t always sum to the total. Chrome\'s Timing tab has the same gaps and simply doesn\'t draw them; we list them so every millisecond stays accounted for.',
  diagram: <ExampleStrip highlight="gap" />,
  sections: [
    {
      heading: 'The lines',
      items: [
        {
          label: 'Untracked gaps',
          desc: 'Each gap, named by the phases around it, with its duration.',
        },
        {
          label: 'Chrome-equivalent',
          desc: 'How our split TCP + TLS phases map onto Chrome\'s single "Initial connection" bar (its SSL bar is drawn inside that bar, not after it).',
        },
      ],
    },
  ],
};

const BAND_INFO: Record<TimingBand, InfoPopoverContent> = {
  'before-wire': {
    title: 'Scheduling',
    kicker: 'Timing · Browser',
    summary: 'Time spent entirely inside the browser before any network work — nothing has left the machine yet.',
    description:
      'Queueing (waiting for permission to start) plus Stalled (waiting for a usable connection). A request heavy here is being held back locally — by priorities, connection limits, or proxy decisions — not by the server.',
    diagram: <ExampleStrip highlight="before-wire" />,
  },
  connecting: {
    title: 'Connecting',
    kicker: 'Timing · Browser ↔ Network',
    summary: 'Setting up the path to the server: resolve the name, open the socket, encrypt it.',
    description:
      'DNS Lookup + TCP + TLS — the handshake round trips. Paid once per connection: a request that rides an already-open socket skips this whole band ("connection reused").',
    diagram: <ExampleStrip highlight="connecting" />,
  },
  exchange: {
    title: 'Transferring',
    kicker: 'Timing · Network',
    summary: 'The actual exchange over the wire: send the request, wait for the server, download the response.',
    description:
      'Request sent + Waiting for server (TTFB) + Content Download. Server-side slowness shows up in Waiting; large responses or slow links show up in Content Download.',
    diagram: <ExampleStrip highlight="exchange" />,
  },
};

const MOMENT_INFO: Record<StripMoment, InfoPopoverContent> = {
  queued: {
    title: 'Queued',
    kicker: 'Timing · Instant',
    summary: 'The instant the browser created the request — the zero every phase in this breakdown measures from.',
    description: 'The "at" value is the offset from the first request in view, so rows can be compared on one shared clock.',
    diagram: <ExampleStrip highlight="queued" />,
  },
  started: {
    title: 'Started',
    kicker: 'Timing · Instant',
    summary: 'The instant the request left the queue and work on it actually began.',
    description: 'Queued + Queueing. Everything before this mark is browser scheduling; everything after is the request making real progress.',
    diagram: <ExampleStrip highlight="started" />,
  },
  response: {
    title: 'Response',
    kicker: 'Timing · Instant',
    summary: 'The instant the first response byte arrived (time to first byte).',
    description: 'The server has answered; from here the body is downloading. Absent when no response ever arrived (blocked or failed first).',
    diagram: <ExampleStrip highlight="response" />,
  },
  ended: {
    title: 'Ended',
    kicker: 'Timing · Instant',
    summary: 'The instant the last response byte arrived — the request is done.',
    description: 'Ended − Queued is the total time shown below the breakdown; Ended − Started is the active duration the Time column shows.',
    diagram: <ExampleStrip highlight="ended" />,
  },
};

const KEY_MOMENTS_INFO: InfoPopoverContent = {
  title: 'Key moments',
  kicker: 'Timing',
  summary: 'The boundary instants of the request\'s life — where one stage hands over to the next.',
  description:
    'Queued and Started always exist; Response and Ended only once a response actually arrived (a request that was blocked or failed first shows its outcome marker instead). The phases below are the spans between these instants.',
  diagram: <ExampleStrip highlight="started" />,
};

/** Status-cell label families a terminal stop marker can carry. */
type TerminalFamily = 'canceled' | 'blocked' | 'cors' | 'failed';

function terminalFamily(label: string): TerminalFamily {
  if (label.startsWith('(canceled')) return 'canceled';
  if (label.startsWith('(blocked')) return 'blocked';
  if (label.startsWith('CORS')) return 'cors';
  return 'failed';
}

/** Shared section explaining the marker's one-line detail wording. */
const TERMINAL_WHERE_SECTION = {
  heading: 'Where it stopped',
  items: [
    { label: 'no response received', desc: 'It reached the network, but no answer ever made it back.' },
    { label: 'never reached the network', desc: 'It died in browser-side scheduling — nothing was sent.' },
  ],
} as const;

const TERMINAL_INFO: Record<TerminalFamily, InfoPopoverContent> = {
  canceled: {
    title: '(canceled)',
    kicker: 'Timing · Outcome',
    summary: 'The request was aborted before it completed — the ✗ marks where it stopped; later phases never ran.',
    description:
      'Typical causes: the page navigated away mid-load, script aborted the fetch, or the user stopped the load. Nothing was wrong with the network — the browser simply gave up on the answer.',
    diagram: <ExampleStrip highlight="stop" />,
    sections: [TERMINAL_WHERE_SECTION],
  },
  blocked: {
    title: '(blocked:reason)',
    kicker: 'Timing · Outcome',
    summary: 'The browser refused the request for a policy reason — the word after the colon names which policy.',
    description: 'The ✗ marks where it stopped; later phases never ran.',
    diagram: <ExampleStrip highlight="stop" />,
    sections: [
      {
        heading: 'Common reasons',
        items: [
          { label: 'csp', desc: 'The page\'s Content-Security-Policy forbids this destination.' },
          { label: 'mixed-content', desc: 'An insecure http:// resource on an https:// page.' },
          { label: 'other', desc: 'An extension, ad-blocker, or an internal browser rule refused it.' },
        ],
      },
      TERMINAL_WHERE_SECTION,
    ],
  },
  cors: {
    title: 'CORS error',
    kicker: 'Timing · Outcome',
    summary: 'A cross-origin check rejected the response — the server answered, but the page was not allowed to read it.',
    description:
      'The server must opt in with Access-Control-Allow-Origin (and friends) for a cross-origin page to read its response. The ✗ marks where the rejection landed.',
    diagram: <ExampleStrip highlight="stop" />,
    sections: [TERMINAL_WHERE_SECTION],
  },
  failed: {
    title: '(failed) net::ERR_…',
    kicker: 'Timing · Outcome',
    summary: 'A wire-level failure — the connection itself broke, and the net:: code names the exact cause.',
    description: 'The ✗ marks where it stopped; later phases never ran.',
    diagram: <ExampleStrip highlight="stop" />,
    sections: [
      {
        heading: 'Common codes',
        items: [
          { label: 'ERR_NAME_NOT_RESOLVED', desc: 'DNS could not find the host.' },
          { label: 'ERR_CONNECTION_REFUSED / _RESET', desc: 'The server rejected or dropped the socket.' },
          { label: 'ERR_TIMED_OUT', desc: 'No answer within the network stack\'s time limit.' },
          { label: 'ERR_CERT_…', desc: 'The TLS certificate failed validation.' },
        ],
      },
      TERMINAL_WHERE_SECTION,
    ],
  },
};

/** Hover-revealed `(i)` for a terminal stop marker (`✗ (blocked:other)`, …).
 * The popover title carries the row's own label so the explanation reads
 * specific, while the body explains its family. */
export function TimingTerminalInfo({ label }: { label: string }) {
  const content = { ...TERMINAL_INFO[terminalFamily(label)], title: label };
  return <InfoTrigger content={content} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for one ladder phase row. */
export function TimingRungInfo({ rung }: { rung: TimingRungKey }) {
  return <InfoTrigger content={RUNG_INFO[rung]} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for a phase-group (band) head or bracket. */
export function TimingBandInfo({ band }: { band: TimingBand }) {
  return <InfoTrigger content={BAND_INFO[band]} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for one key-moment instant (Queued / Started / …). */
export function TimingMomentInfo({ moment }: { moment: StripMoment }) {
  return <InfoTrigger content={MOMENT_INFO[moment]} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for the "Key moments" section head. */
export function TimingKeyMomentsInfo() {
  return <InfoTrigger content={KEY_MOMENTS_INFO} className="dt-wf-rung-info-trigger" />;
}

/** `(i)` for the "Timing notes" section head (untracked gaps + Chrome mapping). */
export function TimingNotesInfo() {
  return <InfoTrigger content={TIMING_NOTES_INFO} className="dt-wf-rung-info-trigger dt-wf-notes-info-trigger" />;
}
