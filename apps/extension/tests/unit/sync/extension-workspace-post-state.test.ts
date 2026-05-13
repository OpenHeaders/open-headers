/**
 * Phase B — projector reads post-commit state for extensionWorkspace
 * envelopes (global-scope) and returns null for non-matching envelopes
 * / cold-oracle cases. Mirrors `files-post-state.test.ts` shape.
 */

import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  type ExtensionWorkspaceSlot,
  moveExtensionWorkspaceBefore,
  type MutationEnvelope,
  type MutatorContext,
  removeExtensionWorkspace,
  RULE_ENTITY_TYPE,
  setActiveExtensionWorkspace,
  setExtensionWorkspace,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import {
  projectExtensionWorkspacePostState,
  projectExtensionWorkspaceSingleton,
} from '@/background/sync/extension-workspace-post-state';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedExtensionWorkspaces } from '@openheaders/oracle/sync-builders/extension-workspace-projection';
import type { ExtensionWorkspace } from '@openheaders/core/types';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const ws = (overrides: Partial<ExtensionWorkspace> = {}): ExtensionWorkspace => ({
  schemaVersion: 5,
  id: 'ws-a',
  kind: 'personal',
  name: 'Workspace A',
  sortIndex: 0,
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  ...overrides,
});

const slot = (overrides: Partial<ExtensionWorkspaceSlot> = {}): ExtensionWorkspaceSlot => ({
  id: 'ws-a',
  kind: 'personal',
  name: 'Workspace A',
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  ...overrides,
});

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectExtensionWorkspacePostState', () => {
  it('returns post-state after seed + setExtensionWorkspace', async () => {
    const oracle = newOracle();
    await oracle.apply(seedExtensionWorkspaces([ws()], 'ws-a', ctx(1)), []);
    const intent = setExtensionWorkspace(ctx(2), {
      slot: slot({ id: 'ws-b', name: 'New' }),
      orderKey: 'p',
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);
    const post = projectExtensionWorkspacePostState(oracle, intent.batch.mutations[0]);
    expect(post).not.toBeNull();
    expect(post?.workspaces.map((w) => w.id)).toEqual(['ws-a', 'ws-b']);
    expect(post?.activeWorkspaceId).toBe('ws-a');
  });

  it('drops a workspace after removeExtensionWorkspace', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedExtensionWorkspaces(
        [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
        'ws-a',
        ctx(1),
      ),
      [],
    );
    await oracle.apply(removeExtensionWorkspace(ctx(2), { id: 'ws-a' }).batch, []);
    const post = projectExtensionWorkspaceSingleton(oracle);
    expect(post?.workspaces.map((w) => w.id)).toEqual(['ws-b']);
  });

  it('flips activeWorkspaceId by LWW on setActiveExtensionWorkspace', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedExtensionWorkspaces(
        [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
        'ws-a',
        ctx(1),
      ),
      [],
    );
    await oracle.apply(setActiveExtensionWorkspace(ctx(2), { id: 'ws-b' }).batch, []);
    const post = projectExtensionWorkspaceSingleton(oracle);
    expect(post?.activeWorkspaceId).toBe('ws-b');
  });

  it('reorders workspaces by orderKey via moveExtensionWorkspaceBefore', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedExtensionWorkspaces(
        [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
        'ws-a',
        ctx(1),
      ),
      [],
    );
    // Seed assigns ascending keys (m, n by walk); moving ws-b before ws-a
    // means giving it a key < 'm'. Use 'a' as a known-low marker.
    await oracle.apply(
      moveExtensionWorkspaceBefore(ctx(2), { id: 'ws-b', orderKey: 'a' }).batch,
      [],
    );
    const post = projectExtensionWorkspaceSingleton(oracle);
    expect(post?.workspaces.map((w) => w.id)).toEqual(['ws-b', 'ws-a']);
    // sortIndex re-emitted from projection-position, not the legacy field
    expect(post?.workspaces.map((w) => w.sortIndex)).toEqual([0, 1]);
  });

  it('keeps the latest payload on concurrent same-id sets (LWW)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedExtensionWorkspaces([], null, ctx(1)), []);
    await oracle.apply(
      setExtensionWorkspace(ctx(2), { slot: slot({ id: 'w', name: 'old' }), orderKey: 'm' })
        .batch,
      [],
    );
    await oracle.apply(
      setExtensionWorkspace(ctx(3), { slot: slot({ id: 'w', name: 'new' }), orderKey: 'm' })
        .batch,
      [],
    );
    const post = projectExtensionWorkspaceSingleton(oracle);
    expect(post?.workspaces[0].name).toBe('new');
  });

  it('returns null for non-matching envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectExtensionWorkspacePostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectExtensionWorkspaceSingleton(oracle)).toBeNull();
  });

  it('seeds with no active id when null', async () => {
    const oracle = newOracle();
    await oracle.apply(seedExtensionWorkspaces([ws()], null, ctx(1)), []);
    const post = projectExtensionWorkspaceSingleton(oracle);
    expect(post?.activeWorkspaceId).toBeNull();
  });
});
