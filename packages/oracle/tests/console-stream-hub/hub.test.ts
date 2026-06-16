import type { ConsoleEntry, ConsoleStreamUpdate } from '@openheaders/core/console-stream';
import { describe, expect, it } from 'vitest';

import { ConsoleStreamHub } from '../../src/console-stream-hub/hub';
import type { Sink } from '../../src/console-stream-hub/types';
import { TabLifecycleBus } from '../../src/tab-lifecycle-bus/bus';

interface RecordingSink extends Sink {
  ready: number[];
  updates: ConsoleStreamUpdate[];
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

function entry(text: string): ConsoleEntry {
  return { source: 'console-api', level: 'log', args: [{ type: 'string', text }], timestamp: 1700 };
}

describe('ConsoleStreamHub — record + broadcast', () => {
  it('broadcasts an entry to live sinks for the matching tab only', () => {
    const hub = new ConsoleStreamHub();
    const tab1 = recordingSink();
    const tab2 = recordingSink();
    hub.attach(1, tab1);
    hub.attach(2, tab2);

    hub.recordEntry(1, entry('hi'));
    expect(tab1.updates.filter((u) => u.kind === 'entry')).toHaveLength(1);
    expect(tab2.updates.filter((u) => u.kind === 'entry')).toHaveLength(0);
  });

  it('broadcasts every entry — no dedup/no-op short-circuit (append-only)', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordEntry(1, entry('same'));
    hub.recordEntry(1, entry('same'));
    expect(sink.updates.filter((u) => u.kind === 'entry')).toHaveLength(2);
  });

  it('forgetTab broadcasts tab-cleared and drops the snapshot', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordEntry(1, entry('a'));
    sink.updates.length = 0;
    hub.forgetTab(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('forgetTab is a no-op (no broadcast) when the tab has no state', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.forgetTab(1);
    expect(sink.updates).toEqual([]);
  });
});

describe('ConsoleStreamHub — attach replay', () => {
  it('delivers ready then replays stored entries in arrival order', () => {
    const hub = new ConsoleStreamHub();
    hub.recordEntry(1, entry('a'));
    hub.recordEntry(1, entry('b'));
    hub.recordEntry(1, entry('c'));

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.ready).toEqual([1]);
    const texts = sink.updates.map((u) => (u.kind === 'entry' ? u.entry.args[0].text : null));
    expect(texts).toEqual(['a', 'b', 'c']);
  });

  it('attach to an unknown tab fires only ready', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    hub.attach(99, sink);
    expect(sink.ready).toEqual([99]);
    expect(sink.updates).toEqual([]);
  });

  it('detach is idempotent and stops further delivery', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    const handle = hub.attach(1, sink);
    handle.detach();
    handle.detach();
    hub.recordEntry(1, entry('after'));
    expect(sink.updates.filter((u) => u.kind === 'entry')).toHaveLength(0);
  });

  it('throws when recording/attaching after dispose; dispose closes attached sinks', () => {
    const hub = new ConsoleStreamHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.dispose();
    expect(sink.closed).toBe(1);
    expect(() => hub.attach(1, recordingSink())).toThrow(/dispose/);
    expect(() => hub.recordEntry(1, entry('x'))).toThrow(/dispose/);
  });

  it('a throwing sink does not block sibling delivery', () => {
    const hub = new ConsoleStreamHub();
    const angry: Sink = {
      deliverReady() {},
      deliverUpdate() {
        throw new Error('boom');
      },
      close() {},
    };
    const calm = recordingSink();
    hub.attach(1, angry);
    hub.attach(1, calm);
    hub.recordEntry(1, entry('hi'));
    expect(calm.updates.filter((u) => u.kind === 'entry')).toHaveLength(1);
  });
});

describe('ConsoleStreamHub — bus integration', () => {
  it('drops the tab console log and broadcasts a single tab-cleared on bus fire', () => {
    const bus = new TabLifecycleBus();
    const hub = new ConsoleStreamHub({ bus });
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordEntry(1, entry('a'));
    sink.updates.length = 0;

    bus.notifyTabForgotten(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('unsubscribes from the bus on dispose', () => {
    const bus = new TabLifecycleBus();
    const hub = new ConsoleStreamHub({ bus });
    hub.dispose();
    expect(() => bus.notifyTabForgotten(1)).not.toThrow();
  });
});
