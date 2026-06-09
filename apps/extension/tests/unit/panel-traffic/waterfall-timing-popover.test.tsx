/**
 * Vertical timing ladder popover — renders the full eight-rung breakdown.
 *
 * Every rung is always shown, with its real value (incl. `0µs`) or an explicit
 * reason (`reused` / `not reached` / `n/a`); the 🌐 wire boundary splits local
 * from network; Response / Ended appear only when a response arrived, replaced
 * by an outcome marker for a no-response terminal.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { WaterfallTimingPopover } from '@openheaders/ui/panel/components/traffic/WaterfallTimingPopover';
import { noResponseTerminal } from '@openheaders/ui/panel/data/row-timing-ladder';
import { computeTimingLadder, type LadderContext, type TimingLadder } from '@openheaders/ui/panel/data/timing-ladder';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeHar, makeRow } from '../../__factories__/lifecycle';

type Timings = NonNullable<InspectorHarEntry['timings']>;

function ladderOf(timings: Timings, ctx: Partial<LadderContext> = {}, url = 'https://openheaders.io/'): TimingLadder {
  const l = computeTimingLadder(makeHar(url, { timings }), { reachedResponse: true, isHttps: true, ...ctx });
  if (l == null) throw new Error('expected a ladder');
  return l;
}

/** A rung's name without its "N." step-ordinal prefix. */
function rungName(label: Element | null | undefined): string {
  return (label?.textContent ?? '').replace(/^\d+\.\s*/, '');
}
function labels(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('.dt-waterfall-pop-label')).map((n) => rungName(n));
}
function rowFor(c: HTMLElement, label: string): Element | undefined {
  return Array.from(c.querySelectorAll('.dt-waterfall-pop-row')).find(
    (r) => rungName(r.querySelector('.dt-waterfall-pop-label')) === label,
  );
}
function valueOf(c: HTMLElement, label: string): string | undefined {
  const row = rowFor(c, label);
  // Elapsed rungs show their duration in `-ms`; absent rungs show the reason.
  const cell = row?.querySelector('.dt-waterfall-pop-ms') ?? row?.querySelector('.dt-waterfall-pop-absent-text');
  return cell?.textContent ?? undefined;
}
function header(c: HTMLElement): string {
  return c.querySelector('.dt-waterfall-pop-start')?.textContent ?? '';
}

const NORMAL: Timings = { blocked: 15, _blocked_queueing: 10, dns: 20, connect: 45, ssl: 30, send: 5, wait: 100, receive: 40 };
const REUSED: Timings = { blocked: 0.3, _blocked_queueing: 0, dns: -1, connect: -1, ssl: -1, send: 0.3, wait: 45, receive: 12 };
const BLOCKED: Timings = { blocked: 1.98, _blocked_queueing: 0, dns: -1, connect: -1, ssl: -1, send: 0, wait: 0, receive: 0 };

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

describe('WaterfallTimingPopover — always the full ladder', () => {
  it('shows all eight rungs under the Scheduling/Connecting/Transferring bands with locations', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(labels(container)).toEqual(ALL_EIGHT);
    const heads = Array.from(container.querySelectorAll('.dt-waterfall-pop-head')).map((h) => h.textContent ?? '');
    expect(heads).toEqual(['Key moments(since the first request)', 'Scheduling(Browser)', 'Connecting(Browser ↔ Network)', 'Transferring(Network)']);
  });

  it('shows real instants and the honest TCP value for a normal request', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    const h = header(container);
    expect(h).toContain('Queued');
    expect(h).toContain('Started');
    expect(h).toContain('Response');
    expect(h).toContain('Ended');
    expect(valueOf(container, 'TCP')).toBe('15.00ms'); // connect 45 − ssl 30
    expect(container.querySelector('.dt-waterfall-pop-total')?.textContent).toContain('Total time');
  });
});

describe('WaterfallTimingPopover — interaction', () => {
  it('does not bubble clicks to the row (React replays portal events up the tree)', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test stand-in for the row handler
      <div onClick={onRowClick}>
        <WaterfallTimingPopover ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />
      </div>,
    );
    (container.querySelector('.dt-waterfall-pop') as HTMLElement).click();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('WaterfallTimingPopover — explain', () => {
  it('for Start time, anchors Queued (with ↓) and highlights the Queueing rung', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(NORMAL)} metric="startTime" queuedAtMs={0} explain={true} />,
    );
    const anchor = container.querySelector('.dt-wf-pop-anchor');
    expect(anchor?.textContent).toContain('Queued');
    expect(anchor?.querySelector('.dt-wf-pop-down')?.textContent).toBe('↓');
    // The Queueing rung row carries the contributing highlight; Stalled does not.
    expect(rowFor(container, 'Queueing')?.className).toContain('dt-waterfall-pop-row--hl');
  });
});

describe('WaterfallTimingPopover — warm socket (TCP 0µs, TLS ran)', () => {
  // react-core: connect == ssl → TCP 0µs but a real TLS handshake.
  const WARM: Timings = { blocked: 0, _blocked_queueing: 0, dns: 0, connect: 12.179, ssl: 12.179, send: 0.2, wait: 117, receive: 0.7 };

  const tcpRow = (c: HTMLElement) => rowFor(c, 'TCP');

  it('flags the TCP rung "warm socket" with an explanatory tooltip', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(WARM)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    const row = tcpRow(container);
    expect(row?.querySelector('.dt-waterfall-pop-hint')?.textContent).toBe('warm socket');
    expect(row?.getAttribute('title')).toContain('already established');
    // The honest value is still shown, and TLS is not decorated.
    expect(valueOf(container, 'TCP')).toMatch(/^0/);
    expect(valueOf(container, 'TLS')).toBe('12.18ms');
  });

  it('does not flag a TCP rung that took real time', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(NORMAL)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(tcpRow(container)?.querySelector('.dt-waterfall-pop-hint')).toBeNull();
  });
});

describe('WaterfallTimingPopover — reused connection', () => {
  it('marks the setup rungs reused and attributes the opener', () => {
    const { container } = render(
      <WaterfallTimingPopover ladder={ladderOf(REUSED)} metric="duration" queuedAtMs={0} explain={false} reusedOpener="crypto.com" />,
    );
    expect(valueOf(container, 'DNS Lookup')).toBe('connection reused');
    expect(valueOf(container, 'TCP')).toBe('connection reused');
    expect(valueOf(container, 'TLS')).toBe('connection reused');
    expect(valueOf(container, 'Waiting for server')).toBe('45.00ms');
    expect(container.querySelector('.dt-waterfall-pop-note')?.textContent).toBe('↳ connection opened by crypto.com');
  });
});

describe('WaterfallTimingPopover — no-response terminal', () => {
  it('hides Response/Ended, marks rungs not reached, shows the outcome marker', () => {
    const { container } = render(
      <WaterfallTimingPopover
        ladder={ladderOf(BLOCKED, { reachedResponse: false })}
        metric="duration"
        queuedAtMs={8970}
        explain={false}
        terminal={{ label: '(blocked:other)', detail: 'never reached the network' }}
      />,
    );
    const h = header(container);
    expect(h).toContain('Queued');
    expect(h).toContain('Started');
    expect(h).not.toContain('Response');
    expect(h).not.toContain('Ended');
    expect(valueOf(container, 'DNS Lookup')).toBe('not reached');
    expect(valueOf(container, 'Content Download')).toBe('not reached');
    expect(valueOf(container, 'Stalled')).toBe('1.98ms');
    // The stop marker sits inline after the last reached step (Stalled); no
    // separate "never reached the network" detail line.
    const marker = container.querySelector('.dt-waterfall-pop-stop');
    expect(marker?.textContent).toContain('(blocked:other)');
    expect(container.textContent).not.toContain('never reached the network');
  });
});

describe('noResponseTerminal', () => {
  function rowAndLadder(over: Parameters<typeof makeRow>[0], ctx: Partial<LadderContext>) {
    const row = makeRow(over);
    const har = row.lifecycle.har[0];
    if (har == null) throw new Error('expected har');
    const ladder = computeTimingLadder(har, { reachedResponse: false, isHttps: true, ...ctx });
    if (ladder == null) throw new Error('expected ladder');
    return { row, ladder };
  }

  it('marks a blocked-before-the-wire request "never reached the network"', () => {
    const { row, ladder } = rowAndLadder(
      {
        phase: 'failed',
        completedAtMs: 9100,
        error: { code: 'net::ERR_BLOCKED_BY_CLIENT', reason: 'Blocked by client' },
        harOverrides: { status: 0, statusText: '', timings: BLOCKED },
      },
      { reachedResponse: false },
    );
    expect(noResponseTerminal(row, ladder)).toEqual({ label: '(blocked:other)', detail: 'never reached the network' });
  });

  it('marks a wire failure that reached the network "no response received"', () => {
    const { row, ladder } = rowAndLadder(
      {
        phase: 'failed',
        completedAtMs: 9100,
        error: { code: 'net::ERR_NAME_NOT_RESOLVED', reason: 'DNS failed' },
        harOverrides: { status: 0, statusText: '', timings: { blocked: 2, _blocked_queueing: 0, dns: 50, connect: -1, ssl: -1, send: 0, wait: 0, receive: 0 } },
      },
      { reachedResponse: false },
    );
    expect(noResponseTerminal(row, ladder)).toEqual({
      label: '(failed) net::ERR_NAME_NOT_RESOLVED',
      detail: 'no response received',
    });
  });

  it('does not mark a request that reached a response', () => {
    const { row, ladder } = rowAndLadder({ completedAtMs: 9100, harOverrides: { timings: NORMAL } }, { reachedResponse: true });
    expect(noResponseTerminal(row, ladder)).toBeUndefined();
  });
});
