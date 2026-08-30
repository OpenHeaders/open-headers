/**
 * Ancestor carrier walk + request auth resolution over a REAL oracle:
 * the chain is read off the tree index (the parent-owned slots), never
 * the request's stored path. Pins:
 *   - collection first, then folders outer→inner, off the slots;
 *   - a request dragged into another folder resolves under its SLOT
 *     parent even while its stored path still names the old one;
 *   - a slot-less request nets by its stored path's parent;
 *   - a scratch draft (no slot, no matching path) has no ancestors;
 *   - the collection uid comes off the chain;
 *   - the pool rule through `resolveRequestAuth`: innermost default,
 *     `none` as a real entry, a transparent level, a named pick, the
 *     attribution shape, the request's own auth, `none` unattributed;
 *   - no oracle for the workspace = no ancestors.
 */

import type { AuthPoolEntry, Collection, Folder, Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectAncestorCarriers,
  collectionUidForRequest,
  resolveRequestAuth,
} from '../../../src/live/request-exec/ancestor-chain';
import type { EntityOracle } from '../../../src/sync/oracle';
import { slotLeaf, treeOracleFrom, unslotLeaf } from './tree-oracle';

const requestCollections = vi.fn<() => Collection[]>(() => []);
const requestFolders = vi.fn<() => Folder[]>(() => []);
let oracle: EntityOracle | null = null;

vi.mock('../../../src/entity/request-store', () => ({
  getRequestCollections: () => requestCollections(),
  getRequestCollectionsForWorkspace: () => requestCollections(),
  getRequestFolders: () => requestFolders(),
  getRequestFoldersForWorkspace: () => requestFolders(),
}));

vi.mock('../../../src/sync/service/accessors', () => ({
  getOracleForCurrentWorkspace: () => oracle,
  getOracleForWorkspace: (workspaceId: string) => (workspaceId === 'ws-1' ? oracle : null),
}));

const ADMIN: AuthPoolEntry = { uid: 'admin001', name: 'Admin token', config: { type: 'bearer', token: 'tok-col' } };
const USER: AuthPoolEntry = { uid: 'user0001', name: 'User token', config: { type: 'bearer', token: 'tok-user' } };
const SERVICE: AuthPoolEntry = {
  uid: 'basic001',
  name: 'Service',
  config: { type: 'basic', username: 'u', password: 'p' },
};

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    uid: 'rcol0001',
    path: 'requests/api-rcol0001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    schemaVersion: 5,
    uid: 'rfold001',
    path: 'requests/api-rcol0001/auth-rfold001',
    name: 'Auth',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/api-rcol0001/auth-rfold001/tokens-rfold002/ping-req00001',
    name: 'Ping',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
    ...overrides,
  };
}

/**
 * Seed the tree: collection `API` › folder `Auth` › folder `Tokens` ›
 * request `Ping` — every folder in its parent's slot, the request
 * slotted under `Tokens` unless told otherwise. The mirrors the walk
 * materializes carriers from get the same entities.
 */
function seedTree(
  collection: Collection,
  outer: Folder,
  inner: Folder,
  request: Request,
  opts: { slotRequestUnder?: 'inner' | 'outer' | 'none' } = {},
): void {
  requestCollections.mockReturnValue([collection]);
  requestFolders.mockReturnValue([outer, inner]);
  const tree = treeOracleFrom([collection], [outer, inner], [request]);
  oracle = tree.oracle;
  const innerRef = { type: 'request-folder' as const, uid: inner.uid };
  const outerRef = { type: 'request-folder' as const, uid: outer.uid };
  const under = opts.slotRequestUnder ?? 'inner';
  if (under !== 'inner') unslotLeaf(tree.store, request.uid, innerRef);
  if (under === 'outer') slotLeaf(tree.store, request.uid, outerRef);
}

const INNER: Folder = makeFolder({
  uid: 'rfold002',
  path: 'requests/api-rcol0001/auth-rfold001/tokens-rfold002',
  name: 'Tokens',
});

beforeEach(() => {
  oracle = null;
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
});

describe('collectAncestorCarriers', () => {
  it('returns the collection first, then folders outer→inner, off the slots', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest());
    const carriers = collectAncestorCarriers(makeRequest(), null);
    expect(carriers.map((c) => c.label)).toEqual(["Collection 'API'", "Folder 'Auth'", "Folder 'Tokens'"]);
    expect(carriers.map((c) => c.level)).toEqual(['collection', 'folder', 'folder']);
  });

  it('a request slotted under another folder resolves there, whatever its stored path says', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest(), { slotRequestUnder: 'outer' });
    // The stored path still names Tokens; the slot says Auth.
    const carriers = collectAncestorCarriers(makeRequest(), null);
    expect(carriers.map((c) => c.label)).toEqual(["Collection 'API'", "Folder 'Auth'"]);
  });

  it('a slot-less request nets by its stored path parent', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest(), { slotRequestUnder: 'none' });
    const carriers = collectAncestorCarriers(makeRequest(), null);
    expect(carriers.map((c) => c.label)).toEqual(["Collection 'API'", "Folder 'Auth'", "Folder 'Tokens'"]);
  });

  it('matches nothing for a scratch draft outside any collection', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest(), { slotRequestUnder: 'none' });
    expect(collectAncestorCarriers(makeRequest({ uid: 'req00009', path: 'scratch/draft-1' }), null)).toEqual([]);
  });

  it('reads the pinned workspace oracle and nothing when the workspace has no oracle', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest());
    expect(collectAncestorCarriers(makeRequest(), 'ws-1')).toHaveLength(3);
    expect(collectAncestorCarriers(makeRequest(), 'ws-9')).toEqual([]);
  });

  it('the collection uid comes off the chain', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest());
    expect(collectionUidForRequest(makeRequest(), null)).toBe('rcol0001');
    expect(collectionUidForRequest(makeRequest({ uid: 'req00009', path: 'scratch/x' }), null)).toBeUndefined();
  });
});

describe('resolveRequestAuth', () => {
  it("resolves to the collection pool's default when it is the only pool, attributed", () => {
    seedTree(makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'user0001' }), makeFolder(), INNER, makeRequest());
    expect(resolveRequestAuth(makeRequest(), null)).toEqual({
      auth: USER.config,
      attribution: {
        type: 'bearer',
        source: { level: 'collection', uid: 'rcol0001', name: 'API', entryUid: 'user0001', entryName: 'User token' },
      },
    });
  });

  it("innermost pool wins — the folder's default shadows the collection's", () => {
    seedTree(makeCollection({ auths: [ADMIN] }), makeFolder({ auths: [SERVICE] }), INNER, makeRequest());
    const { auth, attribution } = resolveRequestAuth(makeRequest(), null);
    expect(auth).toEqual(SERVICE.config);
    expect(attribution?.source).toMatchObject({ level: 'folder', name: 'Auth', entryName: 'Service' });
  });

  it("a folder's `none` entry is a real carrier — it shadows an outer bearer", () => {
    const none: AuthPoolEntry = { uid: 'none0001', name: 'Public', config: { type: 'none' } };
    seedTree(makeCollection({ auths: [ADMIN] }), makeFolder({ auths: [none] }), INNER, makeRequest());
    expect(resolveRequestAuth(makeRequest(), null).auth).toEqual({ type: 'none' });
  });

  it('a named pick reaches the collection entry under a folder with its own pool', () => {
    seedTree(makeCollection({ auths: [ADMIN, USER] }), makeFolder({ auths: [SERVICE] }), INNER, makeRequest());
    const { auth, attribution } = resolveRequestAuth(
      makeRequest({ auth: { type: 'inherit', authUid: 'user0001' } }),
      null,
    );
    expect(auth).toEqual(USER.config);
    expect(attribution?.source).toMatchObject({ level: 'collection', entryUid: 'user0001' });
  });

  it('a dangling pick falls back to the default and names the missing entry', () => {
    seedTree(makeCollection({ auths: [ADMIN] }), makeFolder(), INNER, makeRequest());
    const { auth, attribution } = resolveRequestAuth(
      makeRequest({ auth: { type: 'inherit', authUid: 'gone0000' } }),
      null,
    );
    expect(auth).toEqual(ADMIN.config);
    expect(attribution?.danglingAuthUid).toBe('gone0000');
  });

  it('the pre-pool single `auth` field on a folder still reads as its default', () => {
    seedTree(makeCollection({ auths: [ADMIN] }), makeFolder({ auth: { type: 'none' } }), INNER, makeRequest());
    expect(resolveRequestAuth(makeRequest(), null).auth).toEqual({ type: 'none' });
  });

  it('degrades to `none` with a null source when no level holds a pool', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest());
    expect(resolveRequestAuth(makeRequest(), null)).toEqual({
      auth: { type: 'none' },
      attribution: { type: 'none', source: null },
    });
  });

  it("the request's own auth wins outright, attributed to the request; its own `none` is unattributed", () => {
    seedTree(makeCollection({ auths: [ADMIN] }), makeFolder(), INNER, makeRequest());
    expect(resolveRequestAuth(makeRequest({ auth: { type: 'bearer', token: 'mine' } }), null)).toEqual({
      auth: { type: 'bearer', token: 'mine' },
      attribution: { type: 'bearer', source: { level: 'request' } },
    });
    expect(resolveRequestAuth(makeRequest({ auth: { type: 'none' } }), null)).toEqual({
      auth: { type: 'none' },
      attribution: undefined,
    });
  });
});
