/**
 * Timing popover — the reused-connection note names the request that
 * opened the socket, and that name can be a query string thousands of
 * characters long. The note is one line that carries the full name as
 * its title; its stylesheet rule keeps the name out of the popover's
 * width (inline-size containment, an ellipsis, no wrap).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { WaterfallTimingPopover } from '@openheaders/ui/panel/components/traffic/WaterfallTimingPopover';
import { WaterfallTimingPopoverHorizontal } from '@openheaders/ui/panel/components/traffic/WaterfallTimingPopoverHorizontal';
import { computeTimingLadder, type TimingLadder } from '@openheaders/ui/panel/data/timing/timing-ladder';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeHar } from '../../__factories__/lifecycle';

type Timings = NonNullable<InspectorHarEntry['timings']>;

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

const LONG_NAME = `echo?heavy=3&pad=${'p'.repeat(8_000)}`;

function reusedLadder(): TimingLadder {
  const ladder = computeTimingLadder(makeHar('https://openheaders.io/', { timings: REUSED }), {
    reachedResponse: true,
    isHttps: true,
  });
  if (ladder == null) throw new Error('expected a ladder');
  return ladder;
}

describe('timing popover — the reused-connection note', () => {
  it.each([
    ['vertical', WaterfallTimingPopover],
    ['horizontal', WaterfallTimingPopoverHorizontal],
  ] as const)('the %s popover carries a long opener name whole, as text and as the title', (_layout, Popover) => {
    const { container } = render(
      <Popover ladder={reusedLadder()} metric="duration" queuedAtMs={0} explain={false} reusedOpener={LONG_NAME} />,
    );
    const note = container.querySelector('.dt-waterfall-pop-note');
    expect(note?.textContent).toBe(`↳ connection opened by ${LONG_NAME}`);
    expect(note?.getAttribute('title')).toBe(LONG_NAME);
  });

  it('the note’s rule keeps the name on one cut line, out of the popover’s width', () => {
    const css = readFileSync(
      path.resolve(__dirname, '../../../../../packages/ui/src/panel/styles/panel-traffic.css'),
      'utf8',
    );
    const rule = /\.dt-waterfall-pop-note\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('contain: inline-size;');
    expect(rule).toContain('overflow: hidden;');
    expect(rule).toContain('text-overflow: ellipsis;');
    expect(rule).toContain('white-space: nowrap;');
  });
});
