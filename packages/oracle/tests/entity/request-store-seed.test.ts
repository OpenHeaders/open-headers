/**
 * The store's create seed builder carries every optional field the
 * caller hands it — the path parameter rows included. The RPC handler
 * (`createLocalRequest`) forwards the editor's seed verbatim, so a field
 * the builder skips is dropped on EVERY create through the service
 * worker while the update path (a set diff over the saved entity) keeps
 * it. Pins the rows riding the create batch as set members, and the
 * field absent when the seed carries none (absent = none).
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { initialHlc, REQUEST_PATH_PARAMS_PATH } from '@openheaders/core/sync';
import type { Collection, PathParam } from '@openheaders/core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { applied } = vi.hoisted(() => ({ applied: [] as MutationBatch[] }));

vi.mock('@openheaders/oracle/sync/service/accessors', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/oracle/sync/service/accessors')>()),
  getOracleForCurrentWorkspace: () => ({
    liveOrderedSetItems: () => [],
    apply: async (batch: MutationBatch) => {
      applied.push(batch);
      return { ok: true, outcomes: [] };
    },
  }),
  nextSwMutatorContext: (): MutatorContext => ({
    workspaceId: 'ws-1',
    hlc: initialHlc('sw-test', 0),
    surfaceId: 'sw',
    deviceId: 'sw-test',
  }),
}));

import { addRequest } from '../../src/entity/request-store/requests';
import { setCollections, setLoadedWorkspaceId, setRequests } from '../../src/entity/request-store/state';

const COLLECTION: Collection = {
  schemaVersion: 5,
  uid: 'col00001',
  path: 'requests/pets-col00001',
  name: 'Pets',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};

const ROWS: PathParam[] = [{ uid: 'pp000001', key: 'petId', value: '42', description: 'The pet to read.' }];

function pathParamMembers(batch: MutationBatch) {
  return batch.mutations.map((m) => m.body).filter((b) => b.kind === 'addToSet' && b.path === REQUEST_PATH_PARAMS_PATH);
}

afterEach(() => {
  applied.length = 0;
  setRequests([]);
  setCollections([]);
  setLoadedWorkspaceId(null);
});

describe('addRequest seed — path parameters', () => {
  it('carries the seed rows onto the entity and into the create batch as set members', async () => {
    setCollections([COLLECTION]);
    setLoadedWorkspaceId('ws-1');

    const created = await addRequest('Read pet', COLLECTION.path, {
      url: 'https://api.openheaders.io/pets/:petId',
      pathParams: ROWS,
    });

    expect(created.pathParams).toEqual(ROWS);
    expect(applied).toHaveLength(1);
    expect(pathParamMembers(applied[0])).toMatchObject([
      { kind: 'addToSet', id: created.uid, path: REQUEST_PATH_PARAMS_PATH, itemId: 'pp000001', item: ROWS[0] },
    ]);
  });

  it('leaves the field absent when the seed carries none', async () => {
    setCollections([COLLECTION]);
    setLoadedWorkspaceId('ws-1');

    const created = await addRequest('Ping', COLLECTION.path, { url: 'https://api.openheaders.io/ping' });

    expect('pathParams' in created).toBe(false);
    expect(pathParamMembers(applied[0])).toEqual([]);
  });
});
