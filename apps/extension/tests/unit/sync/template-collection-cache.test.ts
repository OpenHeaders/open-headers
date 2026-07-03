/**
 * Phase B Template-collection — cache subscribes to broadcast,
 * re-projects, persists. Catalog ships rename-only at v1.
 */

import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  renameTemplateCollection,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createTemplateCollectionCache } from '@openheaders/oracle/sync/template-collection-cache';
import { buildDeleteTemplateCollectionBatch } from '@openheaders/core/sync-builders/mutations/template-collection-mutations';
import {
  projectTemplateCollectionByUid,
  projectTemplateCollectionPostState,
} from '@openheaders/oracle/sync/template-collection-post-state';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeCollection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: `tcol-${uid}`,
    path: `templates/${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

let hlcCounter = 0;
const ctxFactory = () => {
  hlcCounter += 1;
  return {
    workspaceId: 'ws-1',
    hlc: { physicalMs: 1_000 + hlcCounter, logical: 0, nodeId: 'n0' },
    surfaceId: 's',
    deviceId: 'd',
  };
};

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('TemplateCollectionCache', () => {
  it('seeds + projects', async () => {
    const cache = createTemplateCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateCollections([makeCollection('a'), makeCollection('b')]);
    expect(cache.getTemplateCollections().map((c) => c.uid).sort()).toEqual(['a', 'b']);
    cache.dispose();
  });

  it('refreshes on rename', async () => {
    const cache = createTemplateCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateCollections([makeCollection('c1')]);
    const intent = renameTemplateCollection(ctxFactory(), {
      collectionUid: 'c1',
      name: 'New Name',
    });
    await oracle.apply(intent.batch, []);
    expect(cache.getTemplateCollections()[0].name).toBe('New Name');
    cache.dispose();
  });

  it('drops collection on delete', async () => {
    const cache = createTemplateCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateCollections([makeCollection('c1'), makeCollection('c2')]);
    await oracle.apply(buildDeleteTemplateCollectionBatch('c1', ctxFactory()).batch, []);
    expect(cache.getTemplateCollections().map((c) => c.uid)).toEqual(['c2']);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createTemplateCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateCollections([makeCollection('c1')]);
    cache.dispose();
    await oracle.apply(
      renameTemplateCollection(ctxFactory(), { collectionUid: 'c1', name: 'After' }).batch,
      [],
    );
    expect(cache.getTemplateCollections()[0].name).toBe('tcol-c1');
  });
});

describe('projectTemplateCollectionPostState', () => {
  it('returns post-state for a rename', async () => {
    const cache = createTemplateCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateCollections([makeCollection('c1')]);
    const intent = renameTemplateCollection(ctxFactory(), {
      collectionUid: 'c1',
      name: 'X',
    });
    await oracle.apply(intent.batch, []);
    const env = intent.batch.mutations[0];
    const post = projectTemplateCollectionPostState(oracle, env);
    expect(post?.collection.name).toBe('X');
    cache.dispose();
  });

  it('returns null for non-template-collection envelopes', () => {
    const env = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'ws-1',
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'r', path: 'name', value: 'x' },
    } as const;
    expect(
      projectTemplateCollectionPostState(oracle, env as Parameters<typeof projectTemplateCollectionPostState>[1]),
    ).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(projectTemplateCollectionByUid(oracle, 'no-such')).toBeNull();
  });

  it('exists at the correct entity type constant', () => {
    expect(TEMPLATE_COLLECTION_ENTITY_TYPE).toBe('template-collection');
  });
});
