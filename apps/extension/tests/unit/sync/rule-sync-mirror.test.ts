/**
 * Phase A Fw8 — renderer-side rule sync mirror.
 *
 * The mirror folds `syncBroadcast` events into a per-rule view that
 * write helpers consult synchronously. We verify:
 *   - rulePostState payloads land under their rule.uid
 *   - subscribers fire on each broadcast that touches their uid
 *   - delete envelopes (rulePostState undefined) drop the entry
 *   - dispose drops the bridge subscription
 */

import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubscribe, mockCall } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockCall: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  call: mockCall,
  subscribe: mockSubscribe,
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createRuleSyncMirror,
  disposeAllRuleSyncMirrors,
  getRuleSyncMirrorForWorkspace,
} from '@/context/rule-sync-mirror';

type Handler = (event: {
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  batchId?: string;
  rulePostState?: { rule: Rule; setItemIds: Record<string, string[]> };
}) => void;

let lastHandler: Handler | null = null;
let unsubscribeMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  lastHandler = null;
  unsubscribeMock = vi.fn();
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: Handler) => {
    if (type === 'syncBroadcast') lastHandler = handler;
    return unsubscribeMock;
  });
  mockCall.mockReset();
  mockCall.mockResolvedValue({ entries: [] });
});

afterEach(() => {
  disposeAllRuleSyncMirrors();
});

const env = (uid: string): MutationEnvelope => ({
  mutationId: `m-${Math.random()}`,
  hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  mutatorVersion: 1,
  body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: uid, path: 'name', value: 'x' },
});

const rule = (uid: string, name = 'r'): Rule => ({ uid, name } as unknown as Rule);

const outcome: MutatorOutcome = { status: 'applied' };

describe('rule sync mirror', () => {
  it('folds rulePostState payloads into a per-uid view', () => {
    const mirror = createRuleSyncMirror('ws-1', { bootstrap: false });
    expect(mirror.getRuleMirror('r1')).toBeNull();

    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1', 'n1'), setItemIds: { conditions: ['c1', 'c2'] } },
    });

    expect(mirror.getRuleMirror('r1')?.rule.name).toBe('n1');
    expect(mirror.liveSetItems('r1', 'conditions')).toEqual(['c1', 'c2']);
    expect(mirror.liveSetItems('r1', 'action.requestHeaders')).toEqual([]);
    expect(mirror.liveSetItems('rZ', 'conditions')).toEqual([]);
  });

  it('notifies subscribers on every touching broadcast', () => {
    const mirror = createRuleSyncMirror('ws-1', { bootstrap: false });
    const seen: string[] = [];
    const off = mirror.subscribeRuleMirror('r1', (uid) => seen.push(uid));

    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1'), setItemIds: {} },
    });
    lastHandler?.({
      envelope: env('rOther'),
      outcome,
      rulePostState: { rule: rule('rOther'), setItemIds: {} },
    });
    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1'), setItemIds: { conditions: ['c1'] } },
    });

    expect(seen).toEqual(['r1', 'r1']);
    off();
    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1'), setItemIds: {} },
    });
    expect(seen).toEqual(['r1', 'r1']);
  });

  it('drops the entry on tombstone (no rulePostState)', () => {
    const mirror = createRuleSyncMirror('ws-1', { bootstrap: false });
    const seen: string[] = [];
    mirror.subscribeRuleMirror('r1', (uid) => seen.push(uid));
    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1'), setItemIds: {} },
    });
    expect(mirror.getRuleMirror('r1')).not.toBeNull();
    lastHandler?.({ envelope: env('r1'), outcome });
    expect(mirror.getRuleMirror('r1')).toBeNull();
    expect(seen).toEqual(['r1', 'r1']);
  });

  it('per-workspace registry reuses one bridge subscription per workspace', () => {
    const a = getRuleSyncMirrorForWorkspace('ws-1');
    const b = getRuleSyncMirrorForWorkspace('ws-1');
    expect(a).toBe(b);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    const c = getRuleSyncMirrorForWorkspace('ws-2');
    expect(c).not.toBe(a);
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });

  it('bootstrap seeds entries from oh.sync.snapshotRules', async () => {
    mockCall.mockResolvedValueOnce({
      entries: [
        { rule: rule('rA', 'A'), setItemIds: { conditions: ['c1'] } },
        { rule: rule('rB', 'B'), setItemIds: {} },
      ],
    });
    const mirror = createRuleSyncMirror('ws-1');
    expect(mockCall).toHaveBeenCalledWith('oh.sync.snapshotRules', { workspaceId: 'ws-1' });
    await Promise.resolve();
    await Promise.resolve();
    expect(mirror.getRuleMirror('rA')?.rule.name).toBe('A');
    expect(mirror.liveSetItems('rA', 'conditions')).toEqual(['c1']);
    expect(mirror.getRuleMirror('rB')?.rule.name).toBe('B');
  });

  it('bootstrap defers to broadcasts that landed first', async () => {
    let resolveSnap!: (v: { entries: Array<{ rule: Rule; setItemIds: Record<string, string[]> }> }) => void;
    mockCall.mockReturnValueOnce(new Promise((res) => { resolveSnap = res; }));
    const mirror = createRuleSyncMirror('ws-1');
    // Broadcast lands while snapshot in flight.
    lastHandler?.({
      envelope: env('rA'),
      outcome,
      rulePostState: { rule: rule('rA', 'fresh'), setItemIds: { conditions: ['c-fresh'] } },
    });
    resolveSnap({ entries: [{ rule: rule('rA', 'stale'), setItemIds: { conditions: ['c-stale'] } }] });
    await Promise.resolve();
    await Promise.resolve();
    expect(mirror.getRuleMirror('rA')?.rule.name).toBe('fresh');
    expect(mirror.liveSetItems('rA', 'conditions')).toEqual(['c-fresh']);
  });

  it('dispose drops the bridge subscription and clears state', () => {
    const mirror = createRuleSyncMirror('ws-1', { bootstrap: false });
    lastHandler?.({
      envelope: env('r1'),
      outcome,
      rulePostState: { rule: rule('r1'), setItemIds: { conditions: ['c1'] } },
    });
    expect(mirror.getRuleMirror('r1')).not.toBeNull();
    mirror.dispose();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mirror.getRuleMirror('r1')).toBeNull();
  });
});
