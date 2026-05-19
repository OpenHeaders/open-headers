/**
 * Renderer-side singleton-entity sync mirror — shared core.
 *
 * Sibling of the flat-entity mirror, used by the one-per-scope
 * entities (vault, workspace-variables, layout-state, files,
 * pause-markers, extension-workspace). Same broadcast → mirror →
 * notify discipline; the only structural difference is `Entry` is a
 * single record, not a uid-keyed map. We verify the core invariants
 * directly with a synthetic adapter:
 *   - cross-workspace filter rejects events stamped for a different
 *     workspaceId BEFORE calling the adapter
 *   - extract → `null` means "not my entity"; the core skips
 *   - extract → entry stores + notifies
 *   - extract → `'tombstone'` clears the entry + notifies, but ONLY
 *     when there was a non-null entry to begin with
 *   - listener errors don't tear down the broadcast pipe
 *   - late-snapshot race: a broadcast that lands during the snapshot
 *     fetch wins; the snapshot is skipped entirely (singleton has no
 *     uid-dimension to partition)
 *   - bootstrap-disabled construction never calls fetchSnapshot
 *   - bootstrap failure resolves `hydrated` cleanly; mirror stays null
 *   - snapshot returning `null` leaves the mirror null
 *   - dispose unsubscribes from the bridge and clears state
 */

import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
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
  createSingletonEntityMirror,
  type SingletonExtractResult,
  type SyncBroadcastPayload,
} from '@openheaders/ui/context';

type Handler = (event: SyncBroadcastPayload) => void;

interface Entry {
  marker: string;
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

function makeEvent(workspaceId = 'ws-1'): SyncBroadcastPayload {
  const envelope: MutationEnvelope = {
    mutationId: `m-${Math.random()}`,
    hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId,
    mutatorVersion: 1,
    body: { kind: 'setField', type: VAULT_ENTITY_TYPE, id: 'vault', path: 'x', value: 1 },
  };
  const outcome: MutatorOutcome = { status: 'applied' };
  return { envelope, outcome } as unknown as SyncBroadcastPayload;
}

describe('singleton-entity-mirror core', () => {
  it('rejects events stamped for a different workspaceId before calling the adapter', () => {
    const extract = vi.fn(() => null as SingletonExtractResult<Entry>);
    createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: extract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent('ws-OTHER'));
    expect(extract).not.toHaveBeenCalled();
  });

  it('stores the entry the adapter extracts and exposes it via get()', () => {
    let nextExtract: SingletonExtractResult<Entry> = null;
    const mirror = createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => nextExtract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    expect(mirror.get()).toBeNull();
    nextExtract = { marker: 'live' };
    lastHandler?.(makeEvent());
    expect(mirror.get()).toEqual({ marker: 'live' });
  });

  it('tombstone clears the entry and notifies (only when there was an entry to clear)', () => {
    let nextExtract: SingletonExtractResult<Entry> = null;
    const mirror = createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => nextExtract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    let notifyCount = 0;
    mirror.subscribe(() => notifyCount++);
    // First tombstone on an empty mirror does NOT notify — there was
    // no entry to clear and the subscriber would see a spurious change.
    nextExtract = 'tombstone';
    lastHandler?.(makeEvent());
    expect(notifyCount).toBe(0);
    // Set then tombstone fires exactly one set + one clear.
    nextExtract = { marker: 'live' };
    lastHandler?.(makeEvent());
    expect(notifyCount).toBe(1);
    nextExtract = 'tombstone';
    lastHandler?.(makeEvent());
    expect(notifyCount).toBe(2);
    expect(mirror.get()).toBeNull();
  });

  it('subscribers fire on every live update and on every tombstone-of-a-live-entry', () => {
    let nextExtract: SingletonExtractResult<Entry> = null;
    const mirror = createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => nextExtract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    const seen: string[] = [];
    mirror.subscribe(() => {
      seen.push(mirror.get()?.marker ?? 'null');
    });
    nextExtract = { marker: 'a' };
    lastHandler?.(makeEvent());
    nextExtract = { marker: 'b' };
    lastHandler?.(makeEvent());
    expect(seen).toEqual(['a', 'b']);
  });

  it('a throwing listener does not tear down the pipe for other listeners', () => {
    let nextExtract: SingletonExtractResult<Entry> = null;
    const mirror = createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => nextExtract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    let survivorCount = 0;
    mirror.subscribe(() => {
      throw new Error('boom');
    });
    mirror.subscribe(() => survivorCount++);
    nextExtract = { marker: 'live' };
    lastHandler?.(makeEvent());
    expect(survivorCount).toBe(1);
  });

  it('late-snapshot race: broadcast that landed mid-fetch wins; snapshot is skipped entirely', async () => {
    let nextExtract: SingletonExtractResult<Entry> = { marker: 'BROADCAST' };
    let resolveSnapshot: (s: Entry | null) => void = () => undefined;
    const snapshotPromise = new Promise<Entry | null>((resolve) => {
      resolveSnapshot = resolve;
    });
    const mirror = createSingletonEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => nextExtract,
      fetchSnapshot: () => snapshotPromise,
    });
    // Broadcast arrives BEFORE the snapshot resolves.
    lastHandler?.(makeEvent());
    expect(mirror.get()?.marker).toBe('BROADCAST');
    // Resolve the snapshot with a (stale) record.
    resolveSnapshot({ marker: 'STALE_SNAPSHOT' });
    await mirror.hydrated;
    // The broadcast wins — the mirror keeps its fresher entry.
    expect(mirror.get()?.marker).toBe('BROADCAST');
  });

  it('snapshot record is applied when no broadcast won the race first', async () => {
    const mirror = createSingletonEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => null,
      fetchSnapshot: () => Promise.resolve({ marker: 'from-snapshot' }),
    });
    await mirror.hydrated;
    expect(mirror.get()?.marker).toBe('from-snapshot');
  });

  it('snapshot returning null leaves the mirror null without notifying', async () => {
    const mirror = createSingletonEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => null,
      fetchSnapshot: () => Promise.resolve(null),
    });
    let notifyCount = 0;
    mirror.subscribe(() => notifyCount++);
    await mirror.hydrated;
    expect(mirror.get()).toBeNull();
    expect(notifyCount).toBe(0);
  });

  it('bootstrap: false constructs without calling fetchSnapshot; hydrated resolves immediately', async () => {
    const fetchSnapshot = vi.fn(() => Promise.resolve(null));
    const mirror = createSingletonEntityMirror<Entry>(
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

  it('bootstrap failure resolves `hydrated` cleanly; the mirror stays null', async () => {
    const mirror = createSingletonEntityMirror<Entry>({
      loggerTag: 'test',
      workspaceId: 'ws-1',
      extractFromBroadcast: () => null,
      fetchSnapshot: () => Promise.reject(new Error('bridge dead')),
    });
    await expect(mirror.hydrated).resolves.toBeUndefined();
    expect(mirror.get()).toBeNull();
  });

  it('dispose unsubscribes from the bridge and clears the entry + listeners', () => {
    let nextExtract: SingletonExtractResult<Entry> = { marker: 'live' };
    const mirror = createSingletonEntityMirror<Entry>(
      {
        loggerTag: 'test',
        workspaceId: 'ws-1',
        extractFromBroadcast: () => nextExtract,
        fetchSnapshot: () => Promise.resolve(null),
      },
      { bootstrap: false },
    );
    lastHandler?.(makeEvent());
    let survivorCount = 0;
    mirror.subscribe(() => survivorCount++);
    mirror.dispose();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mirror.get()).toBeNull();
    // After dispose, listeners are cleared — subsequent broadcast plays
    // out against an empty handler set.
    nextExtract = { marker: 'after-dispose' };
    lastHandler?.(makeEvent());
    expect(survivorCount).toBe(0);
  });
});
