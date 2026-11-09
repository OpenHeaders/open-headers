/**
 * Tree hygiene pins: a `.gitignore` that already holds the required
 * entries comes back untouched; a missing entry is appended on its own
 * line in the file's own line ending; the user's lines never move; and
 * the planner no longer plans either hygiene file.
 */

import { describe, expect, it } from 'vitest';
import { planWorkspaceTree, withRequiredIgnoreEntries } from '../../src/workspace-tree';

describe('withRequiredIgnoreEntries', () => {
  it('a file holding every entry is the same string — whatever else it holds, in any order', () => {
    const mine = 'node_modules/\n*.secret.yaml\n\n# local\n.env\n.oh/\n';
    expect(withRequiredIgnoreEntries(mine)).toBe(mine);
    expect(withRequiredIgnoreEntries('.oh/\n*.secret.yaml\n')).toBe('.oh/\n*.secret.yaml\n');
  });

  it('a missing entry is appended; the lines already there keep their place', () => {
    expect(withRequiredIgnoreEntries('.env\nnode_modules/\n')).toBe('.env\nnode_modules/\n.oh/\n*.secret.yaml\n');
    expect(withRequiredIgnoreEntries('.oh/\n.env\n')).toBe('.oh/\n.env\n*.secret.yaml\n');
  });

  it('a last line without a newline is closed first; an empty file takes the entries alone', () => {
    expect(withRequiredIgnoreEntries('.env')).toBe('.env\n.oh/\n*.secret.yaml\n');
    expect(withRequiredIgnoreEntries('')).toBe('.oh/\n*.secret.yaml\n');
  });

  it("the file's own line ending is kept", () => {
    expect(withRequiredIgnoreEntries('.env\r\n.oh/\r\n')).toBe('.env\r\n.oh/\r\n*.secret.yaml\r\n');
  });
});

describe('planWorkspaceTree', () => {
  it('plans neither hygiene file — the materializer would rewrite a planned one', () => {
    const paths = planWorkspaceTree({
      workspace: { schemaVersion: 5, uid: 'wsaaaaaa', name: 'Hygiene' },
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
    }).map((file) => file.path);
    expect(paths).toEqual(['workspace.yaml']);
  });
});
