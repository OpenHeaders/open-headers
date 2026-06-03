import { describe, expect, it } from 'vitest';

import type { PageStreamUpdate } from '@openheaders/core/page-stream';

import { PageStreamHub } from '../../src/page-stream-hub/hub';
import type { Sink } from '../../src/page-stream-hub/types';
import { TabLifecycleBus } from '../../src/tab-lifecycle-bus/bus';

interface RecordingSink extends Sink {
  ready: number[];
  updates: PageStreamUpdate[];
  closed: number;
}

function recordingSink(): RecordingSink {
  const sink: RecordingSink = {
    ready: [],
    updates: [],
    closed: 0,
    deliverReady(tabId) {
      sink.ready.push(tabId);
    },
    deliverUpdate(update) {
      sink.updates.push(update);
    },
    close() {
      sink.closed++;
    },
  };
  return sink;
}

describe('PageStreamHub — notify + broadcast', () => {
  it('mints sequential page ids per tab', () => {
    const hub = new PageStreamHub();
    const a = hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    const b = hub.notifyNavStarted(1, 200, 'https://openheaders.io/b');
    const c = hub.notifyNavStarted(2, 100, 'https://openheaders.io/c');
    expect(a.id).toBe('page_1');
    expect(b.id).toBe('page_2');
    expect(c.id).toBe('page_1');
  });

  it('broadcasts page-started to live sinks for the matching tab only', () => {
    const hub = new PageStreamHub();
    const tab1 = recordingSink();
    const tab2 = recordingSink();
    hub.attach(1, tab1);
    hub.attach(2, tab2);
    hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    expect(tab1.updates.filter((u) => u.kind === 'page-started')).toHaveLength(1);
    expect(tab2.updates.filter((u) => u.kind === 'page-started')).toHaveLength(0);
  });

  it('refines the most-recent page on nav-timing-attached and skips when nothing changes', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    const page = hub.notifyNavStarted(1, 100, null);
    sink.updates.length = 0;
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', dclMs: 50 });
    expect(sink.updates).toHaveLength(1);
    const evt = sink.updates[0];
    expect(evt.kind).toBe('nav-timing-attached');
    if (evt.kind !== 'nav-timing-attached') throw new Error();
    expect(evt.pageId).toBe(page.id);

    sink.updates.length = 0;
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', dclMs: 50 });
    expect(sink.updates).toHaveLength(0);
  });

  it('corrects the page start down to navStartMs and ignores a later one', () => {
    const hub = new PageStreamHub();
    hub.notifyNavStarted(1, 250, null);

    // Earlier nav start (the true timeOrigin) wins over the commit placeholder.
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', navStartMs: 100 });
    expect(hub.snapshotTab(1)[0].startedAtMs).toBe(100);

    // A later navStartMs never pushes the start forward.
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', navStartMs: 180 });
    expect(hub.snapshotTab(1)[0].startedAtMs).toBe(100);
  });

  it('does not emit nav-timing-attached when no page exists for the tab', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', loadMs: 500 });
    expect(sink.updates).toHaveLength(0);
  });

  it('forgetTab drops the tab page list and broadcasts tab-cleared', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    sink.updates.length = 0;
    hub.forgetTab(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });
});

describe('PageStreamHub — attach replay', () => {
  it('delivers ready then replays known pages then nav-timing refinements', () => {
    const hub = new PageStreamHub();
    hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    hub.notifyNavStarted(1, 200, null);
    hub.notifyNavTimingAttached(1, { pageOrigin: 'https://openheaders.io', dclMs: 30, loadMs: 90 });

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.ready).toEqual([1]);
    const kinds = sink.updates.map((u) => u.kind);
    expect(kinds).toEqual(['page-started', 'page-started', 'nav-timing-attached']);
  });

  it('attach to an unknown tab fires only ready', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    hub.attach(42, sink);
    expect(sink.ready).toEqual([42]);
    expect(sink.updates).toEqual([]);
  });

  it('detach is idempotent and stops further delivery', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    const handle = hub.attach(1, sink);
    handle.detach();
    handle.detach();
    hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    expect(sink.updates.filter((u) => u.kind === 'page-started')).toHaveLength(0);
  });

  it('throws when attaching after dispose', () => {
    const hub = new PageStreamHub();
    hub.dispose();
    expect(() => hub.attach(1, recordingSink())).toThrow(/dispose/);
  });

  it('dispose closes attached sinks', () => {
    const hub = new PageStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.dispose();
    expect(sink.closed).toBe(1);
  });
});

describe('PageStreamHub — bus integration', () => {
  it('drops the tab page list and broadcasts tab-cleared when the bus fires', () => {
    const bus = new TabLifecycleBus();
    const hub = new PageStreamHub({ bus });
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyNavStarted(1, 100, 'https://openheaders.io/a');
    sink.updates.length = 0;

    bus.notifyTabForgotten(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('does not double-broadcast on bus fire (single tab-cleared)', () => {
    const bus = new TabLifecycleBus();
    const hub = new PageStreamHub({ bus });
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyNavStarted(1, 100, null);
    sink.updates.length = 0;
    bus.notifyTabForgotten(1);
    expect(sink.updates).toHaveLength(1);
  });

  it('unsubscribes from the bus on dispose', () => {
    const bus = new TabLifecycleBus();
    const hub = new PageStreamHub({ bus });
    hub.dispose();
    expect(() => bus.notifyTabForgotten(1)).not.toThrow();
  });
});
