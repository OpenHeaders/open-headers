/**
 * The fold of a reading's issues — a row a cause: what was skipped for
 * its place is counted at the manifest's row of the directory it sits
 * in, or at the directory where no manifest's row answers for it; a
 * copy of a container's directory is counted at its manifest's row.
 */

import { describe, expect, it } from 'vitest';
import type { Collection } from '../../src/types';
import {
  containTreeRead,
  foldTreeIssues,
  type HeldTree,
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

const NO_CONTAINERS: HeldTree = {
  collections: [],
  folders: [],
  requestCollections: [],
  requestFolders: [],
  templateCollections: [],
  templateFolders: [],
  rules: [],
  requests: [],
  grpcRequests: [],
  websocketRequests: [],
  mqttRequests: [],
  graphqlRequests: [],
  templates: [],
};

function file(path: string, content: string): TreeFile {
  return { path, content };
}

/** The issues of a tree as a sweep derives them: read, then contained against what the engine holds. */
function issuesOf(files: TreeFile[], held: Partial<HeldTree> = {}): TreeIssue[] {
  const read = readWorkspaceTree([file('workspace.yaml', WORKSPACE_YAML), ...files]);
  return containTreeRead(read, { ...NO_CONTAINERS, ...held }).issues;
}

const skipped = (path: string, uncontainedIn: string): TreeIssue => ({ path, message: 'skipped', uncontainedIn });

const duplicateOf = (uid: string): string => `duplicate uid "${uid}" — entity skipped`;

const API = 'rules/api-cccccccc';

/** A collection the engine holds: two rules, and a folder with a third. */
const API_FILES: TreeFile[] = [
  file(`${API}/_collection.yaml`, collectionYaml('cccccccc')),
  file(`${API}/one-aaaaaaa1/rule.yaml`, ruleYaml('aaaaaaa1')),
  file(`${API}/two-aaaaaaa2/rule.yaml`, ruleYaml('aaaaaaa2')),
  file(`${API}/auth-ffffffff/_folder.yaml`, folderYaml('ffffffff')),
  file(`${API}/auth-ffffffff/three-aaaaaaa3/rule.yaml`, ruleYaml('aaaaaaa3')),
];

const apiHeld = (): HeldTree => readWorkspaceTree([file('workspace.yaml', WORKSPACE_YAML), ...API_FILES]).state;

/** The files beneath `from`, copied to `to`. */
const copied = (from: string, to: string): TreeFile[] =>
  API_FILES.filter((entry) => entry.path.startsWith(`${from}/`)).map((entry) =>
    file(`${to}${entry.path.slice(from.length)}`, entry.content),
  );

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

describe('foldTreeIssues — a copy of a directory', () => {
  it("counts a copy of a held collection's directory at its manifest row, wherever it sorts", () => {
    for (const copy of ['rules/aaa-cccccccc', 'rules/zzz-cccccccc']) {
      const files = copied(API, copy);
      const issues = issuesOf(copy < API ? [...files, ...API_FILES] : [...API_FILES, ...files], apiHeld());
      expect(issues).toHaveLength(5);
      expect(foldTreeIssues(issues)).toEqual([
        { kind: 'file', path: `${copy}/_collection.yaml`, message: duplicateOf('cccccccc'), inside: 4 },
      ]);
    }
  });

  it("counts a copy of a held folder's directory at its manifest row", () => {
    const copy = `${API}/zzz-ffffffff`;
    const issues = issuesOf([...API_FILES, ...copied(`${API}/auth-ffffffff`, copy)], apiHeld());
    expect(foldTreeIssues(issues)).toEqual([
      { kind: 'file', path: `${copy}/_folder.yaml`, message: duplicateOf('ffffffff'), inside: 1 },
    ]);
  });

  it('keeps the row of a duplicate in a directory that is no copy', () => {
    const copy = `${API}/copy-aaaaaaa1/rule.yaml`;
    const issues = issuesOf([...API_FILES, file(copy, ruleYaml('aaaaaaa1'))], apiHeld());
    expect(foldTreeIssues(issues)).toEqual([{ kind: 'file', path: copy, message: duplicateOf('aaaaaaa1'), inside: 0 }]);
  });

  it('keeps the row of a document in the copy that does not read', () => {
    const copy = 'rules/aaa-cccccccc';
    const issues = issuesOf(
      [...copied(API, copy), file(`${copy}/bad-bbbbbbbb/rule.yaml`, BROKEN_YAML), ...API_FILES],
      apiHeld(),
    );
    expect(foldTreeIssues(issues).map((row) => (row.kind === 'file' ? [row.path, row.inside] : row))).toEqual([
      [`${copy}/bad-bbbbbbbb/rule.yaml`, 0],
      [`${copy}/_collection.yaml`, 4],
    ]);
  });

  it("answers with a duplicate manifest's row alone — a manifest that does not read is no copy", () => {
    const rows = foldTreeIssues([
      { path: `${API}/_collection.yaml`, message: 'bad manifest' },
      { path: `${API}/copy-aaaaaaa1/rule.yaml`, message: duplicateOf('aaaaaaa1'), duplicateOf: 'aaaaaaa1' },
    ]);
    expect(rows.map((row) => (row.kind === 'file' ? [row.path, row.inside] : row))).toEqual([
      [`${API}/_collection.yaml`, 0],
      [`${API}/copy-aaaaaaa1/rule.yaml`, 0],
    ]);
  });

  it('folds by the mark, not by the sentence', () => {
    const rows = foldTreeIssues([
      { path: 'rules/aaa-cccccccc/_collection.yaml', message: duplicateOf('cccccccc'), duplicateOf: 'cccccccc' },
      { path: 'rules/aaa-cccccccc/one-aaaaaaa1/rule.yaml', message: duplicateOf('aaaaaaa1') },
    ]);
    expect(rows.map((row) => (row.kind === 'file' ? [row.path, row.inside] : row))).toEqual([
      ['rules/aaa-cccccccc/_collection.yaml', 0],
      ['rules/aaa-cccccccc/one-aaaaaaa1/rule.yaml', 0],
    ]);
  });
});
