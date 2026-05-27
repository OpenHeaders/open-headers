import { describe, expect, it } from 'vitest';

import type { RequestRecord } from '@openheaders/core/types';
import type { RuleFireUpdate } from '@openheaders/core/rule-fire-stream';

import { RuleFireHub } from '../../src/rule-fire-hub/hub';
import type { Sink } from '../../src/rule-fire-hub/types';
import { TabLifecycleBus } from '../../src/tab-lifecycle-bus/bus';

interface RecordingSink extends Sink {
  ready: number[];
  updates: RuleFireUpdate[];
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

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    ruleUid: 'rule-a',
    url: 'https://openheaders.io/api',
    pattern: '*://openheaders.io/*',
    resourceType: 'xmlhttprequest',
    t: 1000,
    evidence: 'matched',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('RuleFireHub — notify + broadcast', () => {
  it('broadcasts fire to live sinks for the matching tab only', () => {
    const hub = new RuleFireHub();
    const tab1 = recordingSink();
    const tab2 = recordingSink();
    hub.attach(1, tab1);
    hub.attach(2, tab2);
    hub.notifyHeuristicFire(1, rec());
    expect(tab1.updates.filter((u) => u.kind === 'fire')).toHaveLength(1);
    expect(tab2.updates.filter((u) => u.kind === 'fire')).toHaveLength(0);
  });

  it('skips broadcast when arrival is a no-op against existing merged entry', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyHeuristicFire(1, rec());
    sink.updates.length = 0;
    hub.notifyHeuristicFire(1, rec());
    expect(sink.updates).toHaveLength(0);
  });

  it('rebroadcasts merged state when authoritative upgrade lands on a heuristic entry', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyHeuristicFire(1, rec());
    sink.updates.length = 0;
    hub.notifyAuthoritativeFire(1, rec());
    expect(sink.updates).toHaveLength(1);
    const update = sink.updates[0];
    if (update.kind !== 'fire') throw new Error();
    expect(update.authoritative).toBe(true);
    expect(update.record.ruleUid).toBe('rule-a');
  });

  it('forgetTab broadcasts tab-cleared and drops the snapshot', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyHeuristicFire(1, rec());
    sink.updates.length = 0;
    hub.forgetTab(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('forgetTab is a no-op (no broadcast) when the tab has no state', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.forgetTab(1);
    expect(sink.updates).toEqual([]);
  });
});

describe('RuleFireHub — attach replay', () => {
  it('delivers ready then replays merged fires in arrival order', () => {
    const hub = new RuleFireHub();
    hub.notifyHeuristicFire(1, rec({ requestId: 'a' }));
    hub.notifyAuthoritativeFire(1, rec({ requestId: 'b' }));
    hub.notifyHeuristicFire(1, rec({ requestId: 'c' }));

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.ready).toEqual([1]);
    const fireRequestIds = sink.updates.map((u) => (u.kind === 'fire' ? u.record.requestId : null));
    expect(fireRequestIds).toEqual(['a', 'b', 'c']);
  });

  it('attach to an unknown tab fires only ready', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(99, sink);
    expect(sink.ready).toEqual([99]);
    expect(sink.updates).toEqual([]);
  });

  it('detach is idempotent and stops further delivery', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    const handle = hub.attach(1, sink);
    handle.detach();
    handle.detach();
    hub.notifyHeuristicFire(1, rec());
    expect(sink.updates.filter((u) => u.kind === 'fire')).toHaveLength(0);
  });

  it('throws when attaching after dispose; dispose closes attached sinks', () => {
    const hub = new RuleFireHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.dispose();
    expect(sink.closed).toBe(1);
    expect(() => hub.attach(1, recordingSink())).toThrow(/dispose/);
  });

  it('a throwing sink does not block sibling delivery', () => {
    const hub = new RuleFireHub();
    const angry: Sink = {
      deliverReady() {
        /* fine */
      },
      deliverUpdate() {
        throw new Error('boom');
      },
      close() {
        /* fine */
      },
    };
    const calm = recordingSink();
    hub.attach(1, angry);
    hub.attach(1, calm);
    hub.notifyHeuristicFire(1, rec());
    expect(calm.updates.filter((u) => u.kind === 'fire')).toHaveLength(1);
  });
});

describe('RuleFireHub — bus integration', () => {
  it('drops the tab fire log and broadcasts a single tab-cleared on bus fire', () => {
    const bus = new TabLifecycleBus();
    const hub = new RuleFireHub({ bus });
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.notifyHeuristicFire(1, rec());
    sink.updates.length = 0;

    bus.notifyTabForgotten(1);
    expect(sink.updates.map((u) => u.kind)).toEqual(['tab-cleared']);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('unsubscribes from the bus on dispose', () => {
    const bus = new TabLifecycleBus();
    const hub = new RuleFireHub({ bus });
    hub.dispose();
    expect(() => bus.notifyTabForgotten(1)).not.toThrow();
  });
});
