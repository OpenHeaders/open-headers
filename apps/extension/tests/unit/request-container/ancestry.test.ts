/**
 * Request-tree ancestry — the renderer's inherited-auth attribution
 * and the folder → collection lookup, read off the trees (never a
 * stored leaf path). Pins:
 *   - innermost carrier wins (folder beats collection), `none` is a
 *     real carrier, an absent field is transparent;
 *   - nothing set anywhere = no auth with no source;
 *   - a request in no tree (a scratch draft) resolves to no source;
 *   - the folder lookup finds nested folders and misses unknown ones.
 */

import type { AuthConfig, Collection, CollectionTree } from '@openheaders/core/types';
import {
  findFolderCollectionUid,
  findRequestAncestry,
  resolveInheritedAuthFor,
} from '@openheaders/ui/workbench/components/request-container/ancestry';
import { describe, expect, it } from 'vitest';

const BEARER: AuthConfig = { type: 'bearer', token: '{{token}}' };
const BASIC: AuthConfig = { type: 'basic', username: 'john.doe', password: 'secret' };

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/payments-col00001',
    name: 'Payments',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

const TREE: CollectionTree = {
  ...makeCollection(),
  tree: [
    {
      type: 'folder',
      uid: 'fld00001',
      name: 'Cards',
      path: 'requests/payments-col00001/cards',
      children: [
        {
          type: 'folder',
          uid: 'fld00002',
          name: 'Refunds',
          path: 'requests/payments-col00001/cards/refunds',
          children: [
            {
              type: 'request',
              uid: 'req00002',
              name: 'Refund',
              path: 'requests/payments-col00001/cards/refunds/refund-req00002',
              method: 'POST',
            },
          ],
        },
        {
          type: 'grpc-request',
          uid: 'grp00001',
          name: 'Charge',
          path: 'requests/payments-col00001/cards/charge-grp00001',
        },
      ],
    },
    { type: 'request', uid: 'req00001', name: 'Ping', path: 'requests/payments-col00001/ping-req00001', method: 'GET' },
  ],
};

const FOLDERS = [
  { uid: 'fld00001', name: 'Cards' },
  { uid: 'fld00002', name: 'Refunds' },
];

describe('findRequestAncestry', () => {
  it('returns the collection and the folder chain outer → inner', () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection()], FOLDERS, 'req00002');
    expect(ancestry?.collection.uid).toBe('col00001');
    expect(ancestry?.folders.map((f) => f.uid)).toEqual(['fld00001', 'fld00002']);
  });

  it('a root request has an empty folder chain', () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection()], FOLDERS, 'req00001');
    expect(ancestry?.folders).toEqual([]);
  });

  it('a request in no tree resolves to null', () => {
    expect(findRequestAncestry([TREE], [makeCollection()], FOLDERS, 'req99999')).toBeNull();
  });
});

describe('resolveInheritedAuthFor', () => {
  it('nothing set anywhere → no auth, no source', () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection()], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({ auth: { type: 'none' }, source: null });
  });

  it('the collection supplies the auth when no folder carries one', () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auth: BEARER })], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: BEARER,
      source: { kind: 'collection', name: 'Payments' },
    });
  });

  it('the innermost folder wins over the collection; a transparent folder is skipped', () => {
    const folders = [
      { uid: 'fld00001', name: 'Cards', auth: BASIC },
      { uid: 'fld00002', name: 'Refunds' },
    ];
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auth: BEARER })], folders, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({ auth: BASIC, source: { kind: 'folder', name: 'Cards' } });
  });

  it("`none` on a folder is a real carrier shadowing the collection's bearer", () => {
    const folders = [{ uid: 'fld00001', name: 'Cards', auth: { type: 'none' } as AuthConfig }];
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auth: BEARER })], folders, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: { type: 'none' },
      source: { kind: 'folder', name: 'Cards' },
    });
  });

  it('a scratch draft (no ancestry) resolves to no auth and no source', () => {
    expect(resolveInheritedAuthFor(null)).toEqual({ auth: { type: 'none' }, source: null });
  });
});

describe('findFolderCollectionUid', () => {
  it('finds a nested folder and misses an unknown one', () => {
    expect(findFolderCollectionUid([TREE], 'fld00002')).toBe('col00001');
    expect(findFolderCollectionUid([TREE], 'fld99999')).toBeNull();
  });
});
