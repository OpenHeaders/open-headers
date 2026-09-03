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
  resolveRequestSettings,
  resolveSessionAuth,
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

describe('resolveSessionAuth', () => {
  const WS_LEAF = {
    uid: 'wsleaf01',
    path: 'requests/api-rcol0001/auth-rfold001/tokens-rfold002/live-wsleaf01',
    url: 'wss://api.openheaders.io/live',
    auth: { type: 'inherit' } as const,
  };

  /** Seed the tree and slot a SESSION leaf (no request entity — every
   *  leaf kind slots under the one request tree). */
  function seedSessionLeaf(collection: Collection, outer: Folder, inner: Folder): void {
    requestCollections.mockReturnValue([collection]);
    requestFolders.mockReturnValue([outer, inner]);
    const tree = treeOracleFrom([collection], [outer, inner]);
    oracle = tree.oracle;
    slotLeaf(tree.store, WS_LEAF.uid, { type: 'request-folder', uid: inner.uid });
  }

  it('resolves the pool default over the slot walk and stamps the attribution', () => {
    seedSessionLeaf(makeCollection({ auths: [ADMIN] }), makeFolder(), INNER);
    const resolved = resolveSessionAuth('websocket', WS_LEAF, null);
    expect(resolved.auth).toEqual(ADMIN.config);
    expect(resolved.refusal).toBeNull();
    expect(resolved.attribution?.source).toMatchObject({ level: 'collection', uid: 'rcol0001', entryUid: 'admin001' });
  });

  it('holds the resolution to the kind mask with the named refusal', () => {
    const oauth: AuthPoolEntry = {
      uid: 'oauth001',
      name: 'Corp SSO',
      config: {
        type: 'oauth2',
        credentialRef: 'oauth2-cred-abc12345',
        flow: 'authorization-code-pkce',
        tokenEndpoint: '',
        clientId: '',
        scopes: [],
      },
    };
    seedSessionLeaf(makeCollection({ auths: [oauth] }), makeFolder(), INNER);
    const resolved = resolveSessionAuth('mqtt', WS_LEAF, null);
    expect(resolved.refusal).toBe(
      "Inherited OAuth 2.0 from Collection 'API' › Corp SSO cannot be applied to an MQTT session.",
    );
    expect(resolved.attribution?.type).toBe('oauth2');
  });

  it('an injected chain replaces the walk (the page-realm twin); a host-scoped entry matches the url', () => {
    const scoped: AuthPoolEntry = {
      uid: 'scope001',
      name: 'Host key',
      config: { type: 'basic', username: 'u', password: 'p' },
      appliesTo: 'api.openheaders.io',
    };
    const resolved = resolveSessionAuth('websocket', WS_LEAF, null, [
      { level: 'collection', uid: 'rcol0001', name: 'API', auths: [ADMIN, scoped], defaultAuthUid: 'admin001' },
    ]);
    expect(resolved.auth).toEqual(scoped.config);
    expect(resolved.attribution?.source).toMatchObject({ entryUid: 'scope001' });
    expect(resolved.refusal).toBeNull();
  });

  it("a leaf's own none carries no attribution and no refusal; an absent auth reads as none", () => {
    expect(resolveSessionAuth('grpc', { ...WS_LEAF, auth: { type: 'none' } }, null)).toEqual({
      auth: { type: 'none' },
      attribution: undefined,
      refusal: null,
    });
    const { auth, ...rest } = WS_LEAF;
    expect(resolveSessionAuth('grpc', rest, null).attribution).toBeUndefined();
  });
});

describe('resolveRequestSettings', () => {
  it("the request's own knob wins; an absent one reads the innermost ancestor, attributed", () => {
    seedTree(
      makeCollection({ settings: { http: { timeoutMs: 30_000, sslVerification: false } } }),
      makeFolder({ settings: { http: { timeoutMs: 5_000 } } }),
      INNER,
      makeRequest(),
    );
    const resolved = resolveRequestSettings('http', makeRequest({ maxResponseBytes: 4_096 }), null);
    expect(resolved.settings).toEqual({ timeoutMs: 5_000, sslVerification: false, maxResponseBytes: 4_096 });
    // Sources ride in the kind's key order, not the chain's.
    expect(resolved.attribution).toEqual([
      { key: 'sslVerification', level: 'collection', uid: 'rcol0001', name: 'API' },
      { key: 'timeoutMs', level: 'folder', uid: 'rfold001', name: 'Auth' },
    ]);
  });

  it('a request slotted under another folder inherits from its SLOT parent, whatever its path says', () => {
    seedTree(
      makeCollection(),
      makeFolder({ settings: { http: { timeoutMs: 5_000 } } }),
      { ...INNER, settings: { http: { timeoutMs: 1_000 } } },
      makeRequest(),
      { slotRequestUnder: 'outer' },
    );
    expect(resolveRequestSettings('http', makeRequest(), null).settings.timeoutMs).toBe(5_000);
  });

  it("a kind reads its own slice — the HTTP slice's knobs never reach an MQTT session", () => {
    seedTree(
      makeCollection({
        settings: { http: { httpVersion: '2', timeoutMs: 30_000 }, mqtt: { timeoutMs: 30_000, keepAlive: 15 } },
      }),
      makeFolder(),
      INNER,
      makeRequest(),
    );
    const resolved = resolveRequestSettings('mqtt', { uid: 'req00001', path: makeRequest().path }, null);
    expect(resolved.settings).toEqual({ timeoutMs: 30_000, keepAlive: 15 });
    expect(resolved.attribution?.map((s) => s.key)).toEqual(['timeoutMs', 'keepAlive']);
  });

  it('nothing inherited = own knobs, unattributed; a scratch draft and a missing oracle resolve the same way', () => {
    seedTree(makeCollection(), makeFolder(), INNER, makeRequest());
    expect(resolveRequestSettings('http', makeRequest({ timeoutMs: 1_000 }), null)).toEqual({
      settings: { timeoutMs: 1_000 },
      attribution: undefined,
    });
    expect(resolveRequestSettings('http', makeRequest({ uid: 'req00009', path: 'scratch/x' }), null)).toEqual({
      settings: {},
      attribution: undefined,
    });
    expect(resolveRequestSettings('http', makeRequest(), 'ws-9').attribution).toBeUndefined();
  });

  it('an injected chain replaces the walk (the page-realm twin)', () => {
    const resolved = resolveRequestSettings('websocket', { uid: 'ws000001', path: 'scratch/ws' }, null, [
      {
        level: 'collection',
        uid: 'rcol0001',
        name: 'API',
        settings: { websocket: { maxMessageBytes: 2_048 }, http: { httpVersion: '2' } },
      },
    ]);
    expect(resolved.settings).toEqual({ maxMessageBytes: 2_048 });
    expect(resolved.attribution).toEqual([
      { key: 'maxMessageBytes', level: 'collection', uid: 'rcol0001', name: 'API' },
    ]);
  });
});
