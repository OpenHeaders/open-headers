/**
 * The containers a reading removes — a container leaves only when
 * nothing the engine holds is left beneath it, and beneath is the
 * directory a placement resolves to the container.
 */

import { describe, expect, it } from 'vitest';
import { FOLDER_TREE_KINDS } from '../../src/sync';
import {
  type ContainerTree,
  planContainerRemovals,
  type TreeReading,
} from '../../src/sync-builders/mutations/tree-container-removals';

const API = { uid: 'col0000a', path: 'rules/api-col0000a' };
const AUTH = { uid: 'fol0000f', path: 'rules/api-col0000a/auth-fol0000f' };
const DEEP = { uid: 'fol0000d', path: 'rules/api-col0000a/auth-fol0000f/deep-fol0000d' };
const DIRECT = { uid: 'rul0000a', path: 'rules/api-col0000a/direct-rul0000a' };
const INNER = { uid: 'rul0000b', path: 'rules/api-col0000a/auth-fol0000f/inner-rul0000b' };

const API_MANIFEST = `${API.path}/_collection.yaml`;
const AUTH_MANIFEST = `${AUTH.path}/_folder.yaml`;
const DEEP_MANIFEST = `${DEEP.path}/_folder.yaml`;
const DIRECT_MANIFEST = `${DIRECT.path}/rule.yaml`;
const INNER_MANIFEST = `${INNER.path}/rule.yaml`;

function makeTree(overrides: Partial<ContainerTree> = {}): ContainerTree {
  return {
    kinds: FOLDER_TREE_KINDS,
    collections: [API],
    folders: [AUTH],
    leaves: [{ manifest: 'rule.yaml', items: [DIRECT, INNER] }],
    ...overrides,
  };
}

/** A reading that finds `removed` gone and read `read` — by uid, at the path given. */
function makeReading(removed: string[], read: Record<string, string> = {}): TreeReading {
  const gone = new Set(removed);
  return {
    read: (uid) => uid in read,
    placed: new Map(Object.entries(read)),
    removed: (path) => gone.has(path),
  };
}

function plan(tree: ContainerTree, reading: TreeReading): { gone: string[]; kept: string[] } {
  const removals = planContainerRemovals(tree, reading);
  return { gone: [...removals.gone].sort(), kept: removals.kept };
}

describe('planContainerRemovals', () => {
  it('removes nothing where no manifest is gone', () => {
    expect(plan(makeTree(), makeReading([]))).toEqual({ gone: [], kept: [] });
  });

  it("keeps a collection whose manifest is gone while a leaf's file is left in it", () => {
    expect(plan(makeTree({ folders: [] }), makeReading([API_MANIFEST, INNER_MANIFEST]))).toEqual({
      gone: [],
      kept: [API_MANIFEST],
    });
  });

  it('lets a collection leave once every leaf and folder beneath it left with it', () => {
    const everything = [API_MANIFEST, AUTH_MANIFEST, DIRECT_MANIFEST, INNER_MANIFEST];
    expect(plan(makeTree(), makeReading(everything))).toEqual({ gone: [API.uid, AUTH.uid].sort(), kept: [] });
  });

  it('keeps a folder whose manifest is gone while its leaf is left, and judges nothing above it', () => {
    expect(plan(makeTree(), makeReading([AUTH_MANIFEST]))).toEqual({ gone: [], kept: [AUTH_MANIFEST] });
  });

  it('judges deepest first: a leaf left under the inner folder keeps every container above it', () => {
    const tree = makeTree({
      folders: [AUTH, DEEP],
      leaves: [{ manifest: 'rule.yaml', items: [{ uid: 'rul0000c', path: `${DEEP.path}/leaf-rul0000c` }] }],
    });
    expect(plan(tree, makeReading([API_MANIFEST, AUTH_MANIFEST, DEEP_MANIFEST]))).toEqual({
      gone: [],
      kept: [DEEP_MANIFEST, AUTH_MANIFEST, API_MANIFEST],
    });
  });

  it('lets the inner folder leave and keeps the outer one for its own leaf', () => {
    const tree = makeTree({ folders: [AUTH, DEEP] });
    expect(plan(tree, makeReading([AUTH_MANIFEST, DEEP_MANIFEST]))).toEqual({
      gone: [DEEP.uid],
      kept: [AUTH_MANIFEST],
    });
  });

  it('keeps a folder for a folder left in it — the inner one is judged first', () => {
    const tree = makeTree({ folders: [AUTH, DEEP], leaves: [] });
    expect(plan(tree, makeReading([AUTH_MANIFEST]))).toEqual({ gone: [], kept: [AUTH_MANIFEST] });
  });

  it('keeps a collection for a folder left in it, though the folder holds nothing', () => {
    const tree = makeTree({ leaves: [] });
    expect(plan(tree, makeReading([API_MANIFEST]))).toEqual({ gone: [], kept: [API_MANIFEST] });
  });

  it('keeps a collection for a leaf the engine holds with no file of its own yet', () => {
    const tree = makeTree({ folders: [], leaves: [{ manifest: 'rule.yaml', items: [DIRECT] }] });
    expect(plan(tree, makeReading([API_MANIFEST]))).toEqual({ gone: [], kept: [API_MANIFEST] });
  });

  it('counts what the reading read at another place as left there, not here', () => {
    const tree = makeTree({ folders: [], leaves: [{ manifest: 'rule.yaml', items: [DIRECT] }] });
    const movedOut = makeReading([API_MANIFEST, DIRECT_MANIFEST], {
      [DIRECT.uid]: 'rules/zed-col0000z/direct-rul0000a',
    });
    expect(plan(tree, movedOut)).toEqual({ gone: [API.uid], kept: [] });
    const movedDeeper = makeReading([API_MANIFEST, DIRECT_MANIFEST], { [DIRECT.uid]: `${API.path}/renamed-rul0000a` });
    expect(plan(tree, movedDeeper)).toEqual({ gone: [], kept: [API_MANIFEST] });
  });

  it('leaves a container the reading read where it is, whatever of its old manifest is gone', () => {
    const renamed = makeReading([API_MANIFEST, AUTH_MANIFEST, DIRECT_MANIFEST, INNER_MANIFEST], {
      [API.uid]: 'rules/renamed-col0000a',
    });
    expect(plan(makeTree(), renamed)).toEqual({ gone: [AUTH.uid], kept: [] });
  });

  describe('a directory renamed with what it holds, a manifest not read at the new place', () => {
    const RENAMED_AUTH = 'rules/api-col0000a/authz-fol0000f';
    const LEAF = { uid: 'rul0000c', path: `${DEEP.path}/leaf-rul0000c` };
    const LEAF_MANIFEST = `${LEAF.path}/rule.yaml`;
    const tree = makeTree({ folders: [AUTH, DEEP], leaves: [{ manifest: 'rule.yaml', items: [LEAF] }] });

    it('keeps the inner folder for the leaf read under its renamed directory — the uid tail names it', () => {
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST, LEAF_MANIFEST], {
        [AUTH.uid]: RENAMED_AUTH,
        [LEAF.uid]: `${RENAMED_AUTH}/deep-fol0000d/leaf-rul0000c`,
      });
      expect(plan(tree, reading)).toEqual({ gone: [], kept: [DEEP_MANIFEST] });
    });

    it('keeps the outer folder too where neither manifest read — each directory resolves to its own', () => {
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST, LEAF_MANIFEST], {
        [LEAF.uid]: `${RENAMED_AUTH}/deep-fol0000d/leaf-rul0000c`,
      });
      expect(plan(tree, reading)).toEqual({ gone: [], kept: [DEEP_MANIFEST, AUTH_MANIFEST] });
    });

    it('keeps a collection renamed whole for the leaf read under it', () => {
      const flat = makeTree({ folders: [], leaves: [{ manifest: 'rule.yaml', items: [DIRECT] }] });
      const reading = makeReading([API_MANIFEST, DIRECT_MANIFEST], {
        [DIRECT.uid]: 'rules/renamed-col0000a/direct-rul0000a',
      });
      expect(plan(flat, reading)).toEqual({ gone: [], kept: [API_MANIFEST] });
    });

    it('keeps a collection for a leaf read deeper in it, under a folder the engine does not hold', () => {
      const flat = makeTree({ folders: [], leaves: [{ manifest: 'rule.yaml', items: [DIRECT] }] });
      const reading = makeReading([API_MANIFEST, DIRECT_MANIFEST], {
        [DIRECT.uid]: `${API.path}/fresh-fol0000n/direct-rul0000a`,
      });
      expect(plan(flat, reading)).toEqual({ gone: [], kept: [API_MANIFEST] });
    });

    it('keeps the inner folder for a leaf new to the engine, read under its renamed directory', () => {
      const empty = makeTree({ folders: [AUTH, DEEP], leaves: [] });
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST], {
        [AUTH.uid]: RENAMED_AUTH,
        rul0000n: `${RENAMED_AUTH}/deep-fol0000d/fresh-rul0000n`,
      });
      expect(plan(empty, reading)).toEqual({ gone: [], kept: [DEEP_MANIFEST] });
    });

    it('lets the inner folder leave where the new leaf was read beside it', () => {
      const empty = makeTree({ folders: [AUTH, DEEP], leaves: [] });
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST], {
        [AUTH.uid]: RENAMED_AUTH,
        rul0000n: `${RENAMED_AUTH}/fresh-rul0000n`,
      });
      expect(plan(empty, reading)).toEqual({ gone: [DEEP.uid], kept: [] });
    });

    it('lets the inner folder leave where the leaf was read under a directory that names another', () => {
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST, LEAF_MANIFEST], {
        [AUTH.uid]: RENAMED_AUTH,
        [LEAF.uid]: `${RENAMED_AUTH}/leaf-rul0000c`,
      });
      expect(plan(tree, reading)).toEqual({ gone: [DEEP.uid], kept: [] });
    });

    it('does not take a directory of another tree for the container its tail names', () => {
      const reading = makeReading([AUTH_MANIFEST, DEEP_MANIFEST, LEAF_MANIFEST], {
        [AUTH.uid]: RENAMED_AUTH,
        [LEAF.uid]: 'requests/api-col0000a/authz-fol0000f/deep-fol0000d/leaf-rul0000c',
      });
      expect(plan(tree, reading)).toEqual({ gone: [DEEP.uid], kept: [] });
    });
  });
});
