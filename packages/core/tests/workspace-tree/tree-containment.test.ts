/**
 * Containment of a tree read — a folder or a leaf is taken in only
 * where its directory is a container the workspace has: one read in
 * this reading, or one the engine holds.
 */

import { describe, expect, it } from 'vitest';
import type { Collection, Folder, Request, Template } from '../../src/types';
import {
  containTreeRead,
  type HeldContainers,
  readWorkspaceTree,
  type TreeFile,
  type TreeIssue,
  type TreeReadResult,
} from '../../src/workspace-tree';

const WORKSPACE_YAML = ['schemaVersion: 5', 'uid: wwwwwwww', 'name: Probe', ''].join('\n');
const BROKEN_YAML = 'schemaVersion: 5\nuid: [not a string\n';

const ruleYaml = (uid: string): string =>
  `schemaVersion: 5\nuid: ${uid}\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;
const collectionYaml = (uid: string): string => `schemaVersion: 5\nuid: ${uid}\nname: API\nvariables: []\n`;
const folderYaml = (uid: string): string => `schemaVersion: 5\nuid: ${uid}\nname: Auth\n`;

const refused = (kind: string): string => `${kind} inside no collection or folder of the workspace — skipped`;

/** The issue of a folder or a leaf refused for its place — at its manifest, naming the directory it sits in. */
const refusal = (path: string, kind: string, uncontainedIn: string): TreeIssue => ({
  path,
  message: refused(kind),
  uncontainedIn,
});

function file(path: string, content: string): TreeFile {
  return { path, content };
}

function makeCollection(uid: string, path: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function makeFolder(uid: string, path: string): Folder {
  return { schemaVersion: 5, uid, path, name: 'Auth' };
}

function makeHeld(overrides: Partial<HeldContainers> = {}): HeldContainers {
  return {
    collections: [],
    folders: [],
    requestCollections: [],
    requestFolders: [],
    templateCollections: [],
    templateFolders: [],
    ...overrides,
  };
}

function read(...files: TreeFile[]): TreeReadResult {
  return readWorkspaceTree([file('workspace.yaml', WORKSPACE_YAML), ...files]);
}

describe('containTreeRead', () => {
  it('returns the read itself where every container was read, whatever the engine holds', () => {
    const result = read(
      file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')),
      file('rules/api-cccccccc/auth-ffffffff/_folder.yaml', folderYaml('ffffffff')),
      file('rules/api-cccccccc/auth-ffffffff/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      file('rules/api-cccccccc/block-probes-bbbbbbbb/rule.yaml', ruleYaml('bbbbbbbb')),
    );
    expect(result.issues).toEqual([]);
    expect(containTreeRead(result, makeHeld())).toBe(result);
  });

  it('refuses a leaf under a new collection whose manifest did not read — the directory named slug-uid', () => {
    const result = containTreeRead(
      read(
        file('rules/broken-cccccccc/_collection.yaml', BROKEN_YAML),
        file('rules/broken-cccccccc/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ),
      makeHeld(),
    );
    expect(result.state.rules).toEqual([]);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'rules/broken-cccccccc/_collection.yaml',
      'rules/broken-cccccccc/block-probes-aaaaaaaa/rule.yaml',
    ]);
    expect(result.issues[1].message).toBe(refused('rule'));
  });

  it('refuses a leaf under a new collection whose manifest did not read — the directory named by hand', () => {
    const result = containTreeRead(
      read(
        file('rules/by-hand/_collection.yaml', BROKEN_YAML),
        file('rules/by-hand/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ),
      makeHeld({ collections: [makeCollection('cccccccc', 'rules/api-cccccccc')] }),
    );
    expect(result.state.rules).toEqual([]);
    expect(result.issues.at(-1)).toEqual(
      refusal('rules/by-hand/block-probes-aaaaaaaa/rule.yaml', 'rule', 'rules/by-hand'),
    );
  });

  it('keeps the children of a collection that did not read where the engine holds it at that path', () => {
    const raw = read(
      file('rules/api-cccccccc/_collection.yaml', BROKEN_YAML),
      file('rules/api-cccccccc/auth-ffffffff/_folder.yaml', folderYaml('ffffffff')),
      file('rules/api-cccccccc/auth-ffffffff/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      file('rules/api-cccccccc/block-probes-bbbbbbbb/rule.yaml', ruleYaml('bbbbbbbb')),
    );
    const result = containTreeRead(raw, makeHeld({ collections: [makeCollection('cccccccc', 'rules/api-cccccccc')] }));
    expect(result).toBe(raw);
    expect(result.state.rules.map((rule) => rule.uid).sort()).toEqual(['aaaaaaaa', 'bbbbbbbb']);
  });

  it("keeps a leaf where the directory's uid tail names a collection the engine holds", () => {
    const raw = read(
      file('rules/renamed-cccccccc/_collection.yaml', BROKEN_YAML),
      file('rules/renamed-cccccccc/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
    );
    expect(containTreeRead(raw, makeHeld({ collections: [makeCollection('cccccccc', 'rules/api-cccccccc')] }))).toBe(
      raw,
    );
  });

  it("refuses a folder at a tree's root, and the leaf inside it with it", () => {
    const result = containTreeRead(
      read(
        file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')),
        file('rules/loose-ffffffff/_folder.yaml', folderYaml('ffffffff')),
        file('rules/loose-ffffffff/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ),
      makeHeld({ collections: [makeCollection('cccccccc', 'rules/api-cccccccc')] }),
    );
    expect(result.state.collections).toHaveLength(1);
    expect(result.state.folders).toEqual([]);
    expect(result.state.rules).toEqual([]);
    expect(result.issues).toEqual([
      refusal('rules/loose-ffffffff/_folder.yaml', 'folder', 'rules'),
      refusal('rules/loose-ffffffff/block-probes-aaaaaaaa/rule.yaml', 'rule', 'rules/loose-ffffffff'),
    ]);
  });

  it('refuses top-down under a new collection that did not read: its folder, the folder inside, their leaves', () => {
    const result = containTreeRead(
      read(
        file('rules/broken-cccccccc/_collection.yaml', BROKEN_YAML),
        file('rules/broken-cccccccc/auth-ffffffff/_folder.yaml', folderYaml('ffffffff')),
        file('rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/_folder.yaml', folderYaml('gggggggg')),
        file('rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
        file('rules/broken-cccccccc/auth-ffffffff/block-probes-bbbbbbbb/rule.yaml', ruleYaml('bbbbbbbb')),
      ),
      makeHeld(),
    );
    expect(result.state.folders).toEqual([]);
    expect(result.state.rules).toEqual([]);
    expect(result.issues.slice(1).map((issue) => issue.path)).toEqual([
      'rules/broken-cccccccc/auth-ffffffff/_folder.yaml',
      'rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/_folder.yaml',
      'rules/broken-cccccccc/auth-ffffffff/deep-gggggggg/block-probes-aaaaaaaa/rule.yaml',
      'rules/broken-cccccccc/auth-ffffffff/block-probes-bbbbbbbb/rule.yaml',
    ]);
  });

  it('a folder the engine holds, read where it is refused, holds no leaf there', () => {
    const result = containTreeRead(
      read(
        file('rules/broken-bbbbbbbb/_collection.yaml', BROKEN_YAML),
        file('rules/broken-bbbbbbbb/auth-ffffffff/_folder.yaml', folderYaml('ffffffff')),
        file('rules/broken-bbbbbbbb/auth-ffffffff/block-probes-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ),
      makeHeld({
        collections: [makeCollection('cccccccc', 'rules/api-cccccccc')],
        folders: [makeFolder('ffffffff', 'rules/api-cccccccc/auth-ffffffff')],
      }),
    );
    expect(result.state.folders).toEqual([]);
    expect(result.state.rules).toEqual([]);
    expect(result.issues.slice(1).map((issue) => issue.message)).toEqual([refused('folder'), refused('rule')]);
  });

  it("asks each tree's own containers: a held rule collection does not hold a request at its path", () => {
    const raw = read();
    const stray = { uid: 'rrrrrrrr', path: 'requests/api-cccccccc/get-users-rrrrrrrr' } as Request;
    const result = containTreeRead(
      { ...raw, state: { ...raw.state, requests: [stray] } },
      makeHeld({ collections: [makeCollection('cccccccc', 'requests/api-cccccccc')] }),
    );
    expect(result.state.requests).toEqual([]);
    expect(result.issues).toEqual([
      refusal('requests/api-cccccccc/get-users-rrrrrrrr/request.yaml', 'request', 'requests/api-cccccccc'),
    ]);
  });

  it('refuses every leaf kind by its own manifest and name', () => {
    const raw = read();
    const at = (uid: string, tree: string) => ({ uid, path: `${tree}/by-hand/leaf-${uid}` });
    const result = containTreeRead(
      {
        ...raw,
        state: {
          ...raw.state,
          requests: [at('rrrrrrr1', 'requests') as Request],
          grpcRequests: [at('rrrrrrr2', 'requests') as (typeof raw.state.grpcRequests)[number]],
          websocketRequests: [at('rrrrrrr3', 'requests') as (typeof raw.state.websocketRequests)[number]],
          mqttRequests: [at('rrrrrrr4', 'requests') as (typeof raw.state.mqttRequests)[number]],
          graphqlRequests: [at('rrrrrrr5', 'requests') as (typeof raw.state.graphqlRequests)[number]],
          templates: [at('tttttttt', 'templates') as Template],
        },
      },
      makeHeld(),
    );
    expect(result.issues).toEqual([
      refusal('requests/by-hand/leaf-rrrrrrr1/request.yaml', 'request', 'requests/by-hand'),
      refusal('requests/by-hand/leaf-rrrrrrr2/grpc.yaml', 'gRPC request', 'requests/by-hand'),
      refusal('requests/by-hand/leaf-rrrrrrr3/websocket.yaml', 'WebSocket request', 'requests/by-hand'),
      refusal('requests/by-hand/leaf-rrrrrrr4/mqtt.yaml', 'MQTT request', 'requests/by-hand'),
      refusal('requests/by-hand/leaf-rrrrrrr5/graphql.yaml', 'GraphQL request', 'requests/by-hand'),
      refusal('templates/by-hand/leaf-tttttttt/template.yaml', 'template', 'templates/by-hand'),
    ]);
    expect([
      result.state.requests,
      result.state.grpcRequests,
      result.state.websocketRequests,
      result.state.mqttRequests,
      result.state.graphqlRequests,
      result.state.templates,
    ]).toEqual([[], [], [], [], [], []]);
  });

  it('drops the unknown-field rows of what it refuses and keeps the rest', () => {
    const raw = read(
      file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')),
      file('rules/api-cccccccc/block-probes-bbbbbbbb/rule.yaml', `${ruleYaml('bbbbbbbb')}handAdded: kept\n`),
      file('rules/broken-dddddddd/_collection.yaml', BROKEN_YAML),
      file('rules/broken-dddddddd/block-probes-aaaaaaaa/rule.yaml', `${ruleYaml('aaaaaaaa')}handAdded: dropped\n`),
    );
    expect(Object.keys(raw.unknowns).sort()).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    const result = containTreeRead(raw, makeHeld());
    expect(Object.keys(result.unknowns)).toEqual(['bbbbbbbb']);
    expect(result.state.rules.map((rule) => rule.uid)).toEqual(['bbbbbbbb']);
  });
});
