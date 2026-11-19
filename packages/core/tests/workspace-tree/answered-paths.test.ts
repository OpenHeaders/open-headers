/**
 * answered-paths pins: of the files a listing names as documents, a
 * reading answers for the ones it would write back and for every file of
 * an entity it holds back; a file beside a manifest that no entity took
 * is the user's own.
 */

import { describe, expect, it } from 'vitest';
import { readDocumentPaths, readWorkspaceTree, type TreeFile, treeDocumentPaths } from '../../src/workspace-tree';
import { isDocumentByName } from '../../src/workspace-tree/document-paths';

const WORKSPACE_YAML = ['schemaVersion: 5', 'uid: wwwwwwww', 'name: Probe', ''].join('\n');
const COLLECTION_YAML = ['schemaVersion: 5', 'uid: cccccccc', 'name: API', 'variables: []', ''].join('\n');
const RULE_YAML = [
  'schemaVersion: 5',
  'uid: aaaaaaaa',
  'name: Block probes',
  'type: block',
  'enabled: true',
  'conditions: []',
  'action: {}',
  '',
].join('\n');

const COLLECTION_DIR = 'rules/api-cccccccc';
const COLLECTION_FILE = `${COLLECTION_DIR}/_collection.yaml`;
const RULE_DIR = `${COLLECTION_DIR}/block-probes-aaaaaaaa`;
const RULE_FILE = `${RULE_DIR}/rule.yaml`;

const TREE: TreeFile[] = [
  { path: 'workspace.yaml', content: WORKSPACE_YAML },
  { path: COLLECTION_FILE, content: COLLECTION_YAML },
  { path: RULE_FILE, content: RULE_YAML },
];

/** What the reading of `files` answers for, among the document paths its listing names. */
function answeredOf(files: readonly TreeFile[]): string[] {
  const read = readWorkspaceTree(files);
  return [...readDocumentPaths(treeDocumentPaths(files.map((file) => file.path)), read)].sort();
}

describe('readDocumentPaths', () => {
  it('a file beside a manifest that no entity took is not answered for — in a collection’s directory and in a rule’s', () => {
    const answered = answeredOf([
      ...TREE,
      { path: `${COLLECTION_DIR}/notes.md`, content: 'mine\n' },
      { path: `${RULE_DIR}/notes.md`, content: 'mine\n' },
      { path: `${RULE_DIR}/pre-request.js`, content: 'a rule reads no script\n' },
    ]);
    expect(answered).toEqual([COLLECTION_FILE, RULE_FILE, 'workspace.yaml'].sort());
  });

  it('a sibling the reading took is answered for: a collection’s script', () => {
    const script = `${COLLECTION_DIR}/pre-request.js`;
    expect(answeredOf([...TREE, { path: script, content: 'console.log(1);\n' }])).toContain(script);
  });

  it('every file of a directory whose entity is held back is answered for', () => {
    const broken = TREE.map((file) => (file.path === RULE_FILE ? { ...file, content: 'uid: [not a string\n' } : file));
    const note = `${RULE_DIR}/notes.md`;
    expect(answeredOf([...broken, { path: note, content: 'mine\n' }])).toContain(note);
  });

  it('a tree whose own manifest does not read answers for every path its names say', () => {
    const note = `${COLLECTION_DIR}/notes.md`;
    const files = [...TREE.filter((file) => file.path !== 'workspace.yaml'), { path: note, content: 'mine\n' }];
    expect(answeredOf(files)).toEqual([COLLECTION_FILE, RULE_FILE, note].sort());
  });
});

describe('isDocumentByName', () => {
  it('a root document, an environment file and a manifest are; a file beside a manifest is not', () => {
    expect(
      ['workspace.yaml', 'environments/dev-eeeeeeee.yaml', COLLECTION_FILE, RULE_FILE].map(isDocumentByName),
    ).toEqual([true, true, true, true]);
    expect([`${COLLECTION_DIR}/pre-request.js`, `${RULE_DIR}/notes.md`].map(isDocumentByName)).toEqual([false, false]);
  });
});
