/**
 * Request-tree ancestry — the renderer's inherited-auth attribution
 * and the folder → collection lookup, read off the trees (never a
 * stored leaf path), the shared rule over the pool. Pins:
 *   - the innermost pool's default wins (folder beats collection),
 *     `none` is a real entry, a level without a pool is transparent,
 *     the pre-pool single field still reads as the default;
 *   - a named pick reaches any level's entry; a dangling pick falls
 *     back and is reported; a host-scoped entry applies on a match;
 *   - nothing set anywhere = no auth with no source;
 *   - a request in no tree (a scratch draft) resolves to no source;
 *   - the folder lookup finds nested folders and misses unknown ones.
 */

import type { AuthPoolEntry, Collection, CollectionTree, ConcreteAuthConfig } from '@openheaders/core/types';
import {
  findFolderCollectionUid,
  findRequestAncestry,
  resolveInheritedAuthFor,
} from '@openheaders/ui/workbench/components/request-container/ancestry';
import { describe, expect, it } from 'vitest';

const BEARER: ConcreteAuthConfig = { type: 'bearer', token: '{{token}}' };
const BASIC: ConcreteAuthConfig = { type: 'basic', username: 'john.doe', password: 'secret' };
const NONE: ConcreteAuthConfig = { type: 'none' };
const ADMIN: AuthPoolEntry = { uid: 'admin001', name: 'Admin token', config: BEARER };
const USER: AuthPoolEntry = { uid: 'user0001', name: 'User token', config: { type: 'bearer', token: '{{user}}' } };

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

  it("the collection's pool default supplies the auth when no folder carries a pool", () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auths: [ADMIN, USER] })], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: BEARER,
      source: { kind: 'collection', name: 'Payments', entryName: 'Admin token' },
    });
  });

  it("a pre-pool single `auth` field still reads as the collection's default", () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auth: BEARER })], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: BEARER,
      source: { kind: 'collection', name: 'Payments', entryName: '' },
    });
  });

  it("the innermost folder's pool wins over the collection's; a transparent folder is skipped", () => {
    const folders = [
      { uid: 'fld00001', name: 'Cards', auths: [{ uid: 'basic001', name: 'Service', config: BASIC }] },
      { uid: 'fld00002', name: 'Refunds' },
    ];
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auths: [ADMIN] })], folders, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: BASIC,
      source: { kind: 'folder', name: 'Cards', entryName: 'Service' },
    });
  });

  it("a `none` entry on a folder is a real carrier shadowing the collection's bearer", () => {
    const folders = [{ uid: 'fld00001', name: 'Cards', auths: [{ uid: 'none0001', name: 'Public', config: NONE }] }];
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auths: [ADMIN] })], folders, 'req00002');
    expect(resolveInheritedAuthFor(ancestry)).toEqual({
      auth: { type: 'none' },
      source: { kind: 'folder', name: 'Cards', entryName: 'Public' },
    });
  });

  it("a named pick reaches the collection's entry under a folder with its own pool", () => {
    const folders = [{ uid: 'fld00001', name: 'Cards', auths: [{ uid: 'none0001', name: 'Public', config: NONE }] }];
    const collection = makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' });
    const ancestry = findRequestAncestry([TREE], [collection], folders, 'req00002');
    expect(resolveInheritedAuthFor(ancestry, { authUid: 'user0001' })).toEqual({
      auth: USER.config,
      source: { kind: 'collection', name: 'Payments', entryName: 'User token' },
    });
  });

  it('a dangling pick falls back to the default and is reported', () => {
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auths: [ADMIN] })], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry, { authUid: 'gone0000' })).toMatchObject({
      auth: BEARER,
      danglingAuthUid: 'gone0000',
    });
  });

  it("a host-scoped entry applies ahead of the default when the request's URL host matches", () => {
    const scoped = {
      uid: 'scope001',
      name: 'Partner key',
      config: { type: 'api-key', key: 'X-Key', value: '{{partner}}', in: 'header' } as const,
      appliesTo: '*.partner.openheaders.io',
    };
    const ancestry = findRequestAncestry([TREE], [makeCollection({ auths: [ADMIN, scoped] })], FOLDERS, 'req00002');
    expect(resolveInheritedAuthFor(ancestry, {}, 'https://api.partner.openheaders.io/v1').source?.entryName).toBe(
      'Partner key',
    );
    expect(resolveInheritedAuthFor(ancestry, {}, 'https://api.openheaders.io/v1').source?.entryName).toBe(
      'Admin token',
    );
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
