/**
 * Console context-selector model (JS contexts Phase C) — pure derivation
 * pins: `top` identification and auto-selection, labels/subtitles, depth
 * indentation (frame/world hops, service workers top-level), and the
 * selection-resolution fallback ladder.
 */

import type { JsContext } from '@openheaders/core/js-contexts';
import {
  consoleContextRows,
  isTopContext,
  resolveContextSelection,
  topContextKey,
} from '@openheaders/ui/panel/data/console-context-selector';
import { describe, expect, it } from 'vitest';

function makeContext(over: Partial<JsContext> & Pick<JsContext, 'contextKey'>): JsContext {
  return {
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
    ...over,
  };
}

const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true, frameId: 'F1' });
const TOP_ISOLATED = makeContext({
  contextKey: 'page::2',
  isTopFrame: true,
  isDefault: false,
  name: 'Open Headers',
  worldType: 'isolated',
});
const SAME_PROCESS_IFRAME = makeContext({
  contextKey: 'page::3',
  frameId: 'F2',
  origin: 'https://ads.openheaders.io',
});
const OOPIF = makeContext({
  contextKey: 'child-iframe-1::1',
  targetKind: 'iframe',
  origin: 'https://embed.openheaders.io',
});
const OOPIF_ISOLATED = makeContext({
  contextKey: 'child-iframe-1::2',
  targetKind: 'iframe',
  isDefault: false,
  name: 'Open Headers',
  worldType: 'isolated',
  origin: 'https://embed.openheaders.io',
});
const WORKER = makeContext({
  contextKey: 'child-worker-1::1',
  targetKind: 'worker',
  worldType: 'worker',
  origin: 'https://app.openheaders.io/worker.js',
});
const SW = makeContext({
  contextKey: 'target:SW1::1',
  targetKind: 'service-worker',
  origin: 'https://app.openheaders.io/sw.js?v=2',
});

describe('isTopContext / topContextKey', () => {
  it('top = page kind + default world + top frame', () => {
    expect(isTopContext(TOP)).toBe(true);
    expect(isTopContext(TOP_ISOLATED)).toBe(false);
    expect(isTopContext(SAME_PROCESS_IFRAME)).toBe(false);
    expect(isTopContext(OOPIF)).toBe(false);
    expect(isTopContext(SW)).toBe(false);
    expect(topContextKey([SW, TOP])).toBe('page::1');
    expect(topContextKey([SW, OOPIF])).toBeNull();
  });
});

describe('consoleContextRows', () => {
  it('labels: top literal, world name, origin fallback; subtitle only when it adds information', () => {
    const rows = consoleContextRows([TOP, TOP_ISOLATED, SAME_PROCESS_IFRAME, SW]);
    expect(rows.map((r) => r.label)).toEqual([
      'top',
      'Open Headers',
      'https://ads.openheaders.io',
      'https://app.openheaders.io/sw.js?v=2',
    ]);
    expect(rows[0].subtitle).toBe('https://app.openheaders.io');
    expect(rows[1].subtitle).toBe('https://app.openheaders.io');
    // Origin-labeled rows would repeat themselves — no subtitle.
    expect(rows[2].subtitle).toBeNull();
    expect(rows[3].subtitle).toBeNull();
  });

  it('depth: frame hop + world hop, service workers top-level', () => {
    const rows = consoleContextRows([TOP, TOP_ISOLATED, SAME_PROCESS_IFRAME, OOPIF, OOPIF_ISOLATED, WORKER, SW]);
    expect(rows.map((r) => [r.context.contextKey, r.depth])).toEqual([
      ['page::1', 0],
      ['page::2', 1],
      ['page::3', 1],
      ['child-iframe-1::1', 1],
      ['child-iframe-1::2', 2],
      ['child-worker-1::1', 1],
      ['target:SW1::1', 0],
    ]);
  });

  it('pins top first regardless of arrival order', () => {
    const rows = consoleContextRows([SW, OOPIF, TOP]);
    expect(rows[0].isTop).toBe(true);
    expect(rows.map((r) => r.context.contextKey)).toEqual(['page::1', 'target:SW1::1', 'child-iframe-1::1']);
  });
});

describe('resolveContextSelection', () => {
  it('auto-selects top when nothing is picked', () => {
    expect(resolveContextSelection([SW, TOP, OOPIF], null)).toBe('page::1');
  });

  it('a live explicit pick wins over top', () => {
    expect(resolveContextSelection([TOP, OOPIF], 'child-iframe-1::1')).toBe('child-iframe-1::1');
  });

  it('a dead pick falls back to top, then to the first live context, then to nothing', () => {
    expect(resolveContextSelection([TOP, OOPIF], 'page::99')).toBe('page::1');
    expect(resolveContextSelection([OOPIF, SW], 'page::99')).toBe('child-iframe-1::1');
    expect(resolveContextSelection([], 'page::99')).toBeNull();
  });
});
