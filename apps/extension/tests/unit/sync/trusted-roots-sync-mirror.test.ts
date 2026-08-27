/**
 * Renderer-side trusted-roots sync mirror — the singleton adapter over
 * `trustedRootsPostState` / `oh.sync.snapshotTrustedRoots`. We verify:
 *   - a trusted-roots broadcast with post-state lands as the live list
 *   - a foreign entity's broadcast is ignored
 *   - post-state absent on a matching envelope tombstones the list
 *   - the bootstrap snapshot seeds the list when no broadcast raced it
 */

import type { SyncTrustedRootsPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { TrustedRoot } from '@openheaders/core/types';
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

import { createTrustedRootsSyncMirror, type SyncBroadcastPayload } from '@openheaders/ui/context';

type Handler = (event: SyncBroadcastPayload) => void;

let lastHandler: Handler | null = null;

beforeEach(() => {
  lastHandler = null;
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: Handler) => {
    if (type === 'syncBroadcast') lastHandler = handler;
    return () => undefined;
  });
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRoot(uid: string): TrustedRoot {
  return {
    uid,
    name: `Root ${uid}`,
    certPem: `-----BEGIN CERTIFICATE-----\n${uid}\n-----END CERTIFICATE-----`,
    addedAt: '2026-08-27T00:00:00.000Z',
  };
}

function postState(roots: TrustedRoot[]): SyncTrustedRootsPostState {
  return {
    trustedRoots: { schemaVersion: 5, roots },
    rootUids: roots.map((r) => r.uid),
    setOrderKeys: { roots: roots.map((r, i) => ({ itemId: r.uid, orderKey: `a${i}` })) },
  };
}

function makeEvent(type: string, trustedRootsPostState?: SyncTrustedRootsPostState): SyncBroadcastPayload {
  const envelope: MutationEnvelope = {
    mutationId: `m-${Math.random()}`,
    hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'ws-1',
    orgId: 'org-test',
    mutatorVersion: 1,
    body: { kind: 'setField', type, id: TRUSTED_ROOTS_ID, path: 'x', value: 1 },
  };
  const outcome: MutatorOutcome = { status: 'applied' };
  return { envelope, outcome, trustedRootsPostState } as unknown as SyncBroadcastPayload;
}

describe('trusted-roots sync mirror', () => {
  it('lands a trusted-roots broadcast as the live list and notifies', () => {
    const mirror = createTrustedRootsSyncMirror('ws-1', { bootstrap: false });
    const listener = vi.fn();
    mirror.subscribeMirror(listener);
    expect(mirror.liveRoots()).toEqual([]);
    lastHandler?.(makeEvent(TRUSTED_ROOTS_ENTITY_TYPE, postState([makeRoot('r1'), makeRoot('r2')])));
    expect(mirror.liveRoots().map((r) => r.uid)).toEqual(['r1', 'r2']);
    expect(mirror.getMirror()?.rootUids).toEqual(['r1', 'r2']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores another entity type and tombstones on a matching envelope without post-state', () => {
    const mirror = createTrustedRootsSyncMirror('ws-1', { bootstrap: false });
    lastHandler?.(makeEvent(TRUSTED_ROOTS_ENTITY_TYPE, postState([makeRoot('r1')])));
    lastHandler?.(makeEvent(VAULT_ENTITY_TYPE, undefined));
    expect(mirror.liveRoots()).toHaveLength(1);
    lastHandler?.(makeEvent(TRUSTED_ROOTS_ENTITY_TYPE, undefined));
    expect(mirror.getMirror()).toBeNull();
    expect(mirror.liveRoots()).toEqual([]);
  });

  it('seeds from the bootstrap snapshot scoped to the workspace', async () => {
    mockCall.mockResolvedValue({ entries: [postState([makeRoot('r9')])] });
    const mirror = createTrustedRootsSyncMirror('ws-1');
    await mirror.hydrated;
    expect(mockCall).toHaveBeenCalledWith('oh.sync.snapshotTrustedRoots', { workspaceId: 'ws-1' });
    expect(mirror.liveRoots().map((r) => r.uid)).toEqual(['r9']);
  });
});
