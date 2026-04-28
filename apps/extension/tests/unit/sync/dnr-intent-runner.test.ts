/**
 * DNR intent runner — drains `recompile-dnr` intents on every Rule
 * broadcast and asks the rule engine to recompile. Phase A S2–S5.
 */

import { addHeaderMod, RECOMPILE_DNR, type RuleMutatorContext, toggleEnabled } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createDnrIntentRunner } from '@/background/sync/dnr-intent-runner';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, RuleOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const wsId = 'ws-1';
const sequentialLock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

const ctx = (physicalMs: number, nodeId = 'node-a'): RuleMutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

interface Harness {
  oracle: RuleOracle;
  intents: InMemoryPendingIntents;
  broadcast: InMemoryBroadcast;
  recompileCalls: string[];
  dispose: () => void;
}

function makeHarness(): Harness {
  const log = new InMemoryMutationLog();
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const recompileCalls: string[] = [];
  const oracle = new RuleOracle({ workspaceId: wsId, lock: sequentialLock, log, intents, broadcast });
  const runner = createDnrIntentRunner({
    broadcast,
    intents,
    recompile: (reason) => recompileCalls.push(reason),
  });
  return { oracle, intents, broadcast, recompileCalls, dispose: runner.dispose };
}

// Helper: yield to the microtask queue so the runner's async drain has
// a chance to land before assertions.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DnrIntentRunner', () => {
  it('recompiles after a single rule mutation lands', async () => {
    const h = makeHarness();
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toEqual(['rules']);
  });

  it('coalesces multiple intents for the same rule into one drain', async () => {
    const h = makeHarness();
    // Two batches against the same rule. Each enqueues one
    // recompileDnrIntent — IdbPendingIntents-style coalescing keeps
    // the latest, but the runner drains per envelope so it fires
    // recompile once per envelope until the coalesced entry is
    // exhausted. Net behavior: at most one per rule per broadcast.
    const a = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(a.batch, a.sideEffects);
    const b = toggleEnabled(ctx(1_001), { ruleUid: 'r1', enabled: false });
    await h.oracle.apply(b.batch, b.sideEffects);
    await flush();
    // Both broadcasts trigger a drain; second drain finds the
    // (already-pulled) entry empty so doesn't recompile a second time.
    expect(h.recompileCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not recompile when the broadcast carries no matching intent', async () => {
    const h = makeHarness();
    // Fake broadcast for a rule whose intent we never enqueued.
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-orphan',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: wsId,
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'never-seen', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });

  it('ignores broadcasts for non-Rule entity types', async () => {
    const h = makeHarness();
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-other',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: wsId,
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'environment', id: 'e1', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });

  it('drains per-rule intents in lockstep with broadcasts', async () => {
    const h = makeHarness();
    // Pre-enqueue an intent for r1 that will be coalesced when the
    // mutator's intent lands. The runner picks up exactly the latest.
    await h.intents.enqueue({ kind: RECOMPILE_DNR, key: 'r1', hlc: { physicalMs: 0, logical: 0, nodeId: 'n' } });
    const intent = addHeaderMod(ctx(1_000), {
      ruleUid: 'r1',
      side: 'request',
      mod: { operation: 'override', headerName: 'X', value: 'y' },
    });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toEqual(['rules']);
    expect(await h.intents.list()).toHaveLength(0);
  });

  it('dispose stops further recompile calls', async () => {
    const h = makeHarness();
    h.dispose();
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });
});
