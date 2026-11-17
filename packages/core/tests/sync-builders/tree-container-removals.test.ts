/**
 * The containers a reading removes — a container leaves only when
 * nothing the engine holds is left beneath it.
 */

import { describe, expect, it } from 'vitest';
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
    pathOf: (uid) => read[uid],
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
});
