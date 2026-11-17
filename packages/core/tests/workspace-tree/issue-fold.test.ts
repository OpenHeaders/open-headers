/**
 * The fold of a reading's issues — a row a cause: what was skipped for
 * its place is counted at the manifest's row of the directory it sits
 * in, or at the directory where no manifest's row answers for it.
 */

import { describe, expect, it } from 'vitest';
import type { Collection } from '../../src/types';
import {
  containTreeRead,
  foldTreeIssues,
  type HeldContainers,
  readWorkspaceTree,
  type TreeFile,
  type TreeIssue,
} from '../../src/workspace-tree';

const WORKSPACE_YAML = ['schemaVersion: 5', 'uid: wwwwwwww', 'name: Probe', ''].join('\n');
const BROKEN_YAML = 'schemaVersion: 5\nuid: [not a string\n';

const ruleYaml = (uid: string): string =>
  `schemaVersion: 5\nuid: ${uid}\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;
const collectionYaml = (uid: string): string => `schemaVersion: 5\nuid: ${uid}\nname: API\nvariables: []\n`;
const folderYaml = (uid: string): string => `schemaVersion: 5\nuid: ${uid}\nname: Auth\n`;

const NO_CONTAINERS: HeldContainers = {
  collections: [],
  folders: [],
  requestCollections: [],
  requestFolders: [],
  templateCollections: [],
  templateFolders: [],
};

function file(path: string, content: string): TreeFile {
  return { path, content };
}

/** The issues of a tree as a sweep derives them: read, then contained against what the engine holds. */
function issuesOf(files: TreeFile[], held: Partial<HeldContainers> = {}): TreeIssue[] {
  const read = readWorkspaceTree([file('workspace.yaml', WORKSPACE_YAML), ...files]);
  return containTreeRead(read, { ...NO_CONTAINERS, ...held }).issues;
}

const skipped = (path: string, uncontainedIn: string): TreeIssue => ({ path, message: 'skipped', uncontainedIn });

describe('foldTreeIssues', () => {
  it('leaves issues that name no directory a row each, in their order', () => {
    const issues: TreeIssue[] = [
      { path: 'workspace.yaml', message: 'bad manifest' },
      { path: 'rules/api-cccccccc/bad-bbbbbbbb/rule.yaml', message: 'bad rule' },
      { path: 'environments/dev-eeeeeeee.yaml', message: 'bad environment' },
    ];
    expect(foldTreeIssues(issues)).toEqual(issues.map((issue) => ({ kind: 'file', ...issue, inside: 0 })));
    expect(foldTreeIssues([])).toEqual([]);
  });

  it('counts the leaves of a new collection that does not read at its manifest row', () => {
    const issues = issuesOf([
      file('rules/payments-colbbbbb/_collection.yaml', BROKEN_YAML),
      file('rules/payments-colbbbbb/one-aaaaaaa1/rule.yaml', ruleYaml('aaaaaaa1')),
      file('rules/payments-colbbbbb/two-aaaaaaa2/rule.yaml', ruleYaml('aaaaaaa2')),
      file('rules/payments-colbbbbb/three-aaaaaaa3/rule.yaml', ruleYaml('aaaaaaa3')),
      file('rules/loose-rule-rrrrrrr0/rule.yaml', ruleYaml('rrrrrrr0')),
    ]);
    expect(issues).toHaveLength(5);
    expect(foldTreeIssues(issues)).toEqual([
      { kind: 'file', path: 'rules/payments-colbbbbb/_collection.yaml', message: issues[0].message, inside: 3 },
      {
        kind: 'file',
        path: 'rules/loose-rule-rrrrrrr0/rule.yaml',
        message: 'rule outside a collection or folder of "rules" — skipped',
        inside: 0,
      },
    ]);
  });

  it('folds top-down: a folder under the broken collection, the folder inside it, their leaves — one row', () => {
    const issues = issuesOf([
      file('rules/broken-cccccccc/_collection.yaml', BROKEN_YAML),
      file('rules/broken-cccccccc/auth-ffffffff/_folder.yaml', folderYaml('ffffffff')),
      file('rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/_folder.yaml', folderYaml('gggggggg')),
      file('rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      file('rules/broken-cccccccc/auth-ffffffff/block-probes-bbbbbbbb/rule.yaml', ruleYaml('bbbbbbbb')),
    ]);
    expect(foldTreeIssues(issues)).toEqual([
      { kind: 'file', path: 'rules/broken-cccccccc/_collection.yaml', message: issues[0].message, inside: 4 },
    ]);
  });

  it('keeps the row of a leaf that does not parse beside the collection it sits in', () => {
    const issues = issuesOf([
      file('rules/broken-cccccccc/_collection.yaml', BROKEN_YAML),
      file('rules/broken-cccccccc/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      file('rules/broken-cccccccc/bad-bbbbbbbb/rule.yaml', BROKEN_YAML),
    ]);
    expect(foldTreeIssues(issues).map((row) => (row.kind === 'file' ? [row.path, row.inside] : row))).toEqual([
      ['rules/broken-cccccccc/_collection.yaml', 1],
      ['rules/broken-cccccccc/bad-bbbbbbbb/rule.yaml', 0],
    ]);
  });

  it('counts at the directory where several are skipped in it and no manifest row answers', () => {
    const issues = issuesOf([
      file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')),
      file('rules/api-cccccccc/kept-aaaaaaa0/rule.yaml', ruleYaml('aaaaaaa0')),
      file('rules/by-hand/one-aaaaaaa1/rule.yaml', ruleYaml('aaaaaaa1')),
      file('rules/by-hand/two-aaaaaaa2/rule.yaml', ruleYaml('aaaaaaa2')),
      file('rules/by-hand/three-aaaaaaa3/rule.yaml', ruleYaml('aaaaaaa3')),
    ]);
    expect(foldTreeIssues(issues)).toEqual([{ kind: 'directory', dir: 'rules/by-hand', files: 3 }]);
  });

  it("counts at the tree's root: two loose folders with their leaves, and a loose leaf", () => {
    const issues = issuesOf([
      file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')),
      file('rules/loose-ffffffff/_folder.yaml', folderYaml('ffffffff')),
      file('rules/loose-ffffffff/one-aaaaaaa1/rule.yaml', ruleYaml('aaaaaaa1')),
      file('rules/other-gggggggg/_folder.yaml', folderYaml('gggggggg')),
      file('rules/other-gggggggg/two-aaaaaaa2/rule.yaml', ruleYaml('aaaaaaa2')),
      file('rules/three-aaaaaaa3/rule.yaml', ruleYaml('aaaaaaa3')),
    ]);
    expect(foldTreeIssues(issues)).toEqual([{ kind: 'directory', dir: 'rules', files: 5 }]);
  });

  it('keeps the children of a collection the engine holds out of the count — they are taken in', () => {
    const held: Collection = {
      schemaVersion: 5,
      uid: 'cccccccc',
      path: 'rules/api-cccccccc',
      name: 'API',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    const issues = issuesOf(
      [
        file('rules/api-cccccccc/_collection.yaml', BROKEN_YAML),
        file('rules/api-cccccccc/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ],
      { collections: [held] },
    );
    expect(foldTreeIssues(issues)).toEqual([
      { kind: 'file', path: 'rules/api-cccccccc/_collection.yaml', message: issues[0].message, inside: 0 },
    ]);
  });

  it("answers for a directory with its container manifest's row alone — a leaf's row there does not", () => {
    const rows = foldTreeIssues([
      { path: 'rules/by-hand/rule.yaml', message: 'bad rule' },
      skipped('rules/by-hand/one-aaaaaaa1/rule.yaml', 'rules/by-hand'),
      skipped('rules/by-hand/two-aaaaaaa2/rule.yaml', 'rules/by-hand'),
    ]);
    expect(rows).toEqual([
      { kind: 'file', path: 'rules/by-hand/rule.yaml', message: 'bad rule', inside: 0 },
      { kind: 'directory', dir: 'rules/by-hand', files: 2 },
    ]);
  });

  it('places a row where its cause first stands in the order', () => {
    const rows = foldTreeIssues([
      skipped('rules/by-hand/one-aaaaaaa1/rule.yaml', 'rules/by-hand'),
      { path: 'vault.yaml', message: 'bad vault' },
      skipped('rules/by-hand/two-aaaaaaa2/rule.yaml', 'rules/by-hand'),
    ]);
    expect(rows).toEqual([
      { kind: 'directory', dir: 'rules/by-hand', files: 2 },
      { kind: 'file', path: 'vault.yaml', message: 'bad vault', inside: 0 },
    ]);
  });

  it('folds only upward: a directory the file does not sit beneath is not its cause', () => {
    const issues: TreeIssue[] = [
      skipped('rules/a-ffffffff/_folder.yaml', 'rules/b-gggggggg'),
      skipped('rules/b-gggggggg/_folder.yaml', 'rules/a-ffffffff'),
      skipped('rules/c-hhhhhhhh/_folder.yaml', 'rules/c-hhhhhhhh'),
    ];
    expect(foldTreeIssues(issues)).toEqual(
      issues.map((issue) => ({ kind: 'file', path: issue.path, message: issue.message, inside: 0 })),
    );
  });
});
