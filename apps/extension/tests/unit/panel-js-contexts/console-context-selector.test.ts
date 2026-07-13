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
  frameId: 'F1',
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
  it('labels: top literal, world name, host[:port] for bare origins, full script URL for workers', () => {
    const rows = consoleContextRows([TOP, TOP_ISOLATED, SAME_PROCESS_IFRAME, SW]);
    expect(rows.map((r) => r.label)).toEqual([
      'top',
      'Open Headers',
      'ads.openheaders.io',
      'https://app.openheaders.io/sw.js?v=2',
    ]);
    // Subtitle is the origin's host form, only when it adds information.
    expect(rows[0].subtitle).toBe('app.openheaders.io');
    expect(rows[1].subtitle).toBe('app.openheaders.io');
    expect(rows[2].subtitle).toBeNull();
    expect(rows[3].subtitle).toBe('app.openheaders.io');
  });

  it("titles a frame context by its frame URL's last path segment, the browser's frame label", () => {
    const framed = makeContext({
      contextKey: 'page::30',
      frameId: 'F7',
      origin: 'https://ads.openheaders.io',
      frameUrl: 'https://ads.openheaders.io/embed/frame.html',
    });
    const rows = consoleContextRows([framed]);
    expect(rows[0].label).toBe('frame.html');
    expect(rows[0].subtitle).toBe('ads.openheaders.io');
    // A path-less frame URL labels as `host/`.
    const rootFramed = makeContext({
      contextKey: 'page::31',
      frameId: 'F8',
      origin: 'https://ads.openheaders.io',
      frameUrl: 'https://ads.openheaders.io/',
    });
    expect(consoleContextRows([rootFramed])[0].label).toBe('ads.openheaders.io/');
  });

  it("opaque-origin worlds subtitle by their frame URL host (the browser's securityOrigin fallback)", () => {
    const utility = makeContext({
      contextKey: 'page::32',
      isDefault: false,
      name: 'utility-world',
      worldType: 'isolated',
      origin: '://',
      frameId: 'F1',
      frameUrl: 'https://app.openheaders.io/',
    });
    expect(consoleContextRows([utility])[0].subtitle).toBe('app.openheaders.io');
  });

  it('extension worlds subtitle as the literal "Extension", never the extension URL', () => {
    const extensionWorld = makeContext({
      contextKey: 'page::5',
      isDefault: false,
      name: 'Open Headers',
      worldType: 'isolated',
      origin: 'chrome-extension://ablaikadpbfblkmhpmbbnbbfjoibeejb',
    });
    expect(consoleContextRows([extensionWorld])[0].subtitle).toBe('Extension');
  });

  it('never renders an empty or unparsable wire origin as a subtitle', () => {
    const opaqueWorld = makeContext({
      contextKey: 'page::9',
      isDefault: false,
      name: 'utility-world',
      worldType: 'isolated',
      origin: '',
    });
    expect(consoleContextRows([opaqueWorld])[0].subtitle).toBeNull();
    const junkOrigin = makeContext({
      contextKey: 'page::10',
      isDefault: false,
      name: 'utility-world',
      worldType: 'isolated',
      origin: '://',
    });
    expect(consoleContextRows([junkOrigin])[0].subtitle).toBeNull();
  });

  it('depth: frame hop + world hop, service workers top-level; page rows group by frame', () => {
    const rows = consoleContextRows([TOP, TOP_ISOLATED, SAME_PROCESS_IFRAME, OOPIF, OOPIF_ISOLATED, WORKER, SW]);
    expect(rows.map((r) => [r.context.contextKey, r.depth])).toEqual([
      ['page::1', 0],
      ['page::2', 1],
      ['page::3', 1],
      ['child-iframe-1::1', 1],
      ['child-iframe-1::2', 2],
      ['target:SW1::1', 0],
      ['child-worker-1::1', 1],
    ]);
  });

  it("groups a frame's worlds under its main world — the top frame's group first", () => {
    const frameWorld = makeContext({
      contextKey: 'page::40',
      isDefault: false,
      name: 'Open Headers',
      worldType: 'isolated',
      frameId: 'F2',
      origin: 'https://ads.openheaders.io',
    });
    // Arrival interleaves the two frames' contexts.
    const rows = consoleContextRows([frameWorld, TOP_ISOLATED, SAME_PROCESS_IFRAME, TOP]);
    expect(rows.map((r) => r.context.contextKey)).toEqual(['page::1', 'page::2', 'page::3', 'page::40']);
  });

  it('orders by the browser target weights regardless of arrival order', () => {
    // Arrival: worker, SW, OOPIF, top — display: page group, iframe, SW, worker.
    const rows = consoleContextRows([WORKER, SW, OOPIF, TOP]);
    expect(rows[0].isTop).toBe(true);
    expect(rows.map((r) => r.context.contextKey)).toEqual([
      'page::1',
      'child-iframe-1::1',
      'target:SW1::1',
      'child-worker-1::1',
    ]);
  });

  it('within a session the main world precedes the isolated worlds, sorted by name', () => {
    const worldB = makeContext({
      contextKey: 'page::20',
      isDefault: false,
      name: 'Bravo',
      worldType: 'isolated',
    });
    const worldA = makeContext({
      contextKey: 'page::21',
      isDefault: false,
      name: 'Alpha',
      worldType: 'isolated',
    });
    const rows = consoleContextRows([worldB, worldA, TOP]);
    expect(rows.map((r) => r.context.contextKey)).toEqual(['page::1', 'page::21', 'page::20']);
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
