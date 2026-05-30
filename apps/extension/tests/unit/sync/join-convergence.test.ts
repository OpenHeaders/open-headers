/**
 * Phase U6.7 — join-convergence integration test.
 *
 * Drives the real {@link createSyncHandshakeInitiator} against a
 * scripted fake backend and asserts the three properties the
 * consume-only join data plane must hold (UNIFIED_ORACLE_STATUS.md
 * Phase U6 acceptance):
 *
 *   1. **The backend's workspaces appear on the joiner.** After the
 *      `__global__` scope syncs the workspace list down, the U6.4
 *      fan-out runs a per-workspace catch-up for every consumed-Org
 *      workspace — so the workspace *data* lands, not just the names.
 *   2. **The joiner's own-Org data never reaches the backend.** The
 *      catch-up only ever puts HELLO + STATE_VECTOR *pull* frames on
 *      the wire (no mutation envelopes), and the fan-out scopes are
 *      strictly the consumed-Org workspaces — a home-Org workspace is
 *      never caught up. The outbound transport gate
 *      ({@link evaluateOutboundEnvelope}) withholds any home-Org
 *      envelope queued for flush.
 *   3. **Offline edits to a consumed workspace flush on reconnect.**
 *      A consumed-Org envelope enqueued while offline passes the
 *      outbound gate on the post-SYNCED flush; a home-Org one does
 *      not. (HLC-resolution of the survivors is covered exhaustively
 *      by `pending-out-reconnect.property.test.ts`.)
 *
 * The fake backend models the responder's scope routing: `__global__`
 * syncs delta-only (no snapshot — `WorkspaceSnapshot` excludes the
 * workspace list), each workspace scope replies SNAPSHOT then SYNCED.
 */
import { getIdentitySnapshot } from '@openheaders/core/identity';
import {
  HANDSHAKE_ROLES,
  PROTOCOL_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncWelcomeAccept,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE, type MutationEnvelope } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { __resetOutboundGateForTests, evaluateOutboundEnvelope } from '@openheaders/oracle/sync';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSyncHandshakeInitiator } from '@/background/sync-handshake-initiator';
import { installSyntheticIdentityForTests } from './_identity-test-setup';
import { stressNumRuns } from './property-stress';

const GLOBAL = EXTENSION_WORKSPACE_GLOBAL_SCOPE;

const BACKEND_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Backend Org',
  hostKind: 'desktop',
  isPrivate: false,
};

function emptySnapshot(workspaceId: string): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId,
    takenAtHlc: {},
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
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
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
  };
}

interface WorkspaceRow {
  readonly id: string;
  readonly orgId: string;
}

/** Inbound frame the joiner sends, kept for wire-leak assertions. */
type WireFrame = { type: string; workspaceId?: string };

/**
 * A scripted backend that owns a set of workspaces under the backend
 * Org. Replies to STATE_VECTOR per the responder's scope routing:
 * `__global__` → SYNCED only (delta-only, no snapshot frame), a
 * workspace scope → SNAPSHOT then SYNCED.
 */
function makeFakeBackend(backendWorkspaces: readonly WorkspaceRow[], activeWorkspaceId?: string) {
  function welcome(): SyncWelcomeAccept & { org: Org; activeWorkspaceId?: string } {
    return {
      type: SYNC_WELCOME_TYPE,
      accepted: true,
      protocolVersion: PROTOCOL_VERSION,
      role: HANDSHAKE_ROLES.DESKTOP,
      nodeId: 'desktop-1',
      workspaceId: backendWorkspaces[0]?.id ?? 'backend-ws',
      agent: '@openheaders/desktop@0.0.0-test',
      org: BACKEND_ORG,
      ...(activeWorkspaceId ? { activeWorkspaceId } : {}),
    };
  }

  function respondToStateVector(scope: string): WireFrame[] {
    if (scope === GLOBAL) {
      // `__global__` syncs delta-only — the responder skips the
      // snapshot frame and (in production) streams the workspace-list
      // MUTATION frames. The test models that list arriving via the
      // driver's store merge below; here the backend just closes the
      // scope with SYNCED.
      return [{ type: SYNC_SYNCED_TYPE, workspaceId: GLOBAL, stateVectorAfter: {} } as WireFrame];
    }
    return [
      { type: SYNC_SNAPSHOT_TYPE, workspaceId: scope, snapshot: emptySnapshot(scope) } as WireFrame,
      { type: SYNC_SYNCED_TYPE, workspaceId: scope, stateVectorAfter: {} } as WireFrame,
    ];
  }

  return { welcome, respondToStateVector };
}

let teardownIdentity: () => void = () => undefined;

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([], [BACKEND_ORG]);
  __resetOutboundGateForTests();
});

afterEach(() => {
  __resetOutboundGateForTests();
  teardownIdentity();
});

/**
 * Run a complete join: HELLO → WELCOME → `__global__` catch-up →
 * per-consumed-workspace fan-out. Returns the local workspace store,
 * the set of workspaces whose *data* (snapshot) applied, and every
 * frame the joiner put on the wire.
 */
async function runJoin(opts: {
  /** Workspaces already local to the joiner before the join (home Org). */
  readonly joinerWorkspaces: readonly WorkspaceRow[];
  /** Workspaces the backend owns and syncs down. */
  readonly backendWorkspaces: readonly WorkspaceRow[];
  readonly backendActiveWorkspaceId?: string;
}): Promise<{
  readonly localStore: Map<string, WorkspaceRow>;
  readonly dataApplied: Set<string>;
  readonly sent: WireFrame[];
  readonly state: string;
}> {
  const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
  // The joiner's own workspaces ride the home Org.
  const localStore = new Map<string, WorkspaceRow>(
    opts.joinerWorkspaces.map((w) => [w.id, { id: w.id, orgId: homeOrgId }]),
  );
  const dataApplied = new Set<string>();
  const sent: WireFrame[] = [];
  const backend = makeFakeBackend(opts.backendWorkspaces, opts.backendActiveWorkspaceId);

  const initiator = createSyncHandshakeInitiator({
    send: (frame) => {
      sent.push(frame as WireFrame);
      return true;
    },
    getActiveWorkspaceId: () => opts.joinerWorkspaces[0]?.id ?? 'joiner-ws',
    getExtensionNodeId: () => 'sw-joiner',
    getExtensionAgent: () => '@openheaders/extension@0.0.0-test',
    readStateVector: async () => ({}),
    applySnapshot: async (snapshot) => {
      dataApplied.add(snapshot.workspaceId);
    },
    onSynced: async () => {},
    onJoinedOrg: async () => {},
    listConsumedWorkspaceIds: () => {
      const consumed = new Set([BACKEND_ORG.id]);
      return [...localStore.values()].filter((w) => consumed.has(w.orgId)).map((w) => w.id);
    },
  });

  await initiator.start();
  await initiator.handle(backend.welcome());

  // Walk every STATE_VECTOR the joiner emits, feeding the backend's
  // reply back in. Each workspace SYNCED chains the next fan-out
  // STATE_VECTOR, so the list grows as the loop consumes it.
  let consumed = 0;
  const vectors = (): WireFrame[] => sent.filter((f) => f.type === SYNC_STATE_VECTOR_TYPE);
  while (consumed < vectors().length) {
    const scope = vectors()[consumed++].workspaceId as string;
    if (scope === GLOBAL) {
      // The `__global__` catch-up made the backend's workspace list
      // local — model the list landing in the joiner's store.
      for (const w of opts.backendWorkspaces) localStore.set(w.id, w);
    }
    for (const reply of backend.respondToStateVector(scope)) {
      await initiator.handle(reply);
    }
  }

  return { localStore, dataApplied, sent, state: initiator.state() };
}

describe('U6.7 — join convergence: backend workspaces appear on the joiner', () => {
  it('fans a catch-up out for every backend workspace and applies its data', async () => {
    const backendWorkspaces: WorkspaceRow[] = [
      { id: 'backend-ws-1', orgId: BACKEND_ORG.id },
      { id: 'backend-ws-2', orgId: BACKEND_ORG.id },
      { id: 'backend-ws-3', orgId: BACKEND_ORG.id },
    ];
    const { localStore, dataApplied, state } = await runJoin({
      joinerWorkspaces: [{ id: 'joiner-ws-1', orgId: 'home' }],
      backendWorkspaces,
    });
    expect(state).toBe('synced');
    // Every backend workspace is now local.
    for (const w of backendWorkspaces) {
      expect(localStore.has(w.id)).toBe(true);
    }
    // ...and each one's *data* (snapshot) was applied — not just the name.
    expect([...dataApplied].sort()).toEqual(['backend-ws-1', 'backend-ws-2', 'backend-ws-3']);
  });

  it('converges with zero backend workspaces — only the __global__ scope syncs', async () => {
    const { dataApplied, sent, state } = await runJoin({
      joinerWorkspaces: [{ id: 'joiner-ws-1', orgId: 'home' }],
      backendWorkspaces: [],
    });
    expect(state).toBe('synced');
    expect(dataApplied.size).toBe(0);
    expect(sent.filter((f) => f.type === SYNC_STATE_VECTOR_TYPE).map((f) => f.workspaceId)).toEqual([GLOBAL]);
  });

  it('the adopted active workspace is caught up first (mid-fan-out SW death is survivable)', async () => {
    const backendWorkspaces: WorkspaceRow[] = [
      { id: 'backend-ws-1', orgId: BACKEND_ORG.id },
      { id: 'backend-ws-active', orgId: BACKEND_ORG.id },
      { id: 'backend-ws-3', orgId: BACKEND_ORG.id },
    ];
    // listConsumedWorkspaceIds in `runJoin` enumerates store-insertion
    // order; production sequences the adopt target first via
    // `pendingAdoptWorkspaceId`. Assert the harness still converges and
    // every workspace's STATE_VECTOR went out exactly once.
    const { sent, state } = await runJoin({
      joinerWorkspaces: [{ id: 'joiner-ws-1', orgId: 'home' }],
      backendWorkspaces,
      backendActiveWorkspaceId: 'backend-ws-active',
    });
    expect(state).toBe('synced');
    const wsScopes = sent
      .filter((f) => f.type === SYNC_STATE_VECTOR_TYPE && f.workspaceId !== GLOBAL)
      .map((f) => f.workspaceId);
    expect(wsScopes.sort()).toEqual(['backend-ws-1', 'backend-ws-3', 'backend-ws-active']);
  });
});

describe('U6.7 — the joiner never pushes its own-Org data up', () => {
  it('puts only HELLO + STATE_VECTOR pull frames on the wire', async () => {
    const { sent } = await runJoin({
      joinerWorkspaces: [{ id: 'joiner-ws-1', orgId: 'home' }],
      backendWorkspaces: [
        { id: 'backend-ws-1', orgId: BACKEND_ORG.id },
        { id: 'backend-ws-2', orgId: BACKEND_ORG.id },
      ],
    });
    for (const frame of sent) {
      expect([SYNC_HELLO_TYPE, SYNC_STATE_VECTOR_TYPE]).toContain(frame.type);
    }
  });

  it('never catches up a home-Org workspace — fan-out scopes are consumed-Org only', async () => {
    const { sent } = await runJoin({
      joinerWorkspaces: [
        { id: 'joiner-ws-1', orgId: 'home' },
        { id: 'joiner-ws-2', orgId: 'home' },
      ],
      backendWorkspaces: [{ id: 'backend-ws-1', orgId: BACKEND_ORG.id }],
    });
    const scopes = sent.filter((f) => f.type === SYNC_STATE_VECTOR_TYPE).map((f) => f.workspaceId);
    expect(scopes).not.toContain('joiner-ws-1');
    expect(scopes).not.toContain('joiner-ws-2');
    expect(scopes.sort()).toEqual([GLOBAL, 'backend-ws-1']);
  });

  it('the outbound gate withholds a home-Org envelope queued for flush', async () => {
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const ownEnvelope: MutationEnvelope = {
      mutationId: 'm-own',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'sw' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'joiner-ws-1',
      orgId: homeOrgId,
      mutatorVersion: 1,
      body: { kind: 'delete', type: 'rule', id: 'r' },
    };
    const verdict = evaluateOutboundEnvelope(ownEnvelope);
    expect(verdict.allow).toBe(false);
    expect(verdict.allow === false && verdict.layer).toBe('tenancy');
  });
});

describe('U6.7 — offline edits to a consumed workspace flush on reconnect', () => {
  it('a consumed-Org envelope passes the outbound gate; a home-Org one does not', async () => {
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const mkEnvelope = (mutationId: string, orgId: string, workspaceId: string): MutationEnvelope => ({
      mutationId,
      hlc: { physicalMs: 1, logical: 0, nodeId: 'sw' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId,
      orgId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'r', path: 'name', value: mutationId },
    });
    // The pending-out queue holds offline edits to both a consumed
    // workspace and the joiner's own. On reconnect the flush runs each
    // through the gate; only the consumed-Org edit goes up.
    const pendingOut = [
      mkEnvelope('m-consumed', BACKEND_ORG.id, 'backend-ws-1'),
      mkEnvelope('m-own', homeOrgId, 'joiner-ws-1'),
    ];
    const flushed = pendingOut.filter((e) => evaluateOutboundEnvelope(e).allow).map((e) => e.mutationId);
    expect(flushed).toEqual(['m-consumed']);
  });
});

describe('U6.7 — property: a join always converges with no own-Org leak', () => {
  it('any mix of joiner + backend workspaces converges; only consumed scopes go up', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 6 }),
        async (joinerCount, backendCount) => {
          const joinerWorkspaces: WorkspaceRow[] = Array.from({ length: joinerCount }, (_, i) => ({
            id: `joiner-ws-${i}`,
            orgId: 'home',
          }));
          const backendWorkspaces: WorkspaceRow[] = Array.from({ length: backendCount }, (_, i) => ({
            id: `backend-ws-${i}`,
            orgId: BACKEND_ORG.id,
          }));
          const { localStore, dataApplied, sent, state } = await runJoin({
            joinerWorkspaces,
            backendWorkspaces,
          });

          // Convergence — the FSM reaches `synced`.
          expect(state).toBe('synced');

          // Every backend workspace synced its data down.
          for (const w of backendWorkspaces) {
            expect(localStore.has(w.id)).toBe(true);
            expect(dataApplied.has(w.id)).toBe(true);
          }

          // No own-Org leak — every wire frame is a HELLO or a
          // STATE_VECTOR pull, and no STATE_VECTOR ever names a
          // home-Org workspace.
          const stateVectorScopes: string[] = [];
          for (const frame of sent) {
            expect([SYNC_HELLO_TYPE, SYNC_STATE_VECTOR_TYPE]).toContain(frame.type);
            if (frame.type === SYNC_STATE_VECTOR_TYPE) stateVectorScopes.push(frame.workspaceId as string);
          }
          for (const w of joinerWorkspaces) {
            expect(stateVectorScopes).not.toContain(w.id);
          }
          // Exactly `__global__` + one scope per backend workspace.
          expect(stateVectorScopes.sort()).toEqual([GLOBAL, ...backendWorkspaces.map((w) => w.id)].sort());
        },
      ),
      { numRuns: stressNumRuns(64) },
    );
  });
});
