/**
 * Workspace-roots projection — three ordered uid arrays ⇄ the roots
 * singleton's three keyed sets.
 */

import { describe, expect, it } from 'vitest';
import {
  type AddToSetMutation,
  InMemoryDocumentStore,
  type MutatorContext,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
} from '../../src/sync';
import {
  projectWorkspaceRoots,
  seedWorkspaceRoots,
} from '../../src/sync-builders/projections/workspace-roots-projection';
import type { WorkspaceRoots } from '../../src/types';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
};

const roots: WorkspaceRoots = {
  schemaVersion: 5,
  ruleCollections: ['col00002', 'col00001'],
  requestCollections: ['rcol0001'],
  templateCollections: [],
};

describe('seedWorkspaceRoots', () => {
  it('creates the singleton and one keyed slot per uid, ascending per set', () => {
    const batch = seedWorkspaceRoots(roots, ctx);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'create',
      type: WORKSPACE_ROOTS_ENTITY_TYPE,
      id: WORKSPACE_ROOTS_ID,
    });
    const slots = batch.mutations.slice(1).map((m) => m.body as AddToSetMutation);
    expect(slots.map((s) => [s.path, s.itemId])).toEqual([
      [WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH, 'col00002'],
      [WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH, 'col00001'],
      [WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH, 'rcol0001'],
    ]);
    expect(slots[0].item).toEqual({ uid: 'col00002' });
    expect(slots[0].orderKey! < slots[1].orderKey!).toBe(true);
  });

  it('round-trips through the store in slot order', () => {
    const store = new InMemoryDocumentStore();
    for (const env of seedWorkspaceRoots(roots, ctx).mutations) store.apply(env);
    const materialized = store.materializeOne(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID);
    expect(materialized).not.toBeNull();
    const projected = projectWorkspaceRoots(materialized!, (setPath) =>
      store.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, setPath),
    );
    expect(projected).toEqual(roots);
    expect(WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH).toBe('templateCollections');
  });

  it('refuses a foreign entity', () => {
    expect(projectWorkspaceRoots({ type: 'rule', id: 'x', data: {}, fieldOrigins: {} }, () => [])).toBeNull();
  });
});
