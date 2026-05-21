/**
 * Renderer-side flat-entity sync mirror — shared core.
 *
 * 17 of 18 per-entity renderer mirrors share this core. The adapters
 * only contribute `extractFromBroadcast` + `fetchSnapshot`; the
 * broadcast → mirror → notify pipeline + subscription discipline live
 * here. We verify the core invariants directly with a synthetic
 * adapter so a future refactor catches regressions before they reach
 * every concrete mirror:
 *   - cross-workspace filter rejects events stamped for a different
 *     workspaceId BEFORE calling the adapter
 *   - extract → `null` means "not my entity"; the core skips
 *   - extract → `{uid, entry}` stores + notifies per-uid + any
 *     listeners
 *   - extract → `{uid, entry: null}` is a tombstone — delete + notify
 *   - per-uid listeners fire only for their uid; any-listeners fire
 *     for every change
 *   - listener errors don't tear down the broadcast pipe for others
 *   - late-snapshot race: a broadcast that lands during snapshot
 *     fetch carries fresher state and wins; the snapshot row is
 *     skipped for that uid
 *   - bootstrap-disabled construction never calls fetchSnapshot
 *   - bootstrap-failure path leaves the mirror empty without crashing
 *   - dispose unsubscribes from the bridge and clears state
 */

import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubscribe, mockCall } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockCall: vi.fn(),
}));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: mockSubscribe,
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createFlatEntityMirror,
  type ExtractResult,
  type SyncBroadcastPayload,
} from '@openheaders/ui/context';

type Handler = (event: SyncBroadcastPayload) => void;

interface Entry {
  uid: string;
  name: string;
}

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeEvent(uid: string, workspaceId = 'ws-1'): SyncBroadcastPayload {
  const envelope: MutationEnvelope = {
    mutationId: `m-${uid}-${Math.random()}`,
    hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId,
    orgId: 'org-test',
    mutatorVersion: 1,
    body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: uid, path: 'name', value: 'x' },
  };
  const outcome: MutatorOutcome = { status: 'applied' };
  return { envelope, outcome } as unknown as SyncBroadcastPayload;
}

function makeExtractor(payload: Map<string, Entry | null>): (e: SyncBroadcastPayload) => ExtractResult<Entry> {
  return (event) => {
    const id = (event.envelope.body as { id?: string }).id;
    if (!id) return null;
    if (!payload.has(id)) return null;
    return { uid: id, entry: payload.get(id) ?? null };
  };
}

describe('flat-entity-mirror core', () => {
  it('rejects events stamped for a different workspaceId before calling the adapter', () => {
    const extract = vi.fn(() => null as ExtractResult<Entry>);
    createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: extract,
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent('e1', 'ws-OTHER'));
    expect(extract).not.toHaveBeenCalled();
  });

  it('stores entries the adapter extracts, indexes them by uid, and exposes list()', () => {
    const payload = new Map<string, Entry | null>([
      ['e1', { uid: 'e1', name: 'one' }],
      ['e2', { uid: 'e2', name: 'two' }],
    ]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent('e1'));
    lastHandler?.(makeEvent('e2'));
    expect(mirror.get('e1')?.name).toBe('one');
    expect(mirror.get('e2')?.name).toBe('two');
    expect(mirror.list()).toHaveLength(2);
    expect(mirror.get('absent')).toBeNull();
  });

  it('tombstones (entry: null) drop the entry and notify subscribers', () => {
    const payload = new Map<string, Entry | null>([['e1', { uid: 'e1', name: 'one' }]]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent('e1'));
    expect(mirror.get('e1')).not.toBeNull();
    const seen: string[] = [];
    mirror.subscribe('e1', (uid) => seen.push(uid));
    payload.set('e1', null);
    lastHandler?.(makeEvent('e1'));
    expect(mirror.get('e1')).toBeNull();
    expect(seen).toEqual(['e1']);
  });

  it('per-uid subscribers fire only for matching uid; subscribeAny fires on every change', () => {
    const payload = new Map<string, Entry | null>([
      ['e1', { uid: 'e1', name: 'one' }],
      ['e2', { uid: 'e2', name: 'two' }],
    ]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    const e1Seen: string[] = [];
    const allSeen: string[] = [];
    mirror.subscribe('e1', (uid) => e1Seen.push(uid));
    mirror.subscribeAny((uid) => allSeen.push(uid));
    lastHandler?.(makeEvent('e1'));
    lastHandler?.(makeEvent('e2'));
    expect(e1Seen).toEqual(['e1']);
    expect(allSeen).toEqual(['e1', 'e2']);
  });

  it('per-uid unsubscribe stops further notifications for that uid only', () => {
    const payload = new Map<string, Entry | null>([['e1', { uid: 'e1', name: 'one' }]]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    const seen: string[] = [];
    const unsub = mirror.subscribe('e1', (uid) => seen.push(uid));
    lastHandler?.(makeEvent('e1'));
    unsub();
    lastHandler?.(makeEvent('e1'));
    expect(seen).toEqual(['e1']);
  });

  it('a throwing listener does not tear down the pipe for other listeners', () => {
    const payload = new Map<string, Entry | null>([['e1', { uid: 'e1', name: 'one' }]]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    const survivorSeen: string[] = [];
    mirror.subscribe('e1', () => {
      throw new Error('boom');
    });
    mirror.subscribe('e1', (uid) => survivorSeen.push(uid));
    lastHandler?.(makeEvent('e1'));
    expect(survivorSeen).toEqual(['e1']);
  });

  it('late-snapshot race: broadcast that landed mid-fetch wins; snapshot row is skipped for the same uid', async () => {
    const payload = new Map<string, Entry | null>([['e1', { uid: 'e1', name: 'BROADCAST' }]]);
    let resolveSnapshot: (rows: Array<{ uid: string; entry: Entry }>) => void = () => undefined;
    const snapshotPromise = new Promise<Array<{ uid: string; entry: Entry }>>((resolve) => {
      resolveSnapshot = resolve;
    });
    const mirror = createFlatEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: makeExtractor(payload),
      fetchSnapshot: () => snapshotPromise,
    });
    // Broadcast arrives BEFORE the snapshot resolves.
    lastHandler?.(makeEvent('e1'));
    expect(mirror.get('e1')?.name).toBe('BROADCAST');
    // Resolve the snapshot with a (stale) row for the same uid.
    resolveSnapshot([{ uid: 'e1', entry: { uid: 'e1', name: 'STALE_SNAPSHOT' } }]);
    await mirror.hydrated;
    // The broadcast wins — the mirror keeps its fresher entry.
    expect(mirror.get('e1')?.name).toBe('BROADCAST');
  });

  it('snapshot rows for uids NOT seen via broadcast are still applied (the race only skips overwrites)', async () => {
    const mirror = createFlatEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => null,
      fetchSnapshot: () => Promise.resolve([{ uid: 'e1', entry: { uid: 'e1', name: 'from-snapshot' } }]),
    });
    await mirror.hydrated;
    expect(mirror.get('e1')?.name).toBe('from-snapshot');
  });

  it('bootstrap: false constructs without calling fetchSnapshot; hydrated resolves immediately', async () => {
    const fetchSnapshot = vi.fn(() => Promise.resolve([]));
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => null,
        fetchSnapshot,
      },
      { bootstrap: false },
    );
    await mirror.hydrated;
    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it('bootstrap failure resolves `hydrated` cleanly; the mirror stays empty', async () => {
    const mirror = createFlatEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => null,
      fetchSnapshot: () => Promise.reject(new Error('bridge dead')),
    });
    await expect(mirror.hydrated).resolves.toBeUndefined();
    expect(mirror.list()).toEqual([]);
  });

  it('dispose unsubscribes from the bridge and clears entries + listeners', () => {
    const payload = new Map<string, Entry | null>([['e1', { uid: 'e1', name: 'one' }]]);
    const mirror = createFlatEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: makeExtractor(payload),
        fetchSnapshot: () => Promise.resolve([]),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent('e1'));
    const seen: string[] = [];
    mirror.subscribe('e1', (uid) => seen.push(uid));
    mirror.dispose();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mirror.get('e1')).toBeNull();
    // A late event after dispose still fires the cached handler (the
    // handler is captured in module-level `lastHandler` for the test),
    // but the mirror's internal state is cleared so subscribers don't
    // re-fire.
    lastHandler?.(makeEvent('e1'));
    expect(seen).toEqual([]);
  });
});
