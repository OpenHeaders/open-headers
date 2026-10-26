/**
 * The `__global__` scope boots from its log (the workspace-list scope
 * plan, Part 3 pilot). Pinned across simulated process restarts over
 * ONE in-memory log, with the stored projection keys persisting
 * between boots the way the host's storage does:
 *
 *   - a stored projection over an empty log migrates once — the list
 *     and the pointer — and every later boot appends nothing and
 *     derives no store swap;
 *   - a log of legacy seed triplets (fresh ids per boot, the pointer as
 *     the list record's `activeId` field) hydrates to the last boot's
 *     list and a null pointer; the pointer then migrates once from the
 *     stored active;
 *   - a hydrated pointer that names no live workspace heals once;
 *   - the web host's empty boot creates nothing;
 *   - a first boot with nothing stored commits the staged default and
 *     the sink writes the keys;
 *   - a redelivery of a logged global row after a restart is silent.
 */

import {
  ACTIVE_WORKSPACE_ENTITY_TYPE,
  ACTIVE_WORKSPACE_ID,
  ACTIVE_WORKSPACE_PATH,
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  type MutationBody,
  type MutationEnvelope,
  type MutatorContext,
  SWAP_PER_WORKSPACE_STORES,
  setExtensionWorkspace,
} from '@openheaders/core/sync';
import { seedExtensionWorkspaces } from '@openheaders/core/sync-builders/projections/extension-workspace-projection';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import {
  __initGlobalSyncServiceForTests,
  disposeGlobal,
  getGlobalOracle,
} from '@openheaders/oracle/sync/global-service';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { applySyncRequest } from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  listWorkspaces,
  peekActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installBackingStorage,
  installHostStorage,
  readStorage,
  seedStorageMany,
} from '../../helpers/chrome-storage-backing';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const HOME_ORG_ID = '01900000-0000-7000-8000-0000000000aa';

function workspace(id: string, sortIndex: number, name = id): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'personal',
    name,
    sortIndex,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    orgId: HOME_ORG_ID,
  };
}

const slotOf = (ws: ExtensionWorkspace): ExtensionWorkspaceSlot => ({
  id: ws.id,
  kind: ws.kind,
  name: ws.name,
  createdAt: ws.createdAt,
  updatedAt: ws.updatedAt,
  orgId: ws.orgId,
});

/** A context the way a pre-upgrade boot minted it: its own node id per boot. */
const bootCtx = (bootNo: number): MutatorContext => ({
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  orgId: HOME_ORG_ID,
  hlc: { physicalMs: 1_000 * bootNo, logical: 0, nodeId: `sw-boot-${bootNo}` },
  surfaceId: 'sw',
  deviceId: `sw-boot-${bootNo}`,
});

const envelope = (ctx: MutatorContext, logical: number, body: MutationBody): MutationEnvelope => ({
  mutationId: generateUid(),
  hlc: { ...ctx.hlc, logical },
  origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId },
  workspaceId: ctx.workspaceId,
  orgId: HOME_ORG_ID,
  mutatorVersion: 1,
  body,
});

/**
 * One pre-upgrade boot's seed: the list shell's `create`, one `addToSet`
 * per workspace, then the replicated `setField activeId` on the list
 * record — every id fresh, as every boot minted them.
 */
function legacyTriplet(bootNo: number, workspaces: ExtensionWorkspace[], activeId: string): MutationEnvelope[] {
  const ctx = bootCtx(bootNo);
  const out: MutationEnvelope[] = [
    envelope(ctx, 0, {
      kind: 'create',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      payload: {},
    }),
  ];
  workspaces.forEach((ws, index) => {
    out.push(
      envelope(ctx, index + 1, {
        kind: 'addToSet',
        type: EXTENSION_WORKSPACE_ENTITY_TYPE,
        id: EXTENSION_WORKSPACE_ID,
        path: EXTENSION_WORKSPACES_SET_PATH,
        itemId: ws.id,
        item: slotOf(ws),
        orderKey: `a${index}`,
      }),
    );
  });
  out.push(
    envelope(ctx, workspaces.length + 1, {
      kind: 'setField',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
      value: activeId,
    }),
  );
  return out;
}

async function rowCount(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

interface Rig {
  log: InMemoryMutationLog;
  intents: InMemoryPendingIntents;
}

/** A process boot: memory gone, the keys and the log kept. */
async function boot(rig: Rig, seedOnEmpty = true): Promise<void> {
  resetWorkspaceStore();
  await bootstrapWorkspaces({ seedOnEmpty });
  setOracleHostHooks({ getActiveWorkspaceId });
  __initGlobalSyncServiceForTests({ log: rig.log, intents: rig.intents });
  await bridgeExtensionWorkspaceSyncEngine();
}

const pointerRow = (): string | null => {
  const data = getGlobalOracle()?.materializeOne(ACTIVE_WORKSPACE_ENTITY_TYPE, ACTIVE_WORKSPACE_ID)?.data as
    | Record<string, unknown>
    | undefined;
  const raw = data?.[ACTIVE_WORKSPACE_PATH];
  return typeof raw === 'string' ? raw : null;
};

const legacyField = (): unknown =>
  (
    getGlobalOracle()?.materializeOne(EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_ID)?.data as
      | Record<string, unknown>
      | undefined
  )?.[EXTENSION_WORKSPACE_ACTIVE_ID_PATH];

const swapIntents = async (rig: Rig) => (await rig.intents.list()).filter((i) => i.kind === SWAP_PER_WORKSPACE_STORES);

let rig: Rig;

beforeEach(async () => {
  installBackingStorage();
  await installHostStorage();
  resetWorkspaceStore();
  installTestIdentitySnapshot(HOME_ORG_ID);
  rig = { log: new InMemoryMutationLog(), intents: new InMemoryPendingIntents() };
});

afterEach(() => {
  disposeGlobal();
  setOracleHostHooks({});
  resetWorkspaceStore();
  clearTestIdentitySnapshot();
});

describe('the __global__ scope boots from its log', () => {
  it('migrates a stored projection into an empty log once — list and pointer — and later boots append nothing', async () => {
    seedStorageMany({
      'oh.workspaces': [workspace('ws-a', 0), workspace('ws-b', 1)],
      'oh.runtimeActive.active': 'ws-b',
    });

    await boot(rig);

    // The list shell, two slots, one pointer flip — the pointer needs no create.
    expect(await rowCount(rig.log)).toBe(4);
    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-a', 'ws-b']);
    expect(peekActiveWorkspaceId()).toBe('ws-b');
    expect(pointerRow()).toBe('ws-b');
    expect(await swapIntents(rig)).toHaveLength(1);
    expect(readStorage<ExtensionWorkspace[]>('oh.workspaces')?.map((ws) => ws.id)).toEqual(['ws-a', 'ws-b']);
    expect(readStorage('oh.runtimeActive.active')).toBe('ws-b');

    await rig.intents.clear();
    await boot(rig);
    await boot(rig);

    expect(await rowCount(rig.log)).toBe(4);
    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-a', 'ws-b']);
    expect(peekActiveWorkspaceId()).toBe('ws-b');
    expect(await swapIntents(rig)).toEqual([]);
  });

  it("hydrates legacy triplets to the last boot's list and a null pointer, then migrates the pointer once", async () => {
    const a = workspace('ws-a', 0);
    const b = workspace('ws-b', 1);
    await rig.log.appendAll([
      ...legacyTriplet(1, [a], 'ws-a'),
      ...legacyTriplet(2, [a, b], 'ws-b'),
      ...legacyTriplet(3, [a, { ...b, name: 'B renamed' }], 'ws-a'),
    ]);
    const legacyRows = await rowCount(rig.log);
    seedStorageMany({
      'oh.workspaces': [a, { ...b, name: 'B renamed' }],
      'oh.runtimeActive.active': 'ws-b',
    });

    await boot(rig);

    expect(listWorkspaces().map((ws) => [ws.id, ws.name])).toEqual([
      ['ws-a', 'ws-a'],
      ['ws-b', 'B renamed'],
    ]);
    // The legacy field is recorded on the list record and never read;
    // the stored active is the pointer's one migration write.
    expect(legacyField()).toBe('ws-a');
    expect(pointerRow()).toBe('ws-b');
    expect(peekActiveWorkspaceId()).toBe('ws-b');
    expect(await rowCount(rig.log)).toBe(legacyRows + 1);
    expect(await swapIntents(rig)).toHaveLength(1);

    await rig.intents.clear();
    await boot(rig);

    expect(await rowCount(rig.log)).toBe(legacyRows + 1);
    expect(peekActiveWorkspaceId()).toBe('ws-b');
    expect(await swapIntents(rig)).toEqual([]);
  });

  it('heals a hydrated pointer that names no live workspace once, to the stored active', async () => {
    const a = workspace('ws-a', 0);
    const b = workspace('ws-b', 1);
    await rig.log.appendAll(seedExtensionWorkspaces([a, b], 'ws-gone', bootCtx(1)).mutations);
    const rows = await rowCount(rig.log);
    seedStorageMany({ 'oh.workspaces': [a, b], 'oh.runtimeActive.active': 'ws-b' });

    await boot(rig);

    expect(pointerRow()).toBe('ws-b');
    expect(peekActiveWorkspaceId()).toBe('ws-b');
    expect(await rowCount(rig.log)).toBe(rows + 1);

    await boot(rig);
    expect(await rowCount(rig.log)).toBe(rows + 1);
  });

  it('a log that holds the list wins over the stored keys; a usable pointer is never rewritten', async () => {
    const a = workspace('ws-a', 0);
    const b = workspace('ws-b', 1);
    await rig.log.appendAll(seedExtensionWorkspaces([a, b], 'ws-a', bootCtx(1)).mutations);
    const rows = await rowCount(rig.log);
    // Stale keys: a workspace the log never held, and an active the log disagrees with.
    seedStorageMany({ 'oh.workspaces': [a, workspace('ws-stale', 1)], 'oh.runtimeActive.active': 'ws-stale' });

    await boot(rig);

    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-a', 'ws-b']);
    expect(peekActiveWorkspaceId()).toBe('ws-a');
    expect(await rowCount(rig.log)).toBe(rows);
    expect(await swapIntents(rig)).toEqual([]);
    expect(readStorage<ExtensionWorkspace[]>('oh.workspaces')?.map((ws) => ws.id)).toEqual(['ws-a', 'ws-b']);
    expect(readStorage('oh.runtimeActive.active')).toBe('ws-a');
  });

  it("the web host's empty boot creates nothing", async () => {
    await boot(rig, false);
    expect(await rowCount(rig.log)).toBe(0);
    expect(listWorkspaces()).toEqual([]);
    expect(peekActiveWorkspaceId()).toBeNull();
    expect(await rig.intents.list()).toEqual([]);
  });

  it('a first boot with nothing stored commits the staged default and the sink writes the keys', async () => {
    await boot(rig);

    const [created] = listWorkspaces();
    expect(created).toBeDefined();
    expect(peekActiveWorkspaceId()).toBe(created.id);
    expect(pointerRow()).toBe(created.id);
    expect(await rowCount(rig.log)).toBe(3);
    expect(readStorage<ExtensionWorkspace[]>('oh.workspaces')?.map((ws) => ws.id)).toEqual([created.id]);
    expect(readStorage('oh.runtimeActive.active')).toBe(created.id);

    await boot(rig);
    expect(await rowCount(rig.log)).toBe(3);
    expect(listWorkspaces().map((ws) => ws.id)).toEqual([created.id]);
  });

  it('a redelivery of a logged global row after a restart is silent: no row, no broadcast', async () => {
    seedStorageMany({ 'oh.workspaces': [workspace('ws-a', 0)], 'oh.runtimeActive.active': 'ws-a' });
    await boot(rig);
    const batch = setExtensionWorkspace(bootCtx(9), { slot: slotOf(workspace('ws-c', 1)), orderKey: 'z' }).batch;
    await applySyncRequest({ type: 'oh.sync.apply', batch, applyOrigin: 'inbound' });
    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-a', 'ws-c']);
    const rows = await rowCount(rig.log);

    await boot(rig);
    expect(listWorkspaces().map((ws) => ws.id)).toEqual(['ws-a', 'ws-c']);
    const broadcasts: string[] = [];
    setOracleHostHooks({
      getActiveWorkspaceId,
      broadcastSyncEvent: (event) => broadcasts.push(event.envelope.mutationId),
    });

    const response = await applySyncRequest({ type: 'oh.sync.apply', batch, applyOrigin: 'inbound' });

    expect(response.outcomes.map((o) => o.outcome.status)).toEqual(['duplicate']);
    expect(await rowCount(rig.log)).toBe(rows);
    expect(broadcasts).toEqual([]);
  });
});
