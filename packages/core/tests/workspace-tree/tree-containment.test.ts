/**
 * Containment of a tree read — a folder or a leaf is taken in only
 * where its directory is a container the workspace has: one read in
 * this reading, or one the engine holds.
 */

import { describe, expect, it } from 'vitest';
import type { Collection, Folder, Request, Rule, Template } from '../../src/types';
import {
  containTreeRead,
  type HeldTree,
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

const namedRuleYaml = (uid: string, name: string): string => ruleYaml(uid).replace('Block probes', name);

const refused = (kind: string): string => `${kind} inside no collection or folder of the workspace — skipped`;
const duplicate = (path: string, uid: string): TreeIssue => ({
  path,
  message: `duplicate uid "${uid}" — entity skipped`,
});

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

function makeHeld(overrides: Partial<HeldTree> = {}): HeldTree {
  return {
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

describe('containTreeRead — a leaf in a directory with no manifest', () => {
  const API = file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc'));
  const AUTH = 'rules/api-cccccccc/auth-eeeeeeee';
  const DEEP = `${AUTH}/deep-ffffffff`;
  const heldTree = (overrides: Partial<HeldTree> = {}): HeldTree =>
    makeHeld({
      collections: [makeCollection('cccccccc', 'rules/api-cccccccc')],
      folders: [makeFolder('eeeeeeee', AUTH), makeFolder('ffffffff', DEEP)],
      ...overrides,
    });
  const heldRule = (path: string): Rule => ({ uid: 'aaaaaaaa', path }) as Rule;
  const rulesOf = (result: TreeReadResult): string[][] => result.state.rules.map((rule) => [rule.path, rule.name]);

  it('a held folder whose manifest was removed keeps its leaf — no row', () => {
    const result = containTreeRead(
      read(
        API,
        file(`${AUTH}/_folder.yaml`, folderYaml('eeeeeeee')),
        file(`${DEEP}/inner-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Inner')),
      ),
      heldTree(),
    );
    expect(rulesOf(result)).toEqual([[`${DEEP}/inner-aaaaaaaa`, 'Inner']]);
    expect(result.issues).toEqual([]);
  });

  it("keeps it where the folder's directory was renamed above it — by the directory's uid tail", () => {
    const renamed = 'rules/api-cccccccc/authz-eeeeeeee';
    const result = containTreeRead(
      read(
        API,
        file(`${renamed}/_folder.yaml`, folderYaml('eeeeeeee')),
        file(`${renamed}/deep-ffffffff/inner-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Inner')),
      ),
      heldTree({ rules: [heldRule(`${DEEP}/inner-aaaaaaaa`)] }),
    );
    expect(rulesOf(result)).toEqual([[`${renamed}/deep-ffffffff/inner-aaaaaaaa`, 'Inner']]);
    expect(result.issues).toEqual([]);
  });

  it('refuses it where the engine holds no container at that directory — the same read, the row of its place', () => {
    const raw = read(API, file('rules/api-cccccccc/by-hand/inner-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')));
    const result = containTreeRead(raw, heldTree());
    expect(result).toBe(raw);
    expect(result.state.rules).toEqual([]);
    expect(result.issues).toEqual([
      {
        path: 'rules/api-cccccccc/by-hand/inner-aaaaaaaa/rule.yaml',
        message: 'rule outside a collection or folder of "rules" — skipped',
        uncontainedIn: 'rules/api-cccccccc/by-hand',
      },
    ]);
  });

  it('the file at the place the engine holds the rule is the rule, though one the reader read sorts before it', () => {
    const copy = 'rules/api-cccccccc/a-copy-aaaaaaaa';
    const result = containTreeRead(
      read(
        API,
        file(`${copy}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Copy')),
        file(`${AUTH}/_folder.yaml`, folderYaml('eeeeeeee')),
        file(`${DEEP}/inner-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Held')),
      ),
      heldTree({ rules: [heldRule(`${DEEP}/inner-aaaaaaaa`)] }),
    );
    expect(rulesOf(result)).toEqual([[`${DEEP}/inner-aaaaaaaa`, 'Held']]);
    expect(result.issues).toEqual([duplicate(`${copy}/rule.yaml`, 'aaaaaaaa')]);
  });

  it('a rule the engine holds elsewhere keeps its own file against one in such a directory', () => {
    const own = 'rules/api-cccccccc/own-aaaaaaaa';
    const raw = read(
      API,
      file(`${AUTH}/_folder.yaml`, folderYaml('eeeeeeee')),
      file(`${DEEP}/inner-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Loose')),
      file(`${own}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Own')),
    );
    const result = containTreeRead(raw, heldTree({ rules: [heldRule(own)] }));
    expect(result).toBe(raw);
    expect(rulesOf(result)).toEqual([[own, 'Own']]);
    expect(result.issues.map((issue) => issue.path)).toEqual([`${DEEP}/inner-aaaaaaaa/rule.yaml`]);
  });

  it('of two such files, the one at the place the engine holds the rule is the rule', () => {
    const result = containTreeRead(
      read(
        API,
        file(`${AUTH}/a-copy-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Copy')),
        file(`${DEEP}/inner-aaaaaaaa/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Held')),
      ),
      heldTree({ rules: [heldRule(`${DEEP}/inner-aaaaaaaa`)] }),
    );
    expect(rulesOf(result)).toEqual([[`${DEEP}/inner-aaaaaaaa`, 'Held']]);
    expect(result.issues.map((issue) => issue.path)).toEqual([`${AUTH}/a-copy-aaaaaaaa/rule.yaml`]);
  });

  it('the unknown-field rows of a leaf taken in that way are kept', () => {
    const result = containTreeRead(
      read(
        API,
        file(`${AUTH}/_folder.yaml`, folderYaml('eeeeeeee')),
        file(`${DEEP}/inner-aaaaaaaa/rule.yaml`, `${ruleYaml('aaaaaaaa')}handAdded: kept\n`),
      ),
      heldTree(),
    );
    expect(result.unknowns.aaaaaaaa.map((row) => row.path)).toEqual(['/handAdded']);
  });
});

describe('containTreeRead — a uid more than one leaf file claims', () => {
  const API = file('rules/api-cccccccc/_collection.yaml', collectionYaml('cccccccc'));
  const BROKEN = file('rules/aaa-broken-dddddddd/_collection.yaml', BROKEN_YAML);
  const INSIDE = 'rules/aaa-broken-dddddddd/inside-aaaaaaaa';
  const FIRST = 'rules/api-cccccccc/a-first-aaaaaaaa';
  const COPY = 'rules/api-cccccccc/copy-aaaaaaaa';
  const heldRule = (path: string): Rule => ({ uid: 'aaaaaaaa', path }) as Rule;
  const rulesOf = (result: TreeReadResult): string[][] => result.state.rules.map((rule) => [rule.path, rule.name]);

  it('a file refused for its place claims nothing: the copy the workspace can hold is the rule', () => {
    const result = containTreeRead(
      read(
        BROKEN,
        file(`${INSIDE}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Refused')),
        API,
        file(`${COPY}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Copy')),
      ),
      makeHeld(),
    );
    expect(rulesOf(result)).toEqual([[COPY, 'Copy']]);
    expect(result.issues.slice(1)).toEqual([refusal(`${INSIDE}/rule.yaml`, 'rule', 'rules/aaa-broken-dddddddd')]);
  });

  it('gives it to the first in path order where the workspace can hold both — the same read', () => {
    const raw = read(
      API,
      file(`${FIRST}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'First')),
      file(`${COPY}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Copy')),
    );
    const result = containTreeRead(raw, makeHeld({ rules: [heldRule('rules/api-cccccccc/elsewhere-aaaaaaaa')] }));
    expect(result).toBe(raw);
    expect(rulesOf(result)).toEqual([[FIRST, 'First']]);
    expect(result.issues).toEqual([duplicate(`${COPY}/rule.yaml`, 'aaaaaaaa')]);
  });

  it('the file at the place the engine holds the rule is the rule, though a copy sorts before it', () => {
    const result = containTreeRead(
      read(
        API,
        file(`${FIRST}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'First')),
        file(`${COPY}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Held')),
      ),
      makeHeld({ rules: [heldRule(COPY)] }),
    );
    expect(rulesOf(result)).toEqual([[COPY, 'Held']]);
    expect(result.issues).toEqual([duplicate(`${FIRST}/rule.yaml`, 'aaaaaaaa')]);
  });

  it('the held rule keeps its file against a copy under a collection that does not read — its hand edit is read', () => {
    const result = containTreeRead(
      read(
        BROKEN,
        file(`${INSIDE}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Refused')),
        API,
        file(`${COPY}/rule.yaml`, namedRuleYaml('aaaaaaaa', 'Edited by hand')),
      ),
      makeHeld({ collections: [makeCollection('cccccccc', 'rules/api-cccccccc')], rules: [heldRule(COPY)] }),
    );
    expect(rulesOf(result)).toEqual([[COPY, 'Edited by hand']]);
    expect(result.issues.slice(1)).toEqual([refusal(`${INSIDE}/rule.yaml`, 'rule', 'rules/aaa-broken-dddddddd')]);
  });

  it('leaves it with the first where the workspace can hold none of them, refused for its place', () => {
    const result = containTreeRead(
      read(
        BROKEN,
        file(`${INSIDE}/rule.yaml`, ruleYaml('aaaaaaaa')),
        file('rules/aaa-broken-dddddddd/other-aaaaaaaa/rule.yaml', ruleYaml('aaaaaaaa')),
      ),
      makeHeld(),
    );
    expect(result.state.rules).toEqual([]);
    expect(result.issues.slice(1)).toEqual([
      duplicate('rules/aaa-broken-dddddddd/other-aaaaaaaa/rule.yaml', 'aaaaaaaa'),
      refusal(`${INSIDE}/rule.yaml`, 'rule', 'rules/aaa-broken-dddddddd'),
    ]);
  });

  it('the unknown-field rows follow the file that is the rule', () => {
    const files = (firstExtra: string, copyExtra: string): TreeFile[] => [
      BROKEN,
      file(`${INSIDE}/rule.yaml`, `${ruleYaml('aaaaaaaa')}${firstExtra}`),
      API,
      file(`${COPY}/rule.yaml`, `${ruleYaml('aaaaaaaa')}${copyExtra}`),
    ];
    const swapped = containTreeRead(read(...files('handAdded: refused\n', 'copyAdded: kept\n')), makeHeld());
    expect(swapped.unknowns.aaaaaaaa.map((row) => row.path)).toEqual(['/copyAdded']);
    const bare = containTreeRead(read(...files('handAdded: refused\n', '')), makeHeld());
    expect(Object.keys(bare.unknowns)).toEqual([]);
  });

  it('settles a request the same way, by its own family', () => {
    const raw = read(file('requests/api-cccccccc/_collection.yaml', collectionYaml('cccccccc')));
    const refusedOne = { uid: 'rrrrrrrr', path: 'requests/by-hand/get-users-rrrrrrrr' } as Request;
    const copy = { uid: 'rrrrrrrr', path: 'requests/api-cccccccc/get-users-rrrrrrrr' } as Request;
    const result = containTreeRead(
      {
        ...raw,
        state: { ...raw.state, requests: [refusedOne] },
        issues: [duplicate(`${copy.path}/request.yaml`, 'rrrrrrrr')],
        shadowed: { ...raw.shadowed, requests: [{ entity: copy, unknowns: [] }] },
      },
      makeHeld(),
    );
    expect(result.state.requests).toEqual([copy]);
    expect(result.issues).toEqual([refusal(`${refusedOne.path}/request.yaml`, 'request', 'requests/by-hand')]);
  });
});
