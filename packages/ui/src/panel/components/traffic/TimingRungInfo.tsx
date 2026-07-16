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
 *
 * Rung and terminal titles stay raw — they name the raw rung rows and the
 * Status-cell labels (browser parity vocabulary) — as do the wire tokens
 * in item labels (csp, net::ERR_…, the schematic strip segment names).
 * Band / moment / notes titles reuse the keys of the labels they name.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { TimingBand, TimingRungKey } from '../../data/timing/timing-ladder';
import { bandLabel } from '../../data/timing/timing-popover-model';

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

function momentLabel(t: Translate, moment: StripMoment): string {
  switch (moment) {
    case 'queued':
      return t('panel.network.timing.moment.queued');
    case 'started':
      return t('panel.network.timing.moment.started');
    case 'response':
      return t('panel.network.timing.moment.response');
    case 'ended':
      return t('panel.network.timing.moment.ended');
  }
}

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

function isMoment(h: StripHighlight): h is StripMoment {
  return h === 'queued' || h === 'started' || h === 'response' || h === 'ended';
}

function isBand(h: StripHighlight): h is TimingBand {
  return h === 'before-wire' || h === 'connecting' || h === 'exchange';
}

/** The caption under the strip, naming exactly what is lit / marked. */
function stripLine(t: Translate, highlight: StripHighlight): string {
  if (highlight === 'stop') return t('panel.network.rungInfo.stripStop');
  if (isMoment(highlight)) {
    return t('panel.network.rungInfo.stripMarked', { label: momentLabel(t, highlight), ms: momentAtMs(highlight) });
  }
  if (highlight === 'gap') return t('panel.network.rungInfo.stripGaps');
  if (isBand(highlight)) {
    const segs = EXAMPLE_STRIP.filter((s) => s.band === highlight);
    const sum = segs.reduce((a, s) => a + s.ms, 0);
    return t('panel.network.rungInfo.stripHighlighted', { segs: segs.map((s) => s.label).join(' + '), ms: sum });
  }
  const seg = EXAMPLE_STRIP.find((s) => s.id === highlight);
  return t('panel.network.rungInfo.stripHighlighted', { segs: seg?.label ?? '', ms: seg?.ms ?? 0 });
}

/**
 * The shared example timing strip. A phase / band / gap `highlight` lights
 * its segment(s) and dims the rest; a moment draws a boundary marker at its
 * instant instead; `stop` lights everything up to a red stop line and dims
 * the phases that never ran. Every segment keeps its proportional width
 * with a small floor so the sub-ms phases stay visible.
 */
function ExampleStrip({ highlight }: { highlight: StripHighlight }) {
  const t = useT();
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
      <div className="dt-rung-eg-cap">{t('panel.network.rungInfo.stripCaption', { ms: EXAMPLE_TOTAL_MS })}</div>
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
      <div className="dt-rung-eg-line">{stripLine(t, highlight)}</div>
    </div>
  );
}

function rungInfo(t: Translate, rung: TimingRungKey): InfoPopoverContent {
  const kicker = t('panel.network.rungInfo.kicker');
  switch (rung) {
    case 'queueing':
      return {
        title: 'Queueing',
        kicker,
        summary: t('panel.network.rungInfo.queueing.summary'),
        description: t('panel.network.rungInfo.queueing.description'),
        diagram: <ExampleStrip highlight="queueing" />,
      };
    case 'stalled':
      return {
        title: 'Stalled',
        kicker,
        summary: t('panel.network.rungInfo.stalled.summary'),
        description: t('panel.network.rungInfo.stalled.description'),
        diagram: <ExampleStrip highlight="stalled" />,
      };
    case 'dns':
      return {
        title: 'DNS Lookup',
        kicker,
        summary: t('panel.network.rungInfo.dns.summary'),
        description: t('panel.network.rungInfo.dns.description'),
        diagram: <ExampleStrip highlight="dns" />,
      };
    case 'connect':
      return {
        title: 'TCP',
        kicker,
        summary: t('panel.network.rungInfo.connect.summary'),
        description: t('panel.network.rungInfo.connect.description'),
        diagram: <ExampleStrip highlight="connect" />,
      };
    case 'ssl':
      return {
        title: 'TLS',
        kicker,
        summary: t('panel.network.rungInfo.ssl.summary'),
        description: t('panel.network.rungInfo.ssl.description'),
        diagram: <ExampleStrip highlight="ssl" />,
      };
    case 'send':
      return {
        title: 'Request sent',
        kicker,
        summary: t('panel.network.rungInfo.send.summary'),
        description: t('panel.network.rungInfo.send.description'),
        diagram: <ExampleStrip highlight="send" />,
      };
    case 'wait':
      return {
        title: 'Waiting for server',
        kicker,
        summary: t('panel.network.rungInfo.wait.summary'),
        description: t('panel.network.rungInfo.wait.description'),
        diagram: <ExampleStrip highlight="wait" />,
      };
    case 'receive':
      return {
        title: 'Content Download',
        kicker,
        summary: t('panel.network.rungInfo.receive.summary'),
        description: t('panel.network.rungInfo.receive.description'),
        diagram: <ExampleStrip highlight="receive" />,
      };
  }
}

function timingNotesInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.timing.timingNotes'),
    kicker: t('panel.network.rungInfo.kicker'),
    summary: t('panel.network.rungInfo.notes.summary'),
    description: t('panel.network.rungInfo.notes.description'),
    diagram: <ExampleStrip highlight="gap" />,
    sections: [
      {
        heading: t('panel.network.rungInfo.notes.linesHeading'),
        items: [
          {
            label: t('panel.network.rungInfo.notes.gapsLabel'),
            desc: t('panel.network.rungInfo.notes.gapsDesc'),
          },
          {
            label: t('panel.network.rungInfo.notes.chromeLabel'),
            desc: t('panel.network.rungInfo.notes.chromeDesc'),
          },
        ],
      },
    ],
  };
}

function bandInfo(t: Translate, band: TimingBand): InfoPopoverContent {
  const title = bandLabel(t, band);
  switch (band) {
    case 'before-wire':
      return {
        title,
        kicker: t('panel.network.rungInfo.kickerBrowser'),
        summary: t('panel.network.rungInfo.band.beforeWire.summary'),
        description: t('panel.network.rungInfo.band.beforeWire.description'),
        diagram: <ExampleStrip highlight="before-wire" />,
      };
    case 'connecting':
      return {
        title,
        kicker: t('panel.network.rungInfo.kickerBrowserNetwork'),
        summary: t('panel.network.rungInfo.band.connecting.summary'),
        description: t('panel.network.rungInfo.band.connecting.description'),
        diagram: <ExampleStrip highlight="connecting" />,
      };
    case 'exchange':
      return {
        title,
        kicker: t('panel.network.rungInfo.kickerNetwork'),
        summary: t('panel.network.rungInfo.band.exchange.summary'),
        description: t('panel.network.rungInfo.band.exchange.description'),
        diagram: <ExampleStrip highlight="exchange" />,
      };
  }
}

function momentInfo(t: Translate, moment: StripMoment): InfoPopoverContent {
  const kicker = t('panel.network.rungInfo.kickerInstant');
  switch (moment) {
    case 'queued':
      return {
        title: momentLabel(t, moment),
        kicker,
        summary: t('panel.network.rungInfo.moment.queued.summary'),
        description: t('panel.network.rungInfo.moment.queued.description'),
        diagram: <ExampleStrip highlight="queued" />,
      };
    case 'started':
      return {
        title: momentLabel(t, moment),
        kicker,
        summary: t('panel.network.rungInfo.moment.started.summary'),
        description: t('panel.network.rungInfo.moment.started.description'),
        diagram: <ExampleStrip highlight="started" />,
      };
    case 'response':
      return {
        title: momentLabel(t, moment),
        kicker,
        summary: t('panel.network.rungInfo.moment.response.summary'),
        description: t('panel.network.rungInfo.moment.response.description'),
        diagram: <ExampleStrip highlight="response" />,
      };
    case 'ended':
      return {
        title: momentLabel(t, moment),
        kicker,
        summary: t('panel.network.rungInfo.moment.ended.summary'),
        description: t('panel.network.rungInfo.moment.ended.description'),
        diagram: <ExampleStrip highlight="ended" />,
      };
  }
}

function keyMomentsInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.timing.keyMoments'),
    kicker: t('panel.network.rungInfo.kicker'),
    summary: t('panel.network.rungInfo.keyMoments.summary'),
    description: t('panel.network.rungInfo.keyMoments.description'),
    diagram: <ExampleStrip highlight="started" />,
  };
}

/** Status-cell label families a terminal stop marker can carry. */
type TerminalFamily = 'canceled' | 'blocked' | 'cors' | 'failed';

function terminalFamily(label: string): TerminalFamily {
  if (label.startsWith('(canceled')) return 'canceled';
  if (label.startsWith('(blocked')) return 'blocked';
  if (label.startsWith('CORS')) return 'cors';
  return 'failed';
}

/** Shared section explaining the marker's one-line detail wording. */
function terminalWhereSection(t: Translate) {
  return {
    heading: t('panel.network.rungInfo.terminal.whereHeading'),
    items: [
      {
        label: t('panel.network.timing.terminalDetail.noResponse'),
        desc: t('panel.network.rungInfo.terminal.noResponseDesc'),
      },
      {
        label: t('panel.network.timing.terminalDetail.neverReached'),
        desc: t('panel.network.rungInfo.terminal.neverReachedDesc'),
      },
    ],
  };
}

function terminalInfo(t: Translate, family: TerminalFamily): InfoPopoverContent {
  const kicker = t('panel.network.rungInfo.kickerOutcome');
  const diagram = <ExampleStrip highlight="stop" />;
  switch (family) {
    case 'canceled':
      return {
        title: '(canceled)',
        kicker,
        summary: t('panel.network.rungInfo.terminal.canceled.summary'),
        description: t('panel.network.rungInfo.terminal.canceled.description'),
        diagram,
        sections: [terminalWhereSection(t)],
      };
    case 'blocked':
      return {
        title: '(blocked:reason)',
        kicker,
        summary: t('panel.network.rungInfo.terminal.blocked.summary'),
        description: t('panel.network.rungInfo.terminal.stoppedHere'),
        diagram,
        sections: [
          {
            heading: t('panel.network.rungInfo.terminal.blocked.reasonsHeading'),
            items: [
              { label: 'csp', desc: t('panel.network.rungInfo.terminal.blocked.cspDesc') },
              { label: 'mixed-content', desc: t('panel.network.rungInfo.terminal.blocked.mixedContentDesc') },
              { label: 'other', desc: t('panel.network.rungInfo.terminal.blocked.otherDesc') },
            ],
          },
          terminalWhereSection(t),
        ],
      };
    case 'cors':
      return {
        title: 'CORS error',
        kicker,
        summary: t('panel.network.rungInfo.terminal.cors.summary'),
        description: t('panel.network.rungInfo.terminal.cors.description'),
        diagram,
        sections: [terminalWhereSection(t)],
      };
    case 'failed':
      return {
        title: '(failed) net::ERR_…',
        kicker,
        summary: t('panel.network.rungInfo.terminal.failed.summary'),
        description: t('panel.network.rungInfo.terminal.stoppedHere'),
        diagram,
        sections: [
          {
            heading: t('panel.network.rungInfo.terminal.failed.codesHeading'),
            items: [
              { label: 'ERR_NAME_NOT_RESOLVED', desc: t('panel.network.rungInfo.terminal.failed.nameNotResolvedDesc') },
              {
                label: 'ERR_CONNECTION_REFUSED / _RESET',
                desc: t('panel.network.rungInfo.terminal.failed.connectionRefusedDesc'),
              },
              { label: 'ERR_TIMED_OUT', desc: t('panel.network.rungInfo.terminal.failed.timedOutDesc') },
              { label: 'ERR_CERT_…', desc: t('panel.network.rungInfo.terminal.failed.certDesc') },
            ],
          },
          terminalWhereSection(t),
        ],
      };
  }
}

/** Hover-revealed `(i)` for a terminal stop marker (`✗ (blocked:other)`, …).
 * The popover title carries the row's own label so the explanation reads
 * specific, while the body explains its family. */
export function TimingTerminalInfo({ label }: { label: string }) {
  const t = useT();
  const content = { ...terminalInfo(t, terminalFamily(label)), title: label };
  return <InfoTrigger content={content} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for one ladder phase row. */
export function TimingRungInfo({ rung }: { rung: TimingRungKey }) {
  const t = useT();
  return <InfoTrigger content={rungInfo(t, rung)} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for a phase-group (band) head or bracket. */
export function TimingBandInfo({ band }: { band: TimingBand }) {
  const t = useT();
  return <InfoTrigger content={bandInfo(t, band)} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for one key-moment instant (Queued / Started / …). */
export function TimingMomentInfo({ moment }: { moment: StripMoment }) {
  const t = useT();
  return <InfoTrigger content={momentInfo(t, moment)} className="dt-wf-rung-info-trigger" />;
}

/** Hover-revealed `(i)` for the "Key moments" section head. */
export function TimingKeyMomentsInfo() {
  const t = useT();
  return <InfoTrigger content={keyMomentsInfo(t)} className="dt-wf-rung-info-trigger" />;
}

/** `(i)` for the "Timing notes" section head (untracked gaps + Chrome mapping). */
export function TimingNotesInfo() {
  const t = useT();
  return (
    <InfoTrigger content={timingNotesInfo(t)} className="dt-wf-rung-info-trigger dt-wf-notes-info-trigger" />
  );
}
