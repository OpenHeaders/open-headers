/**
 * Renderer tree builders read children in the parent's merged slot
 * order — folders and the four request kinds interleaved as keyed —
 * and fall back to stored-path order (folders, then leaves by kind)
 * for slot-less children.
 */

import type { Collection, GrpcRequest, Request, WebSocketRequest } from '@openheaders/core/types';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';
import { buildRequestCollectionTrees, mirrorSlotReader } from '@openheaders/ui/shared/local-tree-builder';
import { describe, expect, it } from 'vitest';

const collection: Collection = {
  schemaVersion: 5,
  uid: 'rcol0001',
  path: 'requests/api-rcol0001',
  name: 'API',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};
const folder: PersistedLocalFolder = {
  schemaVersion: 5,
  uid: 'fol00001',
  path: `${collection.path}/v2-fol00001`,
  name: 'v2',
};
const http = (uid: string, parent: string): Request =>
  ({ schemaVersion: 5, uid, path: `${parent}/${uid}`, name: uid, method: 'GET', url: '' }) as unknown as Request;
const grpc = (uid: string, parent: string): GrpcRequest =>
  ({ schemaVersion: 5, uid, path: `${parent}/${uid}`, name: uid }) as unknown as GrpcRequest;
const ws = (uid: string, parent: string): WebSocketRequest =>
  ({ schemaVersion: 5, uid, path: `${parent}/${uid}`, name: uid, flavor: 'raw' }) as unknown as WebSocketRequest;

describe('buildRequestCollectionTrees — slot order', () => {
  it('interleaves folders and request kinds by the merged slots and appends slot-less leaves by path', () => {
    const trees = buildRequestCollectionTrees(
      [collection],
      [folder],
      [http('req00001', collection.path), http('req00002', folder.path), http('req00003', collection.path)],
      [grpc('grp00001', collection.path)],
      [ws('wss00001', collection.path)],
      [],
      (parent) => (parent.uid === collection.uid ? ['wss00001', 'fol00001', 'req00003', 'grp00001'] : ['req00002']),
    );
    expect(trees[0].tree.map((n) => `${n.type}:${n.uid}`)).toEqual([
      'websocket-request:wss00001',
      'folder:fol00001',
      'request:req00003',
      'grpc-request:grp00001',
      'request:req00001',
    ]);
    const sub = trees[0].tree[1];
    expect(sub.type === 'folder' && sub.children.map((n) => n.uid)).toEqual(['req00002']);
  });

  it('groups folders first, then kinds in array order, without a slot source', () => {
    const trees = buildRequestCollectionTrees(
      [collection],
      [folder],
      [http('req00002', collection.path), http('req00001', collection.path)],
      [grpc('grp00001', collection.path)],
    );
    expect(trees[0].tree.map((n) => n.uid)).toEqual(['fol00001', 'req00002', 'req00001', 'grp00001']);
  });

  it('merges by key through mirrorSlotReader', () => {
    const mirror = (sets: Record<string, Array<[string, string]>>) => ({
      liveOrderedSetItems: (_uid: string, setPath: string) =>
        (sets[setPath] ?? []).map(([itemId, orderKey]) => ({ itemId, orderKey })),
    });
    const read = mirrorSlotReader(
      mirror({
        folders: [['fol00001', 'p']],
        items: [
          ['req00001', 'm'],
          ['req00002', 's'],
        ],
      }),
      mirror({}),
      'folders',
      'items',
    );
    expect(read({ type: 'collection', uid: collection.uid })).toEqual(['req00001', 'fol00001', 'req00002']);
    expect(read({ type: 'folder', uid: folder.uid })).toEqual([]);
  });
});
