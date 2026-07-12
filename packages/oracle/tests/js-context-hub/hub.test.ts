import type { JsContext, JsContextUpdate } from '@openheaders/core/js-contexts';
import { describe, expect, it } from 'vitest';

import { JsContextHub } from '../../src/js-context-hub/hub';
import type { Sink } from '../../src/js-context-hub/types';
import { TabLifecycleBus } from '../../src/tab-lifecycle-bus/bus';

interface RecordingSink extends Sink {
  ready: number[];
  updates: JsContextUpdate[];
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

function context(contextKey: string, over: Partial<JsContext> = {}): JsContext {
  return {
    contextKey,
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
    ...over,
  };
}

describe('JsContextHub — record + broadcast', () => {
  it('broadcasts a created context to live sinks for the matching tab only', () => {
    const hub = new JsContextHub();
    const tab1 = recordingSink();
    const tab2 = recordingSink();
    hub.attach(1, tab1);
    hub.attach(2, tab2);

    hub.recordCreated(1, context('page::1'));
    expect(tab1.updates).toEqual([{ kind: 'context-added', tabId: 1, context: context('page::1') }]);
    expect(tab2.updates).toEqual([]);
  });

  it('short-circuits a field-identical re-add (the enable replays live contexts)', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordCreated(1, context('page::1'));
    hub.recordCreated(1, context('page::1'));
    expect(sink.updates).toHaveLength(1);
    hub.recordCreated(1, context('page::1', { name: 'renamed' }));
    expect(sink.updates).toHaveLength(2);
  });

  it('recordDestroyed removes and broadcasts; unknown keys are silent', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordCreated(1, context('page::1'));
    sink.updates.length = 0;

    hub.recordDestroyed(1, 'page::1');
    hub.recordDestroyed(1, 'page::1');
    expect(sink.updates).toEqual([{ kind: 'context-removed', tabId: 1, contextKey: 'page::1' }]);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('clearSession broadcasts one removal per dropped context, other sessions untouched', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordCreated(1, context('page::1'));
    hub.recordCreated(1, context('page::2'));
    hub.recordCreated(1, context('child-a::1', { targetKind: 'iframe' }));
    sink.updates.length = 0;

    hub.clearSession(1, 'page');
    expect(sink.updates).toEqual([
      { kind: 'context-removed', tabId: 1, contextKey: 'page::1' },
      { kind: 'context-removed', tabId: 1, contextKey: 'page::2' },
    ]);
    expect(hub.snapshotTab(1).map((c) => c.contextKey)).toEqual(['child-a::1']);
  });

  it('forgetTab broadcasts tab-cleared and drops the set; no-op when empty', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordCreated(1, context('page::1'));
    sink.updates.length = 0;

    hub.forgetTab(1);
    expect(sink.updates).toEqual([{ kind: 'tab-cleared', tabId: 1 }]);
    expect(hub.snapshotTab(1)).toEqual([]);

    sink.updates.length = 0;
    hub.forgetTab(1);
    expect(sink.updates).toEqual([]);
  });
});

describe('JsContextHub — attach replay', () => {
  it('delivers ready then replays the live set as context-added updates', () => {
    const hub = new JsContextHub();
    hub.recordCreated(1, context('page::1'));
    hub.recordCreated(1, context('page::5', { worldType: 'isolated', isDefault: false }));
    hub.recordDestroyed(1, 'page::1');

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.ready).toEqual([1]);
    // Only the live set replays — the destroyed context is gone.
    expect(sink.updates).toEqual([
      {
        kind: 'context-added',
        tabId: 1,
        context: context('page::5', { worldType: 'isolated', isDefault: false }),
      },
    ]);
  });

  it('attach to an unknown tab fires only ready', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(99, sink);
    expect(sink.ready).toEqual([99]);
    expect(sink.updates).toEqual([]);
  });

  it('detach is idempotent and stops further delivery', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    const handle = hub.attach(1, sink);
    handle.detach();
    handle.detach();
    hub.recordCreated(1, context('page::1'));
    expect(sink.updates).toEqual([]);
  });

  it('throws when recording/attaching after dispose; dispose closes attached sinks', () => {
    const hub = new JsContextHub();
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.dispose();
    expect(sink.closed).toBe(1);
    expect(() => hub.attach(1, recordingSink())).toThrow(/dispose/);
    expect(() => hub.recordCreated(1, context('page::1'))).toThrow(/dispose/);
  });

  it('a throwing sink does not block sibling delivery', () => {
    const hub = new JsContextHub();
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
    hub.recordCreated(1, context('page::1'));
    expect(calm.updates).toHaveLength(1);
  });
});

describe('JsContextHub — bus integration', () => {
  it('drops the tab set and broadcasts a single tab-cleared on bus fire', () => {
    const bus = new TabLifecycleBus();
    const hub = new JsContextHub({ bus });
    const sink = recordingSink();
    hub.attach(1, sink);
    hub.recordCreated(1, context('page::1'));
    sink.updates.length = 0;

    bus.notifyTabForgotten(1);
    expect(sink.updates).toEqual([{ kind: 'tab-cleared', tabId: 1 }]);
    expect(hub.snapshotTab(1)).toEqual([]);
  });

  it('unsubscribes from the bus on dispose', () => {
    const bus = new TabLifecycleBus();
    const hub = new JsContextHub({ bus });
    hub.dispose();
    expect(() => bus.notifyTabForgotten(1)).not.toThrow();
  });
});
