/**
 * Renderer-side workspace-roots sync mirror — the singleton adapter
 * over `workspaceRootsPostState` / `oh.sync.snapshotWorkspaceRoots`,
 * and the append key a collection create takes after the live tail.
 */

import type { SyncWorkspaceRootsPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import {
  keyBetween,
  VAULT_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
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

import { createWorkspaceRootsSyncMirror, type SyncBroadcastPayload } from '@openheaders/ui/context';

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

function postState(ruleCollections: string[]): SyncWorkspaceRootsPostState {
  return {
    workspaceRoots: { schemaVersion: 5, ruleCollections, requestCollections: [], templateCollections: [] },
    setOrderKeys: {
      [WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH]: ruleCollections.map((uid, i) => ({ itemId: uid, orderKey: `a${i}` })),
    },
  };
}

function makeEvent(type: string, workspaceRootsPostState?: SyncWorkspaceRootsPostState): SyncBroadcastPayload {
  const envelope: MutationEnvelope = {
    mutationId: `m-${Math.random()}`,
    hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'ws-1',
    orgId: 'org-test',
    mutatorVersion: 1,
    body: {
      kind: 'addToSet',
      type,
      id: WORKSPACE_ROOTS_ID,
      path: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
      itemId: 'col00001',
      item: { uid: 'col00001' },
    },
  };
  const outcome: MutatorOutcome = { status: 'applied' };
  return { envelope, outcome, workspaceRootsPostState } as unknown as SyncBroadcastPayload;
}

describe('workspace-roots sync mirror', () => {
  it('lands a roots broadcast as the live order and mints the append key after the tail', () => {
    const mirror = createWorkspaceRootsSyncMirror('ws-1', { bootstrap: false });
    const listener = vi.fn();
    mirror.subscribeMirror(listener);
    expect(mirror.appendOrderKey(WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)).toBe(keyBetween(null, null));
    lastHandler?.(makeEvent(WORKSPACE_ROOTS_ENTITY_TYPE, postState(['col00002', 'col00001'])));
    expect(mirror.getMirror()?.workspaceRoots.ruleCollections).toEqual(['col00002', 'col00001']);
    expect(mirror.liveOrderedSetItems(WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH).map((e) => e.itemId)).toEqual([
      'col00002',
      'col00001',
    ]);
    expect(mirror.appendOrderKey(WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)).toBe(keyBetween('a1', null));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores another entity type and tombstones on a matching envelope without post-state', () => {
    const mirror = createWorkspaceRootsSyncMirror('ws-1', { bootstrap: false });
    lastHandler?.(makeEvent(WORKSPACE_ROOTS_ENTITY_TYPE, postState(['col00001'])));
    lastHandler?.(makeEvent(VAULT_ENTITY_TYPE, undefined));
    expect(mirror.getMirror()).not.toBeNull();
    lastHandler?.(makeEvent(WORKSPACE_ROOTS_ENTITY_TYPE, undefined));
    expect(mirror.getMirror()).toBeNull();
  });

  it('seeds from the bootstrap snapshot scoped to the workspace', async () => {
    mockCall.mockResolvedValue({ entries: [postState(['col00009'])] });
    const mirror = createWorkspaceRootsSyncMirror('ws-1');
    await mirror.hydrated;
    expect(mockCall).toHaveBeenCalledWith('oh.sync.snapshotWorkspaceRoots', { workspaceId: 'ws-1' });
    expect(mirror.getMirror()?.workspaceRoots.ruleCollections).toEqual(['col00009']);
  });
});
