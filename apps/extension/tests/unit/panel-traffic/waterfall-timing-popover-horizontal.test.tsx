/**
 * Horizontal timing ladder popover — the X-axis twin of the vertical view.
 *
 * Renders the SAME {@link computeTimingLadder} output: all eight rungs in the
 * legend, real-only ▼ instant ticks (Response / Ended drop on a no-response
 * row, replaced by the outcome marker), the honest TCP value, the warm-socket
 * hint, reused attribution, and a click guard — each 1-to-1 with the vertical
 * popover, since both read one ladder.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { WaterfallTimingPopoverHorizontal } from '@openheaders/ui/panel/components/traffic/WaterfallTimingPopoverHorizontal';
import { layoutHorizontal } from '@openheaders/ui/panel/data/timing/horizontal-timing-layout';
import {
  computeTimingLadder,
  type LadderContext,
  type TimingLadder,
} from '@openheaders/ui/panel/data/timing/timing-ladder';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeHar } from '../../__factories__/lifecycle';

type Timings = NonNullable<InspectorHarEntry['timings']>;

function ladderOf(timings: Timings, ctx: Partial<LadderContext> = {}, url = 'https://openheaders.io/'): TimingLadder {
  const l = computeTimingLadder(makeHar(url, { timings }), { reachedResponse: true, isHttps: true, ...ctx });
  if (l == null) throw new Error('expected a ladder');
  return l;
}

function legendNames(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('.dt-wf-h-legend-name')).map((n) => n.textContent ?? '');
}
function legendItem(c: HTMLElement, name: string): Element | undefined {
  return Array.from(c.querySelectorAll('.dt-wf-h-legend-item')).find(
    (r) => r.querySelector('.dt-wf-h-legend-name')?.textContent === name,
  );
}
function legendValue(c: HTMLElement, name: string): string | undefined {
  const item = legendItem(c, name);
  // Elapsed rungs show their duration in `-ms`; absent rungs show the reason.
  const cell = item?.querySelector('.dt-waterfall-pop-ms') ?? item?.querySelector('.dt-waterfall-pop-absent-text');
  return cell?.textContent ?? undefined;
}
/** An element's text without any (i) info glyphs inside it. */
function textSansInfo(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const trigger of Array.from(clone.querySelectorAll('.oh-info-trigger'))) trigger.remove();
  return clone.textContent ?? '';
}
function tickLabels(c: HTMLElement): string[] {
  // The anchor tick appends a " ↓" cue; strip it so the name compares clean.
  return Array.from(c.querySelectorAll('.dt-wf-h-tick-label')).map((n) => textSansInfo(n).replace(/\s*↓$/, ''));
}
function bandBracketNames(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('.dt-wf-h-bracket-name')).map((n) => textSansInfo(n));
}
function bandBracketWheres(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('.dt-wf-h-bracket-label .dt-waterfall-pop-where')).map(
    (n) => n.textContent ?? '',
  );
}
function tickValue(c: HTMLElement, label: string): string | undefined {
  const tick = Array.from(c.querySelectorAll('.dt-wf-h-tick')).find((t) =>
    (t.querySelector('.dt-wf-h-tick-label')?.textContent ?? '').startsWith(label),
  );
  return tick?.querySelector('.dt-wf-h-tick-value')?.textContent ?? undefined;
}
function cellCount(c: HTMLElement): number {
  return c.querySelectorAll('.dt-wf-h-cell').length;
}
function absentCellCount(c: HTMLElement): number {
  return c.querySelectorAll('.dt-wf-h-cell--absent').length;
}

const NORMAL: Timings = {
  blocked: 15,
  _blocked_queueing: 10,
  dns: 20,
  connect: 65,
  ssl: 30,
  send: 5,
  wait: 100,
  receive: 40,
};
const REUSED: Timings = {
  blocked: 0.3,
  _blocked_queueing: 0,
  dns: -1,
  connect: -1,
  ssl: -1,
  send: 0.3,
  wait: 45,
  receive: 12,
};
const BLOCKED: Timings = {
  blocked: 1.98,
  _blocked_queueing: 0,
  dns: -1,
  connect: -1,
  ssl: -1,
  send: 0,
  wait: 0,
  receive: 0,
};

const ALL_EIGHT = [
  'Queueing',
  'Stalled',
  'DNS Lookup',
  'TCP',
  'TLS',
  'Request sent',
  'Waiting for server',
  'Content Download',
];

describe('WaterfallTimingPopoverHorizontal — always the full ladder', () => {
  it('lists all eight rungs, the three band brackets, and the wire span', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(legendNames(container)).toEqual(ALL_EIGHT);
    expect(bandBracketNames(container)).toEqual(['Scheduling', 'Connecting', 'Transferring']);
    expect(bandBracketWheres(container)).toEqual(['(Browser)', '(Browser ↔ Network)', '(Network)']);
    // One bar cell per rung (all eight present); none absent on a normal request.
    expect(cellCount(container)).toBe(8);
    expect(absentCellCount(container)).toBe(0);
    expect(container.querySelector('.dt-wf-h-wirespan')?.textContent).toContain('on the wire');
  });

  it('shows the four real instants and the honest TCP value for a normal request', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(tickLabels(container)).toEqual(['Queued', 'Started', 'Response', 'Ended']);
    expect(legendValue(container, 'TCP')).toBe('15.00ms'); // connect 45 − ssl 30
    expect(container.querySelector('.dt-waterfall-pop-total')?.textContent).toContain('Total time');
  });
});

describe('WaterfallTimingPopoverHorizontal — interaction', () => {
  it('does not bubble clicks to the row (React replays portal events up the tree)', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test stand-in for the row handler
      <div onClick={onRowClick}>
        <WaterfallTimingPopoverHorizontal ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />
      </div>,
    );
    (container.querySelector('.dt-waterfall-pop') as HTMLElement).click();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('WaterfallTimingPopoverHorizontal — explain', () => {
  it('for Start time, anchors the Queued tick (with ↓) and highlights the Queueing legend entry', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladderOf(NORMAL)} metric="startTime" queuedAtMs={0} explain={true} />,
    );
    const anchor = container.querySelector('.dt-wf-h-tick.dt-wf-pop-anchor');
    expect(anchor?.textContent).toContain('Queued');
    expect(anchor?.querySelector('.dt-wf-pop-down')?.textContent).toContain('↓');
    expect(legendItem(container, 'Queueing')?.className).toContain('dt-waterfall-pop-row--hl');
    expect(legendItem(container, 'Stalled')?.className).not.toContain('dt-waterfall-pop-row--hl');
  });
});

describe('WaterfallTimingPopoverHorizontal — warm socket (TCP 0µs, TLS ran)', () => {
  const WARM: Timings = {
    blocked: 0,
    _blocked_queueing: 0,
    dns: 0,
    connect: 12.179,
    ssl: 12.179,
    send: 0.2,
    wait: 117,
    receive: 0.7,
  };

  it('flags the TCP legend entry "warm socket" with an explanatory tooltip, TLS undecorated', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladderOf(WARM)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    const tcp = legendItem(container, 'TCP');
    expect(tcp?.querySelector('.dt-wf-h-legend-hint')?.textContent).toBe('warm socket');
    expect(tcp?.getAttribute('title')).toContain('already established');
    expect(legendValue(container, 'TCP')).toMatch(/^0/);
    expect(legendValue(container, 'TLS')).toBe('12.18ms');
    expect(legendItem(container, 'TLS')?.querySelector('.dt-wf-h-legend-hint')).toBeNull();
  });

  it('does not flag a TCP rung that took real time', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(legendItem(container, 'TCP')?.querySelector('.dt-wf-h-legend-hint')).toBeNull();
  });
});

describe('WaterfallTimingPopoverHorizontal — reused connection', () => {
  it('marks the setup rungs reused (no segments) and attributes the opener', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal
        ladder={ladderOf(REUSED)}
        metric="duration"
        queuedAtMs={0}
        explain={false}
        reusedOpener="openheaders.io"
      />,
    );
    expect(legendValue(container, 'DNS Lookup')).toBe('connection reused');
    expect(legendValue(container, 'TCP')).toBe('connection reused');
    expect(legendValue(container, 'TLS')).toBe('connection reused');
    expect(legendValue(container, 'Waiting for server')).toBe('45.00ms');
    // Eight cells (every rung keeps its slot); the three reused setup rungs are
    // the hatched, absent cells.
    expect(cellCount(container)).toBe(8);
    expect(absentCellCount(container)).toBe(3);
    expect(container.querySelector('.dt-waterfall-pop-note')?.textContent).toBe(
      '↳ connection opened by openheaders.io',
    );
  });
});

describe('WaterfallTimingPopoverHorizontal — no-response terminal', () => {
  it('shows all four ticks (Response/Ended "not reached") and pinpoints the stop on the bar', () => {
    const { container } = render(
      <WaterfallTimingPopoverHorizontal
        ladder={ladderOf(BLOCKED, { reachedResponse: false })}
        metric="duration"
        queuedAtMs={8970}
        explain={false}
        terminal={{ label: '(blocked:other)', detail: 'never-reached' }}
      />,
    );
    // All four instants present; the two that never happened read "not reached".
    expect(tickLabels(container)).toEqual(['Queued', 'Started', 'Response', 'Ended']);
    expect(tickValue(container, 'Response')).toBe('not reached');
    expect(tickValue(container, 'Ended')).toBe('not reached');
    expect(legendValue(container, 'DNS Lookup')).toBe('not reached');
    expect(legendValue(container, 'Stalled')).toBe('1.98ms');
    // The failure is marked ON the bar (stop line + ▼ + status), not as a text block.
    expect(container.querySelector('.dt-waterfall-pop-terminal')).toBeNull();
    expect(container.querySelector('.dt-wf-h-stopline')).not.toBeNull();
    expect(container.querySelector('.dt-wf-h-stop-mark')).not.toBeNull();
    const stopLabel = container.querySelector('.dt-wf-h-stop-label');
    expect(stopLabel ? textSansInfo(stopLabel) : undefined).toBe('(blocked:other)');
    // The terminal outcome carries its own (i) explainer, like every phase.
    expect(stopLabel?.querySelector('.oh-info-trigger')).not.toBeNull();
  });
});

describe('WaterfallTimingPopoverHorizontal — responded request', () => {
  it('renders no failure marker and reaches Ended when a response arrived', () => {
    const ladder = ladderOf(NORMAL);
    const { container } = render(
      <WaterfallTimingPopoverHorizontal ladder={ladder} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(container.querySelector('.dt-wf-h-stopline')).toBeNull();
    expect(container.querySelector('.dt-wf-h-stop-label')).toBeNull();
    expect(tickValue(container, 'Ended')).not.toBe('not reached');
  });
});

describe('layoutHorizontal — label de-collision (degenerate timings)', () => {
  it('keeps the bar one cell per rung and never overlaps Queued / Started when queueing is 0', () => {
    // A blocked request: queueing 0, big Stalled, the rest never reached.
    const layout = layoutHorizontal(getTranslator(DEFAULT_LOCALE), ladderOf(BLOCKED, { reachedResponse: false }), true);
    expect(layout.cells).toHaveLength(8);
    // All four instants are laid out; Queued and Started are pushed at least a
    // label-width apart even though their true marks are µs apart (Started leadered).
    expect(layout.ticks.map((t) => t.line)).toEqual(['queued', 'started', 'response', 'ended']);
    const [queued, started] = layout.ticks;
    expect(Math.abs(started.labelCenterPx - queued.labelCenterPx)).toBeGreaterThanOrEqual(72);
    expect(started.leader).toBe(true);
    expect(layout.ticks[2].reached).toBe(false); // Response never reached
    expect(layout.failure).not.toBeNull();
  });

  it('leaves a normal request instant labels on their marks (no leaders)', () => {
    const layout = layoutHorizontal(getTranslator(DEFAULT_LOCALE), ladderOf(NORMAL));
    // Queued sits at 0; with roomy phases the rest stay on their true marks.
    expect(layout.ticks.every((t) => t.leader === false)).toBe(true);
    expect(layout.failure).toBeNull();
  });
});
