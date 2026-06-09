/**
 * In-flight waterfall popover — the live request model for rows that have no
 * HAR entry yet (pending / post-navigation "(unknown)").
 *
 * HAR lands only at finish, so the rich popover can't drive these rows. The
 * partial is read from the lifecycle (both correlators populate the issue
 * instant), never from the provenance: show Queued / Started + the open Stalled
 * phase + the not-finished caution. The heuristic (no-CDP) path can't observe
 * the queue-exit instant, so it stays Stalled and adds an attach-CDP hint.
 */

import { WaterfallLivePopover } from '@openheaders/ui/panel/components/traffic/WaterfallLivePopover';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../../__factories__/lifecycle';

/** Text of the Queued / Started header lines, in order. */
function headerLines(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.dt-waterfall-pop-start div')).map((d) => d.textContent ?? '');
}

describe('WaterfallLivePopover', () => {
  it('CDP stalled (no network start): shows Queued + Stalled + caution, no "Started at"', () => {
    // Issued at t0 + 1000; never left the queue → no "Started at" (it would just
    // duplicate Queued), and the open Stalled phase is shown instead.
    const row = makeRow({ startedAtMs: 5000, hopStartedAtMs: 5000, phase: 'pending', har: [null] });
    const { container } = render(<WaterfallLivePopover row={row} t0={4000} cdpEnhanced={true} />);
    const lines = headerLines(container);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Queued at');
    expect(lines[0]).toContain('1.00');
    expect(container.querySelector('.dt-waterfall-pop-label')?.textContent).toBe('Stalled');
    expect(container.querySelector('.dt-waterfall-pop-caution')?.textContent).toBe(
      'CAUTION: request is not finished yet!',
    );
    expect(container.querySelector('.dt-waterfall-pop-explainer')).toBeNull();
  });

  it('CDP with a known network start: shows Queued + Started, drops the Stalled row', () => {
    // Network start 200ms after issue → Started = Queued + 200ms, and "Started"
    // now means something so it appears; the Stalled placeholder drops.
    const row = makeRow({
      startedAtMs: 5000,
      hopStartedAtMs: 5000,
      hopNetworkStartMs: 5200,
      phase: 'pending',
      har: [null],
    });
    const { container } = render(<WaterfallLivePopover row={row} t0={4000} cdpEnhanced={true} />);
    const [queued, started] = headerLines(container);
    expect(queued).toContain('1.00');
    expect(started).toContain('Started at');
    expect(started).toContain('1.20');
    expect(container.querySelector('.dt-waterfall-pop-label')).toBeNull();
  });

  it('no CDP: still shows the partial (Queued + Stalled + caution) plus an attach-CDP hint', () => {
    // The heuristic path populates the issue instant too, so the live partial
    // renders the same — Queued + open Stalled — and adds the attach-CDP hint
    // (it can't observe the queue-exit instant until the finished HAR lands).
    const row = makeRow({ startedAtMs: 5000, hopStartedAtMs: 5000, phase: 'pending', har: [null] });
    const { container } = render(<WaterfallLivePopover row={row} t0={4000} cdpEnhanced={false} />);
    const lines = headerLines(container);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Queued at');
    expect(lines[0]).toContain('1.00');
    expect(container.querySelector('.dt-waterfall-pop-label')?.textContent).toBe('Stalled');
    expect(container.querySelector('.dt-waterfall-pop-caution')?.textContent).toBe(
      'CAUTION: request is not finished yet!',
    );
    expect(container.querySelector('.dt-waterfall-pop-explainer')?.textContent).toContain('Enable CDP');
  });
});
