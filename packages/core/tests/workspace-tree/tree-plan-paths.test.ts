/**
 * The plan and the paths a tree can hold: a document is planned whole
 * or not at all, and one left out has its rows — at each file whose
 * path cannot be, and at its manifest where the manifest's own path is
 * not the cause.
 */

import { describe, expect, it } from 'vitest';
import {
  planWorkspaceDocuments,
  planWorkspaceTree,
  readWorkspaceTree,
  type WorkspaceTreeState,
} from '../../src/workspace-tree';

const SPEC_DIR = 'specs/pets-ssssssss';
const RULE_DIR = 'rules/api-cccccccc/block-probes-aaaaaaaa';

/** A tree that reads: a collection with a rule, and a spec with two files. */
function heldState(): WorkspaceTreeState {
  const read = readWorkspaceTree([
    { path: 'workspace.yaml', content: 'schemaVersion: 5\nuid: wwwwwwww\nname: Probe\n' },
    {
      path: 'rules/api-cccccccc/_collection.yaml',
      content: 'schemaVersion: 5\nuid: cccccccc\nname: API\nvariables: []\n',
    },
    {
      path: `${RULE_DIR}/rule.yaml`,
      content:
        'schemaVersion: 5\nuid: aaaaaaaa\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n',
    },
    {
      path: `${SPEC_DIR}/spec.yaml`,
      content:
        'schemaVersion: 5\nuid: ssssssss\nname: Pets\nformat: openapi-3.1\nrootFileUid: ffffffff\nfiles:\n  - uid: ffffffff\n    fileName: index.yaml\n  - uid: gggggggg\n    fileName: pets.yaml\n',
    },
    { path: `${SPEC_DIR}/index.yaml`, content: 'openapi: 3.1.0\n' },
    { path: `${SPEC_DIR}/pets.yaml`, content: 'components: {}\n' },
  ]);
  const { workspace } = read.state;
  if (workspace === null || read.issues.length > 0)
    throw new Error(`the seed did not read: ${JSON.stringify(read.issues)}`);
  return { ...read.state, workspace };
}

const pathsOf = (files: readonly { path: string }[]): string[] => files.map((file) => file.path);

describe('planWorkspaceDocuments — the paths a tree can hold', () => {
  it('plans every document of a tree that reads, with no row — and planWorkspaceTree answers its files', () => {
    const state = heldState();
    const plan = planWorkspaceDocuments(state);
    expect(plan.unheld).toEqual([]);
    expect(pathsOf(plan.files)).toEqual([
      'rules/api-cccccccc/_collection.yaml',
      `${RULE_DIR}/rule.yaml`,
      `${SPEC_DIR}/index.yaml`,
      `${SPEC_DIR}/pets.yaml`,
      `${SPEC_DIR}/spec.yaml`,
      'workspace.yaml',
    ]);
    expect(planWorkspaceTree(state)).toEqual(plan.files);
  });

  it('a document whose path climbs out is planned nowhere: a row at each of its files, the rest of the tree planned', () => {
    const state = heldState();
    const plan = planWorkspaceDocuments({
      ...state,
      specs: state.specs.map((spec) => ({ ...spec, path: '../outside/pets-ssssssss' })),
    });
    expect(pathsOf(plan.files)).toEqual([
      'rules/api-cccccccc/_collection.yaml',
      `${RULE_DIR}/rule.yaml`,
      'workspace.yaml',
    ]);
    expect(plan.unheld).toEqual([
      { path: '../outside/pets-ssssssss/spec.yaml', message: '".." cannot be part of a path — not written' },
      { path: '../outside/pets-ssssssss/index.yaml', message: '".." cannot be part of a path — not written' },
      { path: '../outside/pets-ssssssss/pets.yaml', message: '".." cannot be part of a path — not written' },
    ]);
  });

  it('a document in git’s directory by a name a filesystem folds onto it is not planned', () => {
    const state = heldState();
    const plan = planWorkspaceDocuments({
      ...state,
      rules: state.rules.map((rule) => ({ ...rule, path: '.GIT/hooks' })),
    });
    expect(pathsOf(plan.files)).not.toContain('.GIT/hooks/rule.yaml');
    expect(plan.unheld).toEqual([
      { path: '.GIT/hooks/rule.yaml', message: '".GIT" cannot be part of a path — not written' },
    ]);
  });

  it('a document with one file at such a path is not planned short of it: none of its files, a row at the file and one at its manifest naming it', () => {
    const state = heldState();
    const plan = planWorkspaceDocuments({
      ...state,
      specs: state.specs.map((spec) => ({
        ...spec,
        files: spec.files.map((file) => (file.fileName === 'pets.yaml' ? { ...file, fileName: '.git/config' } : file)),
      })),
    });
    expect(pathsOf(plan.files).filter((path) => path.startsWith('specs/'))).toEqual([]);
    expect(plan.unheld).toEqual([
      { path: `${SPEC_DIR}/.git/config`, message: '".git" cannot be part of a path — not written' },
      { path: `${SPEC_DIR}/spec.yaml`, message: '".git/config" was not written — skipped' },
    ]);
    expect(planWorkspaceTree({ ...state, specs: [] })).toEqual(plan.files);
  });
});
