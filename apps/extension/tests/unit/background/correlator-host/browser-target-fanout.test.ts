/**
 * `startBrowserTargetFanout` — resolves the target plane's target-keyed
 * events against the reconciler's committed owner mapping and fans them
 * into the per-tab context/console hubs (JS contexts Phase B).
 *
 * Coverage:
 *   - context + console events fan to every committed owner;
 *   - events for an ownerless target reach no hub but still feed the
 *     live-context mirror;
 *   - an owner joining mid-attachment is seeded from the mirror; an owner
 *     leaving gets the target's session subset cleared;
 *   - `target-cleared` clears the session subset from all owners and drops
 *     the mirror;
 *   - console entries get no backfill for late joiners.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { JsContext } from '@openheaders/core/js-contexts';
import { describe, expect, it, vi } from 'vitest';

import type { BrowserTargetOwnersListener } from '@/background/correlator-host/browser-target-attach-controller';
import { startBrowserTargetFanout } from '@/background/correlator-host/browser-target-fanout';
import {
  type BrowserTargetJsContextEvent,
  browserTargetSessionKey,
} from '@/background/correlator-host/browser-target-source';

const TARGET = 'SW-TARGET-1';
const TAB = 5;
const OTHER_TAB = 6;

function makeContext(id: number): JsContext {
  return {
    contextKey: `${browserTargetSessionKey(TARGET)}::${id}`,
    origin: 'https://app.openheaders.io/sw.js?v=1',
    name: '',
    isDefault: true,
    targetKind: 'service-worker',
    worldType: 'default',
  };
}

function makeEntry(): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text: 'sw says hi' }],
    timestamp: 1_700_000_000_000,
    contextKey: `${browserTargetSessionKey(TARGET)}::1`,
  };
}

function makeRig(initialOwners: number[] = []) {
  let contextsListener: (event: BrowserTargetJsContextEvent) => void = () => {};
  let consoleListener: (targetId: string, entry: ConsoleEntry) => void = () => {};
  let ownersListener: BrowserTargetOwnersListener = () => {};
  const owners = new Map<string, number[]>([[TARGET, initialOwners]]);
  const contexts = {
    recordCreated: vi.fn(),
    recordDestroyed: vi.fn(),
    clearSession: vi.fn(),
  };
  const consoleSink = { recordEntry: vi.fn() };
  const fanout = startBrowserTargetFanout({
    source: {
      subscribeContexts(listener) {
        contextsListener = listener;
        return () => {};
      },
      subscribeConsole(listener) {
        consoleListener = listener;
        return () => {};
      },
    },
    controller: {
      ownersOf: (targetId) => owners.get(targetId) ?? [],
      onOwnersChanged(listener) {
        ownersListener = listener;
        return () => {};
      },
    },
    contexts,
    console: consoleSink,
  });
  return {
    fanout,
    owners,
    contexts,
    consoleSink,
    emitContexts: (event: BrowserTargetJsContextEvent) => contextsListener(event),
    emitConsole: (entry: ConsoleEntry) => consoleListener(TARGET, entry),
    emitOwnersChanged: (added: number[], removed: number[]) => ownersListener(TARGET, added, removed),
  };
}

describe('startBrowserTargetFanout', () => {
  it('fans context and console events to every committed owner', () => {
    const rig = makeRig([TAB, OTHER_TAB]);
    const context = makeContext(1);
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context });
    rig.emitContexts({ kind: 'context-destroyed', targetId: TARGET, contextKey: context.contextKey });
    rig.emitConsole(makeEntry());
    expect(rig.contexts.recordCreated).toHaveBeenCalledWith(TAB, context);
    expect(rig.contexts.recordCreated).toHaveBeenCalledWith(OTHER_TAB, context);
    expect(rig.contexts.recordDestroyed).toHaveBeenCalledWith(TAB, context.contextKey);
    expect(rig.contexts.recordDestroyed).toHaveBeenCalledWith(OTHER_TAB, context.contextKey);
    expect(rig.consoleSink.recordEntry).toHaveBeenCalledTimes(2);
  });

  it('feeds the mirror but no hub while a target has no owners', () => {
    const rig = makeRig([]);
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context: makeContext(1) });
    rig.emitConsole(makeEntry());
    expect(rig.contexts.recordCreated).not.toHaveBeenCalled();
    expect(rig.consoleSink.recordEntry).not.toHaveBeenCalled();
    rig.owners.set(TARGET, [TAB]);
    rig.emitOwnersChanged([TAB], []);
    expect(rig.contexts.recordCreated).toHaveBeenCalledWith(TAB, makeContext(1));
  });

  it('seeds a joining owner from the live mirror and skips destroyed contexts', () => {
    const rig = makeRig([TAB]);
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context: makeContext(1) });
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context: makeContext(2) });
    rig.emitContexts({ kind: 'context-destroyed', targetId: TARGET, contextKey: makeContext(1).contextKey });
    rig.owners.set(TARGET, [TAB, OTHER_TAB]);
    rig.emitOwnersChanged([OTHER_TAB], []);
    expect(rig.contexts.recordCreated).toHaveBeenCalledWith(OTHER_TAB, makeContext(2));
    expect(rig.contexts.recordCreated).not.toHaveBeenCalledWith(OTHER_TAB, makeContext(1));
  });

  it('clears the session subset from a leaving owner', () => {
    const rig = makeRig([TAB]);
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context: makeContext(1) });
    rig.owners.set(TARGET, []);
    rig.emitOwnersChanged([], [TAB]);
    expect(rig.contexts.clearSession).toHaveBeenCalledWith(TAB, browserTargetSessionKey(TARGET));
  });

  it('target-cleared clears all owners and drops the mirror', () => {
    const rig = makeRig([TAB, OTHER_TAB]);
    rig.emitContexts({ kind: 'context-created', targetId: TARGET, context: makeContext(1) });
    rig.emitContexts({ kind: 'target-cleared', targetId: TARGET });
    expect(rig.contexts.clearSession).toHaveBeenCalledWith(TAB, browserTargetSessionKey(TARGET));
    expect(rig.contexts.clearSession).toHaveBeenCalledWith(OTHER_TAB, browserTargetSessionKey(TARGET));
    rig.emitOwnersChanged([TAB], []);
    expect(rig.contexts.recordCreated).toHaveBeenCalledTimes(2);
  });

  it('gives console entries no backfill on a late join', () => {
    const rig = makeRig([]);
    rig.emitConsole(makeEntry());
    rig.owners.set(TARGET, [TAB]);
    rig.emitOwnersChanged([TAB], []);
    expect(rig.consoleSink.recordEntry).not.toHaveBeenCalled();
  });
});
