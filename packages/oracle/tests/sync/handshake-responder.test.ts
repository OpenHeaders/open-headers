/**
 * WS-B B1 — the catch-up reach gate.
 *
 * `respondToStateVector`'s `offDevicePeer` option must strip the vault
 * (same-device-only root secrets) from BOTH the snapshot blob and the
 * delta stream, while leaving every other entity — including the
 * trust-zone-scoped OAuth bundles / live values — flowing to the peer.
 * The collaborators (snapshot builder, delta reader, threshold + vector
 * readers) are mocked so the test drives the branch deterministically
 * without the storage stack.
 */

import {
  SYNC_MUTATION_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  type SyncStateVectorMessage,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  LAYOUT_STATE_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const VAULT_SNAPSHOT_ROW = { vault: { uid: 'v' }, secretUids: ['s1'] } as unknown as WorkspaceSnapshot['vault'][number];
const RULE_SNAPSHOT_ROW = {
  rule: {},
  setItemIds: {},
  setOrderKeys: {},
} as unknown as WorkspaceSnapshot['rules'][number];
const OAUTH_SNAPSHOT_ROW = {
  tokens: { ref1: { token: 'secret' } },
  configs: {},
  refreshErrors: {},
  credentialRefs: ['ref1'],
} as unknown as WorkspaceSnapshot['oauthBundles'][number];
const LAYOUT_SNAPSHOT_ROW = { layout: { panes: [] } } as unknown as WorkspaceSnapshot['layoutState'][number];

function emptySnapshot(): WorkspaceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId: 'ws-1',
    takenAtHlc: { sw: { physicalMs: 100, logical: 0, nodeId: 'sw' } },
    rules: [RULE_SNAPSHOT_ROW],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [VAULT_SNAPSHOT_ROW],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [OAUTH_SNAPSHOT_ROW],
    pauseMarkers: [],
    layoutState: [LAYOUT_SNAPSHOT_ROW],
    files: [],
  };
}

function makeEnvelope(type: string, mutationId: string): MutationEnvelope {
  return {
    mutationId,
    hlc: { physicalMs: 1, logical: 0, nodeId: 'node-a' },
    origin: { surfaceId: 's-1', deviceId: 'd-1' },
    workspaceId: 'ws-1',
    orgId: 'org-1',
    mutatorVersion: 1,
    body: { kind: 'addToSet', type, id: 'e-1', path: 'p', itemId: mutationId, item: { uid: mutationId } },
  };
}

const deltaEnvelopes: MutationEnvelope[] = [];

vi.mock('../../src/sync/snapshot-builder', () => ({
  buildSnapshotForWorkspace: vi.fn(async () => emptySnapshot()),
}));
vi.mock('../../src/sync/snapshot-threshold-reader', () => ({
  // Cold receiver with pending deltas → forces the snapshot branch.
  computeSnapshotThresholdInputsForWorkspace: vi.fn(async () => ({ peerVector: {}, estimatedDeltaCount: 1 })),
}));
vi.mock('../../src/sync/delta-stream-reader', () => ({
  readWorkspaceDeltaStream: vi.fn(async function* () {
    for (const env of deltaEnvelopes) yield env;
  }),
}));
vi.mock('../../src/sync/state-vector-reader', () => ({
  readWorkspaceStateVector: vi.fn(async () => ({ 'node-a': { physicalMs: 9, logical: 0, nodeId: 'node-a' } })),
}));

import { readWorkspaceDeltaStream } from '../../src/sync/delta-stream-reader';
import { respondToStateVector } from '../../src/sync/handshake-responder';
import { buildSnapshotForWorkspace } from '../../src/sync/snapshot-builder';

const MESSAGE = {
  type: SYNC_STATE_VECTOR_TYPE,
  workspaceId: 'ws-1',
  perNodeMaxHlc: {},
} as unknown as SyncStateVectorMessage;

type Frame = { type: string; snapshot?: WorkspaceSnapshot; envelope?: MutationEnvelope };

function collectingReply() {
  const frames: Frame[] = [];
  return {
    frames,
    send: (f: Frame): boolean => {
      frames.push(f);
      return true;
    },
  };
}

describe('respondToStateVector — WS-B reach gate (offDevicePeer)', () => {
  beforeEach(() => {
    deltaEnvelopes.length = 0;
    deltaEnvelopes.push(makeEnvelope(VAULT_ENTITY_TYPE, 'm-vault'), makeEnvelope(RULE_ENTITY_TYPE, 'm-rule'));
  });

  it('strips the vault from the snapshot and the delta stream for an off-device peer', async () => {
    const reply = collectingReply();
    const result = await respondToStateVector(MESSAGE, reply, { offDevicePeer: true });

    const snapshotFrame = reply.frames.find((f) => f.type === SYNC_SNAPSHOT_TYPE);
    expect(snapshotFrame?.snapshot?.vault).toEqual([]);
    // Non-vault entities still bootstrap — vault is the only same-device-only key.
    expect(snapshotFrame?.snapshot?.rules).toEqual([RULE_SNAPSHOT_ROW]);
    expect(snapshotFrame?.snapshot?.oauthBundles).toEqual([OAUTH_SNAPSHOT_ROW]);

    const mutationFrames = reply.frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
    expect(mutationFrames.map((f) => f.envelope?.mutationId)).toEqual(['m-rule']);
    expect(result.deltasSent).toBe(1);
    expect(reply.frames.at(-1)?.type).toBe(SYNC_SYNCED_TYPE);
  });

  it('keeps the vault in both the snapshot and the delta stream for a same-device peer', async () => {
    const reply = collectingReply();
    const result = await respondToStateVector(MESSAGE, reply, { offDevicePeer: false });

    const snapshotFrame = reply.frames.find((f) => f.type === SYNC_SNAPSHOT_TYPE);
    expect(snapshotFrame?.snapshot?.vault).toEqual([VAULT_SNAPSHOT_ROW]);

    const mutationFrames = reply.frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
    expect(mutationFrames.map((f) => f.envelope?.mutationId)).toEqual(['m-vault', 'm-rule']);
    expect(result.deltasSent).toBe(2);
  });
});

describe('respondToStateVector — host-local strip (layout)', () => {
  beforeEach(() => {
    deltaEnvelopes.length = 0;
    deltaEnvelopes.push(makeEnvelope(LAYOUT_STATE_ENTITY_TYPE, 'm-layout'), makeEnvelope(RULE_ENTITY_TYPE, 'm-rule'));
  });

  it('strips the layout from the snapshot and the delta stream for a same-device peer', async () => {
    // Host-local is an ownership boundary, not a reach one — the strip is
    // unconditional on the wire path, loopback peers included.
    const reply = collectingReply();
    const result = await respondToStateVector(MESSAGE, reply, { offDevicePeer: false });

    const snapshotFrame = reply.frames.find((f) => f.type === SYNC_SNAPSHOT_TYPE);
    expect(snapshotFrame?.snapshot?.layoutState).toEqual([]);
    expect(snapshotFrame?.snapshot?.rules).toEqual([RULE_SNAPSHOT_ROW]);

    const mutationFrames = reply.frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
    expect(mutationFrames.map((f) => f.envelope?.mutationId)).toEqual(['m-rule']);
    expect(result.deltasSent).toBe(1);
  });

  it('strips the layout for an off-device peer too', async () => {
    const reply = collectingReply();
    await respondToStateVector(MESSAGE, reply, { offDevicePeer: true });

    const snapshotFrame = reply.frames.find((f) => f.type === SYNC_SNAPSHOT_TYPE);
    expect(snapshotFrame?.snapshot?.layoutState).toEqual([]);
    const mutationFrames = reply.frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
    expect(mutationFrames.map((f) => f.envelope?.mutationId)).toEqual(['m-rule']);
  });
});

describe('respondToStateVector — workspace-list row filter (Phase 5 slice 2)', () => {
  const GLOBAL_MESSAGE = {
    type: SYNC_STATE_VECTOR_TYPE,
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    perNodeMaxHlc: { 'node-a': { physicalMs: 5, logical: 0, nodeId: 'node-a' } },
  } as unknown as SyncStateVectorMessage;

  function rowEnvelope(
    mutationId: string,
    itemId: string,
    kind: 'addToSet' | 'removeFromSet' | 'moveBefore',
  ): MutationEnvelope {
    const shared = {
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId,
    };
    const body: MutationEnvelope['body'] =
      kind === 'addToSet'
        ? { kind, ...shared, item: { id: itemId }, orderKey: 'a0' }
        : kind === 'moveBefore'
          ? { kind, ...shared, orderKey: 'a1' }
          : { kind, ...shared };
    return {
      mutationId,
      hlc: { physicalMs: 1, logical: 0, nodeId: 'node-a' },
      origin: { surfaceId: 's-1', deviceId: 'd-1' },
      workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      orgId: 'org-1',
      mutatorVersion: 1,
      body,
    };
  }

  function activeIdEnvelope(mutationId: string, value: string): MutationEnvelope {
    return {
      mutationId,
      hlc: { physicalMs: 2, logical: 0, nodeId: 'node-a' },
      origin: { surfaceId: 's-1', deviceId: 'd-1' },
      workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      orgId: 'org-1',
      mutatorVersion: 1,
      body: {
        kind: 'setField',
        type: EXTENSION_WORKSPACE_ENTITY_TYPE,
        id: EXTENSION_WORKSPACE_ID,
        path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
        value,
      },
    };
  }

  beforeEach(() => {
    deltaEnvelopes.length = 0;
    // The global scope has no snapshot blob — the builder answers null
    // (matching production) so catch-up is pure delta replay.
    vi.mocked(buildSnapshotForWorkspace).mockResolvedValueOnce(null);
  });

  it('streams only the granted rows; non-row global mutations still pass', async () => {
    deltaEnvelopes.push(
      rowEnvelope('m-a-add', 'ws-a', 'addToSet'),
      rowEnvelope('m-b-add', 'ws-b', 'addToSet'),
      rowEnvelope('m-b-move', 'ws-b', 'moveBefore'),
      rowEnvelope('m-b-remove', 'ws-b', 'removeFromSet'),
      activeIdEnvelope('m-active', 'ws-b'),
    );
    const reply = collectingReply();
    const result = await respondToStateVector(GLOBAL_MESSAGE, reply, {
      workspaceListRowFilter: (workspaceId) => workspaceId === 'ws-a',
    });

    const mutationFrames = reply.frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
    expect(mutationFrames.map((f) => f.envelope?.mutationId)).toEqual(['m-a-add', 'm-active']);
    expect(result.deltasSent).toBe(2);
    expect(reply.frames.at(-1)?.type).toBe(SYNC_SYNCED_TYPE);
  });

  it('replays from the EMPTY vector when the filter is set; honors the peer vector when unset', async () => {
    deltaEnvelopes.push(rowEnvelope('m-a-add', 'ws-a', 'addToSet'));
    const reader = vi.mocked(readWorkspaceDeltaStream);

    await respondToStateVector(GLOBAL_MESSAGE, collectingReply(), { workspaceListRowFilter: () => true });
    expect(reader.mock.calls.at(-1)?.[1]).toEqual({});

    vi.mocked(buildSnapshotForWorkspace).mockResolvedValueOnce(null);
    await respondToStateVector(GLOBAL_MESSAGE, collectingReply(), {});
    expect(reader.mock.calls.at(-1)?.[1]).toEqual(GLOBAL_MESSAGE.perNodeMaxHlc);
  });
});
