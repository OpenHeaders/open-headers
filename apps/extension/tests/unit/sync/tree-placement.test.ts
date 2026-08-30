/**
 * Renderer parent resolution off the container mirrors. A folder's
 * live parent is the container whose `folders` set slots it — fresh
 * on every move — never the folder's own mirror `path`, which goes
 * stale the moment it is dragged (a move emits envelopes on the
 * containers, not on the folder). The stale path is the net only for
 * a slot-less folder. `resolveTreeParentRef` (the shared resolver
 * over the same mirrors) resolves a moved container's fresh path by
 * its uid tail when the list match fails.
 */

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: { call: vi.fn(), subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
}));

import {
  requestTreeMirrors,
  resolveFolderParentBySlot,
  resolveTreeParentRef,
} from '@openheaders/ui/shared/sync/tree-placement';
import { makeRequestCollectionMirror, makeRequestFolderMirror } from '../../helpers/request-tree-mirrors';

const A = 'requests/api-col0000a';
const B = 'requests/other-col0000b';

/** Folder `fol0000f` was created under A and dragged under B; its mirror path still says A. */
function movedFolderTree() {
  return requestTreeMirrors('ws-1', {
    collectionMirror: makeRequestCollectionMirror(
      [
        { uid: 'col0000a', path: A, name: 'API' },
        { uid: 'col0000b', path: B, name: 'Other' },
      ],
      { col0000b: { [REQUEST_FOLDER_CHILDREN_PATH]: ['fol0000f'] } },
    ),
    folderMirror: makeRequestFolderMirror(
      [
        { uid: 'fol0000f', path: `${A}/f-fol0000f` },
        { uid: 'fol0000g', path: `${A}/f-fol0000f/g-fol0000g` },
      ],
      { fol0000f: { [REQUEST_FOLDER_CHILDREN_PATH]: ['fol0000g'] } },
    ),
  });
}

describe('resolveFolderParentBySlot', () => {
  it('names the container whose folders set holds the folder, not the stale mirror path', async () => {
    expect(await resolveFolderParentBySlot(movedFolderTree(), 'fol0000f')).toEqual({
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      uid: 'col0000b',
    });
    expect(await resolveFolderParentBySlot(movedFolderTree(), 'fol0000g')).toEqual({
      type: REQUEST_FOLDER_ENTITY_TYPE,
      uid: 'fol0000f',
    });
  });

  it('falls back to the stored path for a slot-less folder, and to null for an unknown one', async () => {
    const tree = requestTreeMirrors('ws-1', {
      collectionMirror: makeRequestCollectionMirror([{ uid: 'col0000a', path: A, name: 'API' }]),
      folderMirror: makeRequestFolderMirror([{ uid: 'fol0000f', path: `${A}/f-fol0000f` }]),
    });
    expect(await resolveFolderParentBySlot(tree, 'fol0000f')).toEqual({
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      uid: 'col0000a',
    });
    expect(await resolveFolderParentBySlot(tree, 'fol0000x')).toBeNull();
  });
});

describe('resolveTreeParentRef', () => {
  it("resolves a moved folder's fresh projected path by its uid tail when the mirror path is stale", async () => {
    expect(await resolveTreeParentRef(movedFolderTree(), `${B}/f-fol0000f`)).toEqual({
      type: REQUEST_FOLDER_ENTITY_TYPE,
      uid: 'fol0000f',
    });
  });
});
