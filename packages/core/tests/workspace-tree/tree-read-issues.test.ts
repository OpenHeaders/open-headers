/**
 * Tree reader edge cases — the issue-reporting seam (the git-sync plan §10
 * Phase 2; quarantine consumes these rows in Phase 4). A broken
 * document must never abort the read of the rest of the tree.
 */

import { describe, expect, it } from 'vitest';
import { readWorkspaceTree, type TreeFile } from '../../src/workspace-tree';

const WORKSPACE_YAML = ['schemaVersion: 5', 'uid: wwwwwwww', 'name: Probe', ''].join('\n');

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

const COLLECTION_YAML = ['schemaVersion: 5', 'uid: cccccccc', 'name: API', 'variables: []', ''].join('\n');
const COLLECTION_FILE = 'rules/api-cccccccc/_collection.yaml';
const RULE_FILE = 'rules/api-cccccccc/block-probes-aaaaaaaa/rule.yaml';

function file(path: string, content: string): TreeFile {
  return { path, content };
}

describe('readWorkspaceTree edge cases', () => {
  it('parses a minimal tree and merges the environment secret split', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file(RULE_FILE, RULE_YAML),
      file(
        'environments/dev-eeeeeeee.yaml',
        ['schemaVersion: 5', 'uid: eeeeeeee', 'name: dev', 'variables: []', ''].join('\n'),
      ),
      file(
        'environments/dev-eeeeeeee.secret.yaml',
        [
          'schemaVersion: 5',
          'variables:',
          '  - uid: ssssssss',
          '    name: API_TOKEN',
          '    value: sekret',
          '    type: secret',
          '',
        ].join('\n'),
      ),
    ]);

    expect(result.issues).toEqual([]);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
    expect(result.state.rules).toHaveLength(1);
    expect(result.state.rules[0].path).toBe('rules/api-cccccccc/block-probes-aaaaaaaa');
    expect(result.state.environments[0].variables).toEqual([
      { uid: 'ssssssss', name: 'API_TOKEN', value: 'sekret', type: 'secret' },
    ]);
  });

  it('reports a broken document as an issue without aborting the rest', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/api-cccccccc/bad-bbbbbbbb/rule.yaml', 'schemaVersion: 5\nuid: [not a string\n'),
      file(RULE_FILE, RULE_YAML),
    ]);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe('rules/api-cccccccc/bad-bbbbbbbb/rule.yaml');
    expect(result.state.rules).toHaveLength(1);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
  });

  it('reports a missing workspace.yaml and returns a null workspace', () => {
    const result = readWorkspaceTree([file(COLLECTION_FILE, COLLECTION_YAML), file(RULE_FILE, RULE_YAML)]);
    expect(result.state.workspace).toBeNull();
    expect(result.issues.some((issue) => issue.path === 'workspace.yaml')).toBe(true);
    expect(result.state.rules).toHaveLength(1);
  });

  it('skips a duplicate uid and reports it', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file(RULE_FILE, RULE_YAML),
      file('rules/api-cccccccc/copy-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('duplicate uid');
  });

  it("ignores the user's own files and the sidecar, silently", () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('README.md', '# my workspace\n'),
      file('.gitignore', '.oh/\n*.secret.yaml\n'),
      file('.oh/lock', '{}'),
      file('.git/HEAD', 'ref: refs/heads/main\n'),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
  });

  it('reports a container outside the three tree roots', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('misc/stray-cccccccc/_collection.yaml', 'schemaVersion: 5\nuid: cccccccc\nname: Stray\nvariables: []\n'),
    ]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('outside a known tree root');
  });

  it('refuses a leaf whose directory sits in no collection or folder, and names it', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toEqual([]);
    expect(result.state.collections).toHaveLength(1);
    expect(result.issues).toEqual([
      {
        path: 'rules/block-probes-aaaaaaaa/rule.yaml',
        message: 'rule outside a collection or folder of "rules" — skipped',
      },
    ]);
  });

  it('refuses a leaf in a plain directory inside a collection — the directory is no folder', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/api-cccccccc/by-hand/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toEqual([]);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'rules/api-cccccccc/by-hand/block-probes-aaaaaaaa/rule.yaml',
    ]);
  });

  it("refuses a leaf under another family's container", () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('requests/api-cccccccc/_collection.yaml', COLLECTION_YAML),
      file('requests/api-cccccccc/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toEqual([]);
    expect(result.state.requestCollections).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('rule outside a collection or folder of "rules" — skipped');
  });

  it('refuses a request, a template and each request kind the same way, before any parse', () => {
    const manifests = ['request.yaml', 'grpc.yaml', 'websocket.yaml', 'mqtt.yaml', 'graphql.yaml'];
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      ...manifests.map((name, index) => file(`requests/stray-${index}/${name}`, 'not: [a document')),
      file('templates/stray/template.yaml', 'not: [a document'),
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'request outside a collection or folder of "requests" — skipped',
      'gRPC request outside a collection or folder of "requests" — skipped',
      'WebSocket request outside a collection or folder of "requests" — skipped',
      'MQTT request outside a collection or folder of "requests" — skipped',
      'GraphQL request outside a collection or folder of "requests" — skipped',
      'template outside a collection or folder of "templates" — skipped',
    ]);
  });

  it('reads a leaf inside a folder', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/api-cccccccc/auth-ffffffff/_folder.yaml', 'schemaVersion: 5\nuid: ffffffff\nname: Auth\n'),
      file('rules/api-cccccccc/auth-ffffffff/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.state.rules.map((rule) => rule.path)).toEqual([
      'rules/api-cccccccc/auth-ffffffff/block-probes-aaaaaaaa',
    ]);
  });

  it('keeps the children of a container whose manifest does not parse', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, 'schemaVersion: 5\nuid: [not a string\n'),
      file(RULE_FILE, RULE_YAML),
    ]);
    expect(result.state.collections).toEqual([]);
    expect(result.state.rules).toHaveLength(1);
    expect(result.issues.map((issue) => issue.path)).toEqual([COLLECTION_FILE]);
  });
});
