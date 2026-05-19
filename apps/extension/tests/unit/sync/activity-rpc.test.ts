/**
 * Phase C F5 — `oh.sync.listActivity` + `oh.sync.markActivityRead`
 * RPC handlers in the host-neutral dispatcher.
 *
 * Pins:
 *   - listActivity returns the installed log's entries newest-first.
 *   - listActivity respects `unreadOnly` + `limit`.
 *   - markActivityRead flips the `read` flag on the listed ids.
 *   - Both RPCs return an empty / ok response when no log is installed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ActivityEntry } from '@openheaders/core/sync';
import { InMemoryActivityLog } from '@openheaders/oracle/sync';
import {
  setSyncPersistenceProvider,
  type SyncPersistenceProvider,
} from '@openheaders/oracle/sync/sync-persistence-provider';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';

import { installSyntheticIdentityForTests } from './_identity-test-setup';

const WS = '0193a8ff-c000-7000-8000-000000000001';

let log: InMemoryActivityLog;
let provider: SyncPersistenceProvider;
let teardownIdentity: () => void;

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: overrides.id ?? '',
    workspaceId: WS,
    orgId: 'org-test',
    mutationId: 'm1',
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'peer' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'peer', deviceId: 'peer' },
    observedAt: 1_700_000_000_000,
    read: false,
    ...overrides,
  };
}

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([WS]);
  log = new InMemoryActivityLog();
  provider = {
    createMutationLog: () => ({
      append: async () => undefined,
      list: async () => [],
      latest: async () => null,
      drainStartingAfter: async () => [],
      countAfter: async () => 0,
    }),
    createPendingIntents: () => ({
      put: async () => undefined,
      list: async () => [],
      take: async () => null,
      remove: async () => undefined,
    }),
    createActivityLog: () => log,
  } as unknown as SyncPersistenceProvider;
  setSyncPersistenceProvider(provider);

  await log.append(
    entry({
      mutationId: 'm-a',
      hlc: { physicalMs: 1_000, logical: 0, nodeId: 'peer' },
      kind: 'edit-entity',
    }),
  );
  await log.append(
    entry({
      mutationId: 'm-b',
      hlc: { physicalMs: 2_000, logical: 0, nodeId: 'peer' },
      kind: 'create-entity',
      read: true,
    }),
  );
});

afterEach(() => {
  teardownIdentity?.();
});

describe('oh.sync.listActivity', () => {
  it('returns entries newest-first', async () => {
    const result = dispatchSyncRpc({ type: 'oh.sync.listActivity', workspaceId: WS });
    expect(result?.kind).toBe('async');
    if (result?.kind !== 'async') return;
    const resp = (await result.promise) as { entries: ActivityEntry[] };
    expect(resp.entries.map((e) => e.mutationId)).toEqual(['m-b', 'm-a']);
  });

  it('respects unreadOnly + limit', async () => {
    const result = dispatchSyncRpc({
      type: 'oh.sync.listActivity',
      workspaceId: WS,
      unreadOnly: true,
      limit: 10,
    });
    if (result?.kind !== 'async') throw new Error('expected async result');
    const resp = (await result.promise) as { entries: ActivityEntry[] };
    expect(resp.entries.map((e) => e.mutationId)).toEqual(['m-a']);
  });

  it('returns empty entries when workspaceId is missing', () => {
    const result = dispatchSyncRpc({ type: 'oh.sync.listActivity' });
    expect(result).toEqual({ kind: 'sync', response: { entries: [] } });
  });
});

describe('oh.sync.markActivityRead', () => {
  it('flips read on the listed ids', async () => {
    const listRes = dispatchSyncRpc({ type: 'oh.sync.listActivity', workspaceId: WS });
    if (listRes?.kind !== 'async') throw new Error('expected async result');
    const list = (await listRes.promise) as { entries: ActivityEntry[] };
    const unreadId = list.entries.find((e) => !e.read)?.id;
    expect(unreadId).toBeDefined();

    const markRes = dispatchSyncRpc({
      type: 'oh.sync.markActivityRead',
      workspaceId: WS,
      ids: [unreadId],
    });
    if (markRes?.kind !== 'async') throw new Error('expected async result');
    await markRes.promise;

    const after = await log.countUnread(WS);
    expect(after).toBe(0);
  });

  it('no-ops when ids is empty', () => {
    const result = dispatchSyncRpc({
      type: 'oh.sync.markActivityRead',
      workspaceId: WS,
      ids: [],
    });
    expect(result).toEqual({ kind: 'sync', response: { ok: true } });
  });
});
