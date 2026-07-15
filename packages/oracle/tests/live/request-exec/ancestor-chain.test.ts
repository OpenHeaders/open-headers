/**
 * Ancestor carrier walk + `inherit` auth resolution — pure unit tests
 * over mocked entity-store leaves. Ordering (collection first, folders
 * outer→inner), transparency rules (absent auth / `inherit`-typed
 * carriers pass through), innermost-carrier-wins, `none` as a real
 * shadowing carrier, and the no-carrier degrade to `none`.
 */

import type { Collection, Folder, Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectAncestorCarriers, resolveInheritedAuth } from '../../../src/live/request-exec/ancestor-chain';

const requestCollections = vi.fn<() => Collection[]>(() => []);
const requestFolders = vi.fn<() => Folder[]>(() => []);

vi.mock('../../../src/entity/request-store', () => ({
  getRequestCollections: () => requestCollections(),
  getRequestCollectionsForWorkspace: () => requestCollections(),
  getRequestFolders: () => requestFolders(),
  getRequestFoldersForWorkspace: () => requestFolders(),
}));

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
    uid: 'r1',
    path: 'requests/api-rcol0001/auth-rfold001/ping-r1',
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

beforeEach(() => {
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
});

describe('collectAncestorCarriers', () => {
  it('returns collection first, then folders outer→inner by path depth', () => {
    const inner = makeFolder({
      uid: 'rfold002',
      path: 'requests/api-rcol0001/auth-rfold001/tokens-rfold002',
      name: 'Tokens',
    });
    requestCollections.mockReturnValue([makeCollection()]);
    // Deliberately inner-before-outer to prove the sort.
    requestFolders.mockReturnValue([inner, makeFolder()]);
    const carriers = collectAncestorCarriers(
      makeRequest({ path: 'requests/api-rcol0001/auth-rfold001/tokens-rfold002/ping-r1' }),
      null,
    );
    expect(carriers.map((c) => c.label)).toEqual(["Collection 'API'", "Folder 'Auth'", "Folder 'Tokens'"]);
  });

  it('matches nothing for a scratch draft outside any collection', () => {
    requestCollections.mockReturnValue([makeCollection()]);
    requestFolders.mockReturnValue([makeFolder()]);
    expect(collectAncestorCarriers(makeRequest({ path: 'scratch/draft-1' }), null)).toEqual([]);
  });
});

describe('resolveInheritedAuth', () => {
  it('resolves to the collection auth when it is the only carrier', () => {
    requestCollections.mockReturnValue([makeCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([makeFolder()]);
    expect(resolveInheritedAuth(makeRequest(), null)).toEqual({ type: 'bearer', token: 'tok-col' });
  });

  it('innermost carrier wins — folder auth shadows collection auth', () => {
    requestCollections.mockReturnValue([makeCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([makeFolder({ auth: { type: 'basic', username: 'u', password: 'p' } })]);
    expect(resolveInheritedAuth(makeRequest(), null)).toEqual({ type: 'basic', username: 'u', password: 'p' });
  });

  it("a folder's `none` is a real carrier — it shadows an outer bearer", () => {
    requestCollections.mockReturnValue([makeCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([makeFolder({ auth: { type: 'none' } })]);
    expect(resolveInheritedAuth(makeRequest(), null)).toEqual({ type: 'none' });
  });

  it('a folder without auth is transparent — the walk passes to the collection', () => {
    requestCollections.mockReturnValue([makeCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([makeFolder()]);
    expect(resolveInheritedAuth(makeRequest({ path: 'requests/api-rcol0001/auth-rfold001/ping-r1' }), null)).toEqual({
      type: 'bearer',
      token: 'tok-col',
    });
  });

  it('an `inherit`-typed carrier is transparent, same as absent', () => {
    requestCollections.mockReturnValue([makeCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([makeFolder({ auth: { type: 'inherit' } })]);
    expect(resolveInheritedAuth(makeRequest(), null)).toEqual({ type: 'bearer', token: 'tok-col' });
  });

  it('degrades to `none` when no carrier holds auth (pre-D2 behavior)', () => {
    requestCollections.mockReturnValue([makeCollection()]);
    requestFolders.mockReturnValue([makeFolder()]);
    expect(resolveInheritedAuth(makeRequest(), null)).toEqual({ type: 'none' });
  });
});
