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

  it('names the field a document does not read at — a nested one by its path, each root document the same', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML.replace('name: Probe', 'name: [Probe]')),
      file('workspace-vars.yaml', 'schemaVersion: 5\nvariables: nope\n'),
      file('workspace-vars.secret.yaml', 'schemaVersion: 5\nsecrets: nope\n'),
      file('trusted-roots.yaml', 'schemaVersion: 5\nroots: nope\n'),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file(
        RULE_FILE,
        RULE_YAML.replace(
          'conditions: []',
          'conditions:\n  - uid: dddddddd\n    type: request-domains\n    values: api.openheaders.io',
        ),
      ),
    ]);
    expect(result.issues).toEqual([
      { path: 'workspace.yaml', message: 'name — Invalid type: Expected string but received Array' },
      { path: 'workspace-vars.yaml', message: 'variables — Invalid type: Expected Array but received "nope"' },
      { path: 'workspace-vars.secret.yaml', message: 'secrets — Invalid type: Expected Array but received "nope"' },
      { path: 'trusted-roots.yaml', message: 'roots — Invalid type: Expected Array but received "nope"' },
      {
        path: RULE_FILE,
        message: 'conditions.0.values — Invalid type: Expected Array but received "api.openheaders.io"',
      },
    ]);
  });

  it('says the failure alone where it is of no field', () => {
    const result = readWorkspaceTree([file('workspace.yaml', 'just text\n')]);
    expect(result.issues).toEqual([
      { path: 'workspace.yaml', message: 'Invalid type: Expected Object but received "just text"' },
    ]);
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
    expect(result.issues).toEqual([
      {
        path: 'rules/api-cccccccc/copy-aaaaaaaa/rule.yaml',
        message: 'duplicate uid "aaaaaaaa" — entity skipped',
        duplicateOf: 'aaaaaaaa',
      },
    ]);
  });

  it('keeps a leaf it skipped as a duplicate, with what it holds, for the claim to be settled', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file(RULE_FILE, RULE_YAML),
      file('rules/api-cccccccc/copy-aaaaaaaa/rule.yaml', `${RULE_YAML}handAdded: kept\n`),
    ]);
    expect(result.shadowed.rules.map(({ entity }) => [entity.uid, entity.path])).toEqual([
      ['aaaaaaaa', 'rules/api-cccccccc/copy-aaaaaaaa'],
    ]);
    expect(result.shadowed.rules[0].unknowns).toHaveLength(1);
    expect(Object.keys(result.unknowns)).toEqual([]);
  });

  it('keeps a collection it skipped as a duplicate, with what it holds, by its tree', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/copy-cccccccc/_collection.yaml', `${COLLECTION_YAML}handAdded: kept\n`),
      file('requests/api-dddddddd/_collection.yaml', COLLECTION_YAML.replace('cccccccc', 'dddddddd')),
      file('requests/copy-dddddddd/_collection.yaml', COLLECTION_YAML.replace('cccccccc', 'dddddddd')),
    ]);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'rules/copy-cccccccc/_collection.yaml',
      'requests/copy-dddddddd/_collection.yaml',
    ]);
    expect(result.shadowed.collections.map(({ entity }) => [entity.uid, entity.path])).toEqual([
      ['cccccccc', 'rules/copy-cccccccc'],
    ]);
    expect(result.shadowed.collections[0].unknowns).toHaveLength(1);
    expect(result.shadowed.requestCollections.map(({ entity }) => entity.path)).toEqual(['requests/copy-dddddddd']);
    expect(Object.keys(result.unknowns)).toEqual([]);
  });

  it('keeps a folder it skipped as a duplicate', () => {
    const folder = 'schemaVersion: 5\nuid: ffffffff\nname: Auth\n';
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file('rules/api-cccccccc/auth-ffffffff/_folder.yaml', folder),
      file('rules/api-cccccccc/copy-ffffffff/_folder.yaml', folder),
    ]);
    expect(result.state.folders.map((entity) => entity.path)).toEqual(['rules/api-cccccccc/auth-ffffffff']);
    expect(result.shadowed.folders.map(({ entity }) => entity.path)).toEqual(['rules/api-cccccccc/copy-ffffffff']);
  });

  it('keeps nothing of a duplicate that is neither a container nor a leaf of a tree', () => {
    const environment = ['schemaVersion: 5', 'uid: eeeeeeee', 'name: dev', 'variables: []', ''].join('\n');
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('environments/dev-eeeeeeee.yaml', environment),
      file('environments/copy-eeeeeeee.yaml', environment),
    ]);
    expect(result.issues.map((issue) => issue.path)).toEqual(['environments/copy-eeeeeeee.yaml']);
    expect(Object.values(result.shadowed).flat()).toEqual([]);
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
        message: 'rule in no collection or folder — skipped',
        uncontainedIn: 'rules',
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
    expect(result.issues[0].uncontainedIn).toBe('rules/api-cccccccc/by-hand');
  });

  it("refuses a leaf under another family's container — for its tree, not for a directory with no container", () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('requests/api-cccccccc/_collection.yaml', COLLECTION_YAML),
      file('requests/api-cccccccc/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toEqual([]);
    expect(result.state.requestCollections).toHaveLength(1);
    expect(result.issues).toEqual([
      {
        path: 'requests/api-cccccccc/block-probes-aaaaaaaa/rule.yaml',
        message: 'rule under "requests", not "rules" — skipped',
      },
    ]);
  });

  it('names the directory of a leaf in another tree where that directory holds no container either', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('requests/by-hand/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.issues).toEqual([
      {
        path: 'requests/by-hand/block-probes-aaaaaaaa/rule.yaml',
        message: 'rule in no collection or folder — skipped',
        uncontainedIn: 'requests/by-hand',
      },
    ]);
  });

  it('keeps a leaf it skipped in a directory with no manifest, with what it holds, and gives it no uid', () => {
    const loose = 'rules/api-cccccccc/by-hand/block-probes-aaaaaaaa';
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file(COLLECTION_FILE, COLLECTION_YAML),
      file(`${loose}/rule.yaml`, `${RULE_YAML}handAdded: kept\n`),
      file('rules/api-cccccccc/copy-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.uncontained.rules.map(({ entity }) => [entity.uid, entity.path])).toEqual([['aaaaaaaa', loose]]);
    expect(result.uncontained.rules[0].unknowns).toHaveLength(1);
    // The uid is still free: the file inside the collection is the rule, and nothing reads as a duplicate.
    expect(result.state.rules.map((rule) => rule.path)).toEqual(['rules/api-cccccccc/copy-aaaaaaaa']);
    expect(result.issues.map((issue) => issue.path)).toEqual([`${loose}/rule.yaml`]);
  });

  it('keeps no leaf it refused for its tree, whatever its directory holds', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('requests/api-cccccccc/_collection.yaml', COLLECTION_YAML),
      file('requests/api-cccccccc/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
      file('requests/by-hand/block-probes-bbbbbbbb/rule.yaml', RULE_YAML.replace('aaaaaaaa', 'bbbbbbbb')),
    ]);
    expect(result.issues).toHaveLength(2);
    expect(Object.values(result.uncontained).flat()).toEqual([]);
  });

  it('refuses a request, a template and each request kind the same way — one that does not parse keeps the row of its place alone', () => {
    const manifests = ['request.yaml', 'grpc.yaml', 'websocket.yaml', 'mqtt.yaml', 'graphql.yaml'];
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      ...manifests.map((name, index) => file(`requests/stray-${index}/${name}`, 'not: [a document')),
      file('templates/stray/template.yaml', 'not: [a document'),
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'request in no collection or folder — skipped',
      'gRPC request in no collection or folder — skipped',
      'WebSocket request in no collection or folder — skipped',
      'MQTT request in no collection or folder — skipped',
      'GraphQL request in no collection or folder — skipped',
      'template in no collection or folder — skipped',
    ]);
    expect(Object.values(result.uncontained).flat()).toEqual([]);
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

describe('readWorkspaceTree — paths listed and not read', () => {
  const ENVIRONMENT_YAML = ['schemaVersion: 5', 'uid: eeeeeeee', 'name: dev', 'variables: []', ''].join('\n');
  const tree = [
    file('workspace.yaml', WORKSPACE_YAML),
    file(COLLECTION_FILE, COLLECTION_YAML),
    file(RULE_FILE, RULE_YAML),
  ];

  it('gives each a row at its own path, by its cause — a directory by its name, the root as itself', () => {
    const result = readWorkspaceTree(tree, [
      { path: 'workspace-vars.yaml', cause: 'too-large' },
      { path: 'trusted-roots.yaml', cause: 'unreadable', code: 'EPERM' },
      { path: 'workspace-vars.secret.yaml', cause: 'unreadable' },
      { path: 'requests/locked', cause: 'unlisted', code: 'EACCES' },
    ]);
    expect(result.issues).toEqual([
      { path: 'workspace-vars.yaml', message: 'larger than 16 MB — skipped' },
      { path: 'trusted-roots.yaml', message: 'cannot be read (EPERM) — skipped' },
      { path: 'workspace-vars.secret.yaml', message: 'cannot be read — skipped' },
      { path: 'requests/locked/', message: 'cannot be listed (EACCES) — skipped' },
    ]);
    expect(readWorkspaceTree([], [{ path: '', cause: 'unlisted', code: 'EPERM' }]).issues).toEqual([
      { path: './', message: 'cannot be listed (EPERM) — skipped' },
    ]);
  });

  it('a root file not read holds back nothing but itself — the root is no entity’s directory', () => {
    const result = readWorkspaceTree(
      [...tree, file('rule.yaml', RULE_YAML.replace('aaaaaaaa', 'bbbbbbbb'))],
      [{ path: 'workspace-vars.yaml', cause: 'too-large' }],
    );
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
    expect(result.state.workspaceVariables).toBeNull();
    expect(result.state.collections).toHaveLength(1);
    expect(result.state.rules).toHaveLength(1);
    // The manifest at the root keeps the row of its place, not one for the file beside it.
    expect(result.issues.map((issue) => [issue.path, issue.message])).toEqual([
      ['workspace-vars.yaml', 'larger than 16 MB — skipped'],
      ['rule.yaml', 'rule in no collection or folder — skipped'],
    ]);
  });

  it('does not read a document short of a file beside it: skipped, a row at its manifest that names the file', () => {
    const other = 'rules/api-cccccccc/allow-bbbbbbbb/rule.yaml';
    const result = readWorkspaceTree(
      [...tree, file(other, RULE_YAML.replace('aaaaaaaa', 'bbbbbbbb'))],
      [{ path: 'rules/api-cccccccc/block-probes-aaaaaaaa/capture.bin', cause: 'too-large' }],
    );
    expect(result.state.rules.map((rule) => rule.uid)).toEqual(['bbbbbbbb']);
    expect(result.issues).toEqual([
      { path: 'rules/api-cccccccc/block-probes-aaaaaaaa/capture.bin', message: 'larger than 16 MB — skipped' },
      { path: RULE_FILE, message: '"capture.bin" was not read — skipped' },
    ]);
    // Skipped whole: it claims no uid and is kept nowhere.
    expect(Object.values(result.shadowed).flat()).toEqual([]);
    expect(Object.values(result.uncontained).flat()).toEqual([]);
  });

  it('a collection with a file beside its manifest not read is skipped the same, and keeps its children', () => {
    const result = readWorkspaceTree(tree, [
      { path: 'rules/api-cccccccc/pre-request.js', cause: 'unreadable', code: 'EBUSY' },
    ]);
    expect(result.state.collections).toEqual([]);
    expect(result.state.rules).toHaveLength(1);
    expect(result.issues.map((issue) => [issue.path, issue.message])).toEqual([
      ['rules/api-cccccccc/pre-request.js', 'cannot be read (EBUSY) — skipped'],
      [COLLECTION_FILE, '"pre-request.js" was not read — skipped'],
    ]);
  });

  it('a manifest not read is one row, and holds back no other manifest of its directory', () => {
    const stray = 'rules/api-cccccccc/rule.yaml';
    const result = readWorkspaceTree(
      [file('workspace.yaml', WORKSPACE_YAML), file(COLLECTION_FILE, COLLECTION_YAML)],
      [
        { path: RULE_FILE, cause: 'unreadable', code: 'EACCES' },
        { path: stray, cause: 'unreadable', code: 'EACCES' },
      ],
    );
    expect(result.state.rules).toEqual([]);
    expect(result.state.collections).toHaveLength(1);
    expect(result.issues).toEqual([
      { path: RULE_FILE, message: 'cannot be read (EACCES) — skipped' },
      { path: stray, message: 'cannot be read (EACCES) — skipped' },
    ]);
  });

  it('a container whose manifest was not read still stands: what is inside it is read', () => {
    const result = readWorkspaceTree(
      [file('workspace.yaml', WORKSPACE_YAML), file(RULE_FILE, RULE_YAML)],
      [{ path: COLLECTION_FILE, cause: 'too-large' }],
    );
    expect(result.state.collections).toEqual([]);
    expect(result.state.rules).toHaveLength(1);
    expect(result.issues).toEqual([{ path: COLLECTION_FILE, message: 'larger than 16 MB — skipped' }]);
  });

  it('a workspace.yaml not read is no workspace and is not missing — nor is one under a root that would not list', () => {
    const unreadable = readWorkspaceTree(
      [file(COLLECTION_FILE, COLLECTION_YAML)],
      [{ path: 'workspace.yaml', cause: 'unreadable', code: 'EACCES' }],
    );
    expect(unreadable.state.workspace).toBeNull();
    expect(unreadable.issues).toEqual([{ path: 'workspace.yaml', message: 'cannot be read (EACCES) — skipped' }]);

    const unlisted = readWorkspaceTree([], [{ path: '', cause: 'unlisted', code: 'EACCES' }]);
    expect(unlisted.state.workspace).toBeNull();
    expect(unlisted.issues.map((issue) => issue.path)).toEqual(['./']);
  });

  it('a workspace.yaml gone beside a directory that would not list is still missing', () => {
    const result = readWorkspaceTree([], [{ path: 'rules', cause: 'unlisted', code: 'EACCES' }]);
    expect(result.issues.map((issue) => issue.path)).toEqual(['rules/', 'workspace.yaml']);
  });

  it('an environment is not read short of its secret file; one whose own file was not read is one row', () => {
    const short = readWorkspaceTree(
      [file('workspace.yaml', WORKSPACE_YAML), file('environments/dev-eeeeeeee.yaml', ENVIRONMENT_YAML)],
      [{ path: 'environments/dev-eeeeeeee.secret.yaml', cause: 'unreadable', code: 'EBUSY' }],
    );
    expect(short.state.environments).toEqual([]);
    expect(short.issues).toEqual([
      { path: 'environments/dev-eeeeeeee.secret.yaml', message: 'cannot be read (EBUSY) — skipped' },
      { path: 'environments/dev-eeeeeeee.yaml', message: '"dev-eeeeeeee.secret.yaml" was not read — skipped' },
    ]);

    const own = readWorkspaceTree(
      [
        file('workspace.yaml', WORKSPACE_YAML),
        file('environments/qa-ffffffff.yaml', ENVIRONMENT_YAML.replace('eeeeeeee', 'ffffffff')),
      ],
      [{ path: 'environments/dev-eeeeeeee.yaml', cause: 'too-large' }],
    );
    expect(own.state.environments.map((environment) => environment.uid)).toEqual(['ffffffff']);
    expect(own.issues).toEqual([{ path: 'environments/dev-eeeeeeee.yaml', message: 'larger than 16 MB — skipped' }]);
  });
});
