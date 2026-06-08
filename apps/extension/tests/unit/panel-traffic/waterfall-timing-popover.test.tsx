/**
 * Finished-row Waterfall popover — the rich phase breakdown.
 *
 * Two behaviors under test beyond the happy path:
 *   - A terminal request that never received a response (blocked before the
 *     wire, or a wire failure / cancel before any response) must NOT fabricate
 *     Response / Ended instants from the stalled time — it shows an honest
 *     outcome marker instead, while keeping the real Queued / Started / phases.
 *   - The Queueing row is always shown, even at 0ms, so the request's first
 *     intermediary state is visible (more than the host, which hides a 0 queue).
 */

import { noResponseTerminal } from '@openheaders/ui/panel/components/traffic/WaterfallBar';
import { WaterfallTimingPopover } from '@openheaders/ui/panel/components/traffic/WaterfallTimingPopover';
import { computeRowTimingPhases } from '@openheaders/ui/panel/data/waterfall-geometry';
import { type ComputedTimings, computeTimingPhases } from '@openheaders/ui/panel/data/timing-phases';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeHar, makeRow } from '../../__factories__/lifecycle';

/** A blocked-before-the-wire breakdown: only the stalled leg, no response. */
const BLOCKED_TIMINGS = { blocked: 1.98, dns: -1, ssl: -1, connect: -1, send: 0, wait: 0, receive: 0 };
/** A normal request that reached a response (wait + receive present). */
const RESPONDED_TIMINGS = { blocked: 5, dns: 20, connect: 15, ssl: 0, send: 5, wait: 100, receive: 40 };
/** A responded request that reused an open socket — no DNS / connect / TLS. */
const REUSED_TIMINGS = { blocked: 0.3, dns: -1, connect: -1, ssl: -1, send: 0.3, wait: 117, receive: 42 };

function timings(t: NonNullable<ReturnType<typeof makeHar>['timings']>): ComputedTimings {
  const data = computeTimingPhases(makeHar('https://openheaders.io/', { timings: t }));
  if (data == null) throw new Error('expected timing phases');
  return data;
}

function headerText(container: HTMLElement): string {
  return container.querySelector('.dt-waterfall-pop-start')?.textContent ?? '';
}

function phaseLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.dt-waterfall-pop-label')).map((n) => n.textContent ?? '');
}

describe('WaterfallTimingPopover — no-response terminal', () => {
  const terminal = { label: '(blocked:other)', detail: 'no response received' };

  it('hides Response / Ended and shows the outcome marker for a blocked row', () => {
    const { container } = render(
      <WaterfallTimingPopover data={timings(BLOCKED_TIMINGS)} metric="duration" queuedAtMs={8970} explain={false} terminal={terminal} />,
    );
    const header = headerText(container);
    expect(header).toContain('Queued at');
    expect(header).toContain('Started at');
    expect(header).not.toContain('Response at');
    expect(header).not.toContain('Ended at');
    const marker = container.querySelector('.dt-waterfall-pop-terminal');
    expect(marker?.textContent).toContain('(blocked:other)');
    expect(marker?.textContent).toContain('no response received');
    // The real stalled time is still the Duration total (not relabelled Latency).
    expect(container.querySelector('.dt-waterfall-pop-total')?.textContent).toContain('Duration');
  });

  it('keeps Response / Ended and shows no marker for a responded row', () => {
    const { container } = render(
      <WaterfallTimingPopover data={timings(RESPONDED_TIMINGS)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    const header = headerText(container);
    expect(header).toContain('Response at');
    expect(header).toContain('Ended at');
    expect(container.querySelector('.dt-waterfall-pop-terminal')).toBeNull();
  });
});

describe('WaterfallTimingPopover — Queueing always shown', () => {
  it('synthesizes a 0ms Queueing row when the breakdown dropped it', () => {
    // RESPONDED_TIMINGS has no _blocked_queueing → queueing is 0, normally hidden.
    const { container } = render(
      <WaterfallTimingPopover data={timings(RESPONDED_TIMINGS)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(phaseLabels(container)).toContain('Queueing');
  });

  it('shows Queueing even on a blocked row (only Stalled actually elapsed)', () => {
    const { container } = render(
      <WaterfallTimingPopover
        data={timings(BLOCKED_TIMINGS)}
        metric="duration"
        queuedAtMs={8970}
        explain={false}
        terminal={{ label: '(blocked:other)', detail: 'no response received' }}
      />,
    );
    const labels = phaseLabels(container);
    expect(labels).toContain('Queueing');
    expect(labels).toContain('Stalled');
  });
});

describe('WaterfallTimingPopover — reused connection note', () => {
  it('notes a reused connection when a responded request did no DNS / connect / TLS', () => {
    const { container } = render(
      <WaterfallTimingPopover data={timings(REUSED_TIMINGS)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(container.querySelector('.dt-waterfall-pop-note')?.textContent).toBe('connection reused (DNS, TCP, TLS)');
  });

  it('attributes the opener when one is known', () => {
    const { container } = render(
      <WaterfallTimingPopover
        data={timings(REUSED_TIMINGS)}
        metric="duration"
        queuedAtMs={0}
        explain={false}
        reusedOpener="crypto.com"
      />,
    );
    expect(container.querySelector('.dt-waterfall-pop-note')?.textContent).toBe(
      'connection reused (DNS, TCP, TLS) · opened by crypto.com',
    );
  });

  it('shows no reuse note when the request opened its own connection', () => {
    const { container } = render(
      <WaterfallTimingPopover data={timings(RESPONDED_TIMINGS)} metric="duration" queuedAtMs={0} explain={false} />,
    );
    expect(container.querySelector('.dt-waterfall-pop-note')).toBeNull();
  });

  it('shows no reuse note on a no-response row (nothing was reused)', () => {
    const { container } = render(
      <WaterfallTimingPopover
        data={timings(BLOCKED_TIMINGS)}
        metric="duration"
        queuedAtMs={8970}
        explain={false}
        terminal={{ label: '(blocked:other)', detail: 'never reached the network' }}
      />,
    );
    expect(container.querySelector('.dt-waterfall-pop-note')).toBeNull();
  });
});

describe('noResponseTerminal', () => {
  function rowWith(over: Parameters<typeof makeRow>[0]) {
    const row = makeRow(over);
    const timing = computeRowTimingPhases(row);
    if (timing == null) throw new Error('expected timing');
    return { row, timing };
  }

  it('marks a blocked-before-the-wire request "never reached the network", mirroring the Status cell', () => {
    // Only a stalled leg — no DNS / connect / TLS / send, so it never left the
    // scheduler for the wire.
    const { row, timing } = rowWith({
      phase: 'failed',
      completedAtMs: 9100,
      error: { code: 'net::ERR_BLOCKED_BY_CLIENT', reason: 'Blocked by client' },
      harOverrides: { status: 0, statusText: '', timings: BLOCKED_TIMINGS },
    });
    expect(noResponseTerminal(row, timing)).toEqual({
      label: '(blocked:other)',
      detail: 'never reached the network',
    });
  });

  it('marks a wire failure that reached the network "no response received"', () => {
    // DNS happened (it talked to the network), then failed — so the phrasing is
    // "no response received", not "never reached the network".
    const { row, timing } = rowWith({
      phase: 'failed',
      completedAtMs: 9100,
      error: { code: 'net::ERR_NAME_NOT_RESOLVED', reason: 'DNS failed' },
      harOverrides: { status: 0, statusText: '', timings: { blocked: 2, dns: 50, connect: -1, ssl: -1, send: 0, wait: 0, receive: 0 } },
    });
    expect(noResponseTerminal(row, timing)).toEqual({
      label: '(failed) net::ERR_NAME_NOT_RESOLVED',
      detail: 'no response received',
    });
  });

  it('does not mark a request that reached a response (success, 4xx, mid-body failure)', () => {
    const ok = rowWith({ completedAtMs: 9100, harOverrides: { timings: RESPONDED_TIMINGS } });
    expect(noResponseTerminal(ok.row, ok.timing)).toBeUndefined();

    const notFound = rowWith({ completedAtMs: 9100, harOverrides: { status: 404, timings: RESPONDED_TIMINGS } });
    expect(noResponseTerminal(notFound.row, notFound.timing)).toBeUndefined();

    // Failed AFTER headers: has a real wait/receive, so its Response/Ended are true.
    const midBody = rowWith({
      phase: 'failed',
      completedAtMs: 9100,
      error: { code: 'net::ERR_CONNECTION_RESET', reason: 'reset' },
      harOverrides: { status: 200, timings: RESPONDED_TIMINGS },
    });
    expect(noResponseTerminal(midBody.row, midBody.timing)).toBeUndefined();
  });
});
