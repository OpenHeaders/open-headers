/**
 * Commit conflicts: the texts of the documents a picked change and the
 * branch both changed, and the reading of the answers back into the
 * commit-change model. Pins which files are shown (the ones the change
 * touched that differ from the branch's, at the branch's paths, the
 * manifest first), the deleted-document form, the one-file documents,
 * and the answer rules — every shown file answered, no other path, an
 * empty answer as "gone", a document that no longer reads refused.
 */

import { describe, expect, it } from 'vitest';
import type { Environment, Request, Rule, Variable, WorkspaceVariables } from '../../src/types';
import {
  applyCommitChange,
  type CommitConflictDocument,
  commitConflictDocuments,
  commitDocumentFiles,
  readCommitResolutions,
  type WorkspaceTreeState,
} from '../../src/workspace-tree';

const workspace = {
  schemaVersion: 5,
  uid: 'wsaaaaaa',
  name: 'Commit Conflicts',
  orgId: '01890000-0000-7000-8000-000000000000',
};

function state(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace,
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    trustedRoots: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
    ...overrides,
  };
}

const rule = (overrides: Partial<Rule> = {}): Rule =>
  ({
    schemaVersion: 5,
    uid: 'rul0000a',
    path: 'rules/probe-rul0000a',
    name: 'Probe',
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
    ...overrides,
  }) as Rule;

const RULE_FILE = 'rules/probe-rul0000a/rule.yaml';

const request = (overrides: Record<string, unknown> = {}): Request =>
  ({
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/ping-req00001',
    name: 'Ping',
    method: 'POST',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'json', content: '{"probe":true}\n' },
    preRequestScript: 'console.log(1);\n',
    ...overrides,
  }) as unknown as Request;

const REQUEST_DIR = 'requests/ping-req00001';

interface Sides {
  current: WorkspaceTreeState;
  from: WorkspaceTreeState;
  to: WorkspaceTreeState;
}

/** The first pass's conflicts, as texts. */
function documentsOf(sides: Sides): CommitConflictDocument[] {
  const change = applyCommitChange(sides);
  return commitConflictDocuments({ ...sides, conflicts: change.conflicts });
}

const renameConflict: Sides = {
  current: state({ rules: [rule({ name: 'Local name' })] }),
  from: state({ rules: [rule()] }),
  to: state({ rules: [rule({ name: 'Picked name' })] }),
};

describe('commitConflictDocuments', () => {
  it('a document both sides changed is its manifest three times over', () => {
    const [document, ...rest] = documentsOf(renameConflict);
    expect(rest).toEqual([]);
    expect(document).toMatchObject({ uid: 'rul0000a', path: RULE_FILE, deleted: false });
    expect(document.files).toHaveLength(1);
    const [file] = document.files;
    expect(file.path).toBe(RULE_FILE);
    expect(file.base).toContain('name: Probe\n');
    expect(file.theirs).toContain('name: Picked name\n');
    expect(file.mine).toContain('name: Local name\n');
  });

  it("the files are named at the branch's path, wherever the change holds the document", () => {
    const moved = rule({ name: 'Local name', path: 'rules/local-name-rul0000a' });
    const [document] = documentsOf({ ...renameConflict, current: state({ rules: [moved] }) });
    expect(document.path).toBe('rules/local-name-rul0000a/rule.yaml');
    expect(document.files.map((file) => file.path)).toEqual(['rules/local-name-rul0000a/rule.yaml']);
  });

  it('a file the change touched is shown beside the manifest; one it left alone is not', () => {
    const [document] = documentsOf({
      current: state({ requests: [request({ name: 'Local ping' })] }),
      from: state({ requests: [request()] }),
      to: state({
        requests: [request({ name: 'Picked ping', body: { type: 'json', content: '{"probe":false}\n' } })],
      }),
    });
    expect(document.files.map((file) => file.path)).toEqual([
      `${REQUEST_DIR}/request.yaml`,
      `${REQUEST_DIR}/body.json`,
    ]);
    expect(document.files[1]).toEqual({
      path: `${REQUEST_DIR}/body.json`,
      base: '{"probe":true}\n',
      theirs: '{"probe":false}\n',
      mine: '{"probe":true}\n',
    });
  });

  it('a file the change removed carries no text for its end', () => {
    const [document] = documentsOf({
      current: state({ requests: [request({ name: 'Local ping' })] }),
      from: state({ requests: [request()] }),
      to: state({ requests: [request({ name: 'Picked ping', preRequestScript: undefined })] }),
    });
    const script = document.files.find((file) => file.path === `${REQUEST_DIR}/pre-request.js`);
    expect(script).toEqual({
      path: `${REQUEST_DIR}/pre-request.js`,
      base: 'console.log(1);\n',
      mine: 'console.log(1);\n',
    });
  });

  it('a document the change deletes is its manifest alone, with no end text', () => {
    const [document] = documentsOf({
      current: state({ requests: [request({ name: 'Local ping' })] }),
      from: state({ requests: [request()] }),
      to: state(),
    });
    expect(document).toMatchObject({ uid: 'req00001', deleted: true });
    expect(document.files).toHaveLength(1);
    expect(document.files[0].path).toBe(`${REQUEST_DIR}/request.yaml`);
    expect(document.files[0].theirs).toBeUndefined();
    expect(document.files[0].mine).toContain('name: Local ping\n');
  });

  it('an environment and the workspace variables are one file each', () => {
    const variable = (value: string): Variable => ({ uid: 'var0000a', name: 'URL', value, type: 'default' });
    const environment = (value: string): Environment => ({
      schemaVersion: 5,
      uid: 'env0000a',
      name: 'Staging',
      variables: [variable(value)],
    });
    const vars = (value: string): WorkspaceVariables => ({ schemaVersion: 5, variables: [variable(value)] });
    const documents = documentsOf({
      current: state({ environments: [environment('mine')], workspaceVariables: vars('mine') }),
      from: state({ environments: [environment('old')], workspaceVariables: vars('old') }),
      to: state({ environments: [environment('picked')], workspaceVariables: vars('picked') }),
    });
    expect(documents.map((document) => document.files.map((file) => file.path))).toEqual([
      ['environments/staging-env0000a.yaml'],
      ['workspace-vars.yaml'],
    ]);
    expect(documents[0].files[0].theirs).toContain('value: picked\n');
    expect(documents[1].files[0].mine).toContain('value: mine\n');
  });
});

describe('readCommitResolutions', () => {
  const documents = documentsOf(renameConflict);
  const [file] = documents[0].files;

  const answer = (content: string) =>
    readCommitResolutions({
      current: renameConflict.current,
      documents,
      resolutions: [{ path: RULE_FILE, content }],
    });

  it('an answered document stands where the patch would have — no conflict is left', () => {
    const read = answer((file.mine ?? '').replace('name: Local name', 'name: Agreed name'));
    if (!read.ok) throw new Error(read.message);
    expect([...read.resolved.documents]).toEqual(['rul0000a']);
    expect([...read.resolved.removed]).toEqual([]);

    const change = applyCommitChange({ ...renameConflict, resolved: read.resolved });
    expect(change.conflicts).toEqual([]);
    expect(change.next.rules).toEqual([rule({ name: 'Agreed name' })]);
    expect([...change.changedPaths]).toEqual([RULE_FILE]);
  });

  it("the branch's text as the answer changes nothing", () => {
    const read = answer(file.mine ?? '');
    if (!read.ok) throw new Error(read.message);
    const change = applyCommitChange({ ...renameConflict, resolved: read.resolved });
    expect(change.conflicts).toEqual([]);
    expect(change.changedPaths.size).toBe(0);
    expect(change.next.rules).toEqual(renameConflict.current.rules);
  });

  it('only the answered documents are taken — another edit of the change still patches', () => {
    const other = rule({ uid: 'rul0000b', path: 'rules/other-rul0000b', name: 'Other' });
    const sides: Sides = {
      current: state({ rules: [rule({ name: 'Local name' }), other] }),
      from: state({ rules: [rule(), other] }),
      to: state({ rules: [rule({ name: 'Picked name' }), { ...other, enabled: false } as Rule] }),
    };
    const shown = documentsOf(sides);
    const read = readCommitResolutions({
      current: sides.current,
      documents: shown,
      resolutions: [{ path: RULE_FILE, content: shown[0].files[0].mine ?? '' }],
    });
    if (!read.ok) throw new Error(read.message);
    const change = applyCommitChange({ ...sides, resolved: read.resolved });
    expect(change.next.rules).toEqual([rule({ name: 'Local name' }), { ...other, enabled: false }]);
  });

  it('every shown file needs an answer and no other path takes one', () => {
    expect(readCommitResolutions({ current: renameConflict.current, documents, resolutions: [] })).toEqual({
      ok: false,
      path: RULE_FILE,
      message: 'no answer for this file',
    });
    expect(
      readCommitResolutions({
        current: renameConflict.current,
        documents,
        resolutions: [
          { path: RULE_FILE, content: file.mine ?? '' },
          { path: 'workspace.yaml', content: 'name: Hijacked\n' },
        ],
      }),
    ).toEqual({ ok: false, path: 'workspace.yaml', message: 'not a file of this conflict' });
  });

  it('an answer that no longer reads as the document refuses, naming the file', () => {
    const read = answer('name: [unclosed\n');
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.path).toBe(RULE_FILE);
    expect(answer('')).toMatchObject({ ok: false, path: RULE_FILE });
  });

  it("a deleted document: an empty answer takes the deletion, the branch's text keeps it", () => {
    const sides: Sides = {
      current: state({ requests: [request({ name: 'Local ping' })] }),
      from: state({ requests: [request()] }),
      to: state(),
    };
    const shown = documentsOf(sides);
    const manifest = shown[0].files[0];

    const gone = readCommitResolutions({
      current: sides.current,
      documents: shown,
      resolutions: [{ path: manifest.path, content: '\n' }],
    });
    if (!gone.ok) throw new Error(gone.message);
    expect([...gone.resolved.removed]).toEqual(['req00001']);
    const deleted = applyCommitChange({ ...sides, resolved: gone.resolved });
    expect(deleted.conflicts).toEqual([]);
    expect(deleted.next.requests).toEqual([]);
    expect([...deleted.removedPaths]).toEqual([`${REQUEST_DIR}/request.yaml`]);

    const kept = readCommitResolutions({
      current: sides.current,
      documents: shown,
      resolutions: [{ path: manifest.path, content: manifest.mine ?? '' }],
    });
    if (!kept.ok) throw new Error(kept.message);
    const stays = applyCommitChange({ ...sides, resolved: kept.resolved });
    expect(stays.conflicts).toEqual([]);
    expect(stays.next.requests).toEqual(sides.current.requests);
    expect(stays.removedPaths.size + stays.changedPaths.size).toBe(0);
  });

  it("an answered environment keeps the branch's secret rows", () => {
    const row = (value: string): Variable => ({ uid: 'var0000a', name: 'URL', value, type: 'default' });
    const secret: Variable = { uid: 'var0000s', name: 'TOKEN', value: 'local-secret', type: 'secret' };
    const environment = (variables: Variable[]): Environment => ({
      schemaVersion: 5,
      uid: 'env0000a',
      name: 'Staging',
      variables,
    });
    const sides: Sides = {
      current: state({ environments: [environment([row('mine'), secret])] }),
      from: state({ environments: [environment([row('old'), secret])] }),
      to: state({ environments: [environment([row('picked'), secret])] }),
    };
    const shown = documentsOf(sides);
    const read = readCommitResolutions({
      current: sides.current,
      documents: shown,
      resolutions: [{ path: shown[0].files[0].path, content: shown[0].files[0].theirs ?? '' }],
    });
    if (!read.ok) throw new Error(read.message);
    const change = applyCommitChange({ ...sides, resolved: read.resolved });
    expect(change.next.environments[0].variables).toEqual([row('picked'), secret]);
  });
});

describe('commitDocumentFiles', () => {
  it('names every file the planner writes for a document, and none for a uid the tree does not hold', () => {
    const staging: Environment = { schemaVersion: 5, uid: 'env0000a', name: 'Staging', variables: [] };
    const vars: WorkspaceVariables = { schemaVersion: 5, variables: [] };
    const tree = state({ rules: [rule()], requests: [request()], environments: [staging], workspaceVariables: vars });

    expect([...commitDocumentFiles(tree, ['req00001'])].sort()).toEqual([
      `${REQUEST_DIR}/body.json`,
      `${REQUEST_DIR}/pre-request.js`,
      `${REQUEST_DIR}/request.yaml`,
    ]);
    expect([...commitDocumentFiles(tree, ['rul0000a', 'env0000a'])].sort()).toEqual([
      'environments/staging-env0000a.yaml',
      RULE_FILE,
    ]);
    expect([...commitDocumentFiles(tree, ['gone0000'])]).toEqual([]);
  });
});
