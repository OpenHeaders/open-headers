/**
 * Workspace-tree property harness — the Phase 2 gate (the git-sync plan §8
 * round-trip law lifted from one document to the whole tree).
 *
 * Over seeded full-workspace states spanning every entity family:
 *
 *   1. Tree round-trip fixpoint — plan → read → plan is byte-identical
 *      file-for-file, with zero read issues (the materialize ⇄ rescan
 *      loop of §3.1 rungs 1/2 converges immediately).
 *   2. Entity-array-order independence — shuffling every entity array
 *      produces the identical file set (order is parent-owned data,
 *      never array position).
 *   3. Unknown-field survival — rows injected via the unknowns map ride
 *      plan → read → plan byte-stably.
 *   4. `order:` stamped from a slot reader survives the same loop and
 *      is independent of entity array order too.
 *
 * Seeded mulberry32 like the codec harness; a failing seed reproduces
 * exactly.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { ParentRefShape } from '../../src/sync';
import type { Collection, Folder } from '../../src/types/collection';
import type { GrpcRequest } from '../../src/types/grpc-request';
import type { LiveVariable, LiveWorkflow } from '../../src/types/live';
import type { MqttRequest } from '../../src/types/mqtt-request';
import type { Request } from '../../src/types/request';
import type { Rule } from '../../src/types/rule';
import type { Spec } from '../../src/types/spec';
import type { Template } from '../../src/types/template';
import type { Environment, Vault, WorkspaceVariables } from '../../src/types/variable';
import type { WebSocketRequest } from '../../src/types/websocket-request';
import type { WorkspaceManifest } from '../../src/types/workspace';
import { toFolderName } from '../../src/utils/workspace';
import {
  applyTreeOrder,
  planWorkspaceTree,
  readWorkspaceTree,
  type TreeFile,
  type TreeSlotEntry,
  type TreeSlotReader,
  type TreeUnknownFields,
  type WorkspaceTreeState,
} from '../../src/workspace-tree';
import { ENTITY_CASES, type EntityCase } from '../codec/harness/entity-gen';
import { makeRng, type Rng } from '../sync/harness/random';

const SEEDS = 40;

const CASE_BY_NAME = new Map<string, EntityCase>(ENTITY_CASES.map((entityCase) => [entityCase.name, entityCase]));

const UID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function uid8(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) out += UID_ALPHABET[rng.int(UID_ALPHABET.length)];
  return out;
}

type AnySchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** Generate one schema-valid entity via the codec harness, with a uniquifying patch. */
function generateAs<T>(name: string, rng: Rng, patch?: (draft: Record<string, unknown>) => void): T {
  const entityCase = CASE_BY_NAME.get(name);
  if (!entityCase) throw new Error(`no entity case named "${name}"`);
  const draft = entityCase.generate(rng);
  patch?.(draft);
  return v.parse(entityCase.schema as AnySchema, draft) as T;
}

/** Stamp a fresh uid + a tree-unique `path` under `parentDir`. */
function placed(rng: Rng, parentDir: string): (draft: Record<string, unknown>) => void {
  return (draft) => {
    draft.uid = uid8(rng);
    draft.path = `${parentDir}/${toFolderName(draft.name as string, draft.uid as string)}`;
  };
}

function generateState(rng: Rng): { state: WorkspaceTreeState; unknowns: TreeUnknownFields } {
  const workspace = generateAs<WorkspaceManifest>('workspace', rng, (draft) => {
    draft.uid = uid8(rng);
  });

  const ruleCollection = generateAs<Collection>('collection', rng, placed(rng, 'rules'));
  const looseRule = generateAs<Rule>('rule', rng, placed(rng, 'rules'));
  const collectedRule = generateAs<Rule>('rule', rng, placed(rng, ruleCollection.path));

  const requestCollection = generateAs<Collection>('collection', rng, (draft) => {
    placed(rng, 'requests')(draft);
    draft.preRequestScript = `console.log('${uid8(rng)}');\n`;
    draft.scripts = { 'ws-before-connect': `oh.session.attempt = 0; // ${uid8(rng)}\n` };
  });
  const requestFolder = generateAs<Folder>('folder', rng, placed(rng, requestCollection.path));
  const plainRequest = generateAs<Request>('request', rng, placed(rng, requestCollection.path));
  const bodyRequest = generateAs<Request>('request', rng, (draft) => {
    placed(rng, requestFolder.path)(draft);
    draft.body = { type: 'json', content: `{"probe":"${uid8(rng)}"}` };
    draft.postResponseScript = `oh.test('ok', () => {});\n`;
  });
  const grpcRequest = generateAs<GrpcRequest>('grpc-request', rng, (draft) => {
    placed(rng, requestCollection.path)(draft);
    if (rng.next() < 0.5) draft.message = `{"id":${rng.int(100)}}`;
    if (rng.next() < 0.5) draft.scripts = { 'grpc-after-response': `oh.test('${uid8(rng)}', () => {});\n` };
  });
  const websocketRequest = generateAs<WebSocketRequest>('websocket-request', rng, (draft) => {
    placed(rng, requestCollection.path)(draft);
    if (rng.next() < 0.5) draft.message = `ping-${uid8(rng)}`;
    if (rng.next() < 0.5) draft.scripts = { 'ws-on-message': `console.log('${uid8(rng)}');\n` };
  });
  const mqttRequest = generateAs<MqttRequest>('mqtt-request', rng, (draft) => {
    placed(rng, requestCollection.path)(draft);
    if (rng.next() < 0.5) draft.payload = `{"probe":"${uid8(rng)}"}`;
    if (rng.next() < 0.5) draft.scripts = { 'mqtt-before-publish': `oh.setTopic('${uid8(rng)}');\n` };
  });

  const templateCollection = generateAs<Collection>('collection', rng, placed(rng, 'templates'));
  const template = generateAs<Template>('template', rng, placed(rng, templateCollection.path));

  const plainEnvironment = generateAs<Environment>('environment', rng, (draft) => {
    draft.uid = uid8(rng);
  });
  const secretEnvironment = generateAs<Environment>('environment', rng, (draft) => {
    draft.uid = uid8(rng);
    (draft.variables as unknown[]).push({
      uid: uid8(rng),
      name: 'API_TOKEN',
      value: `tok-${uid8(rng)}`,
      type: 'secret',
    });
  });

  const workspaceVariables = generateAs<WorkspaceVariables>('workspace-variables', rng);
  const vault = generateAs<Vault>('vault', rng);
  const spec = generateAs<Spec>('spec', rng, placed(rng, 'specs'));
  const liveWorkflow = generateAs<LiveWorkflow>('live-workflow', rng, placed(rng, 'live-workflows'));
  const liveVariable = generateAs<LiveVariable>('live-variable', rng, placed(rng, 'live-variables'));

  const unknowns: TreeUnknownFields = {
    [looseRule.uid]: [{ path: '/futureFlag', value: { rollout: rng.int(100) } }],
  };

  return {
    state: {
      workspace,
      rules: [looseRule, collectedRule],
      collections: [ruleCollection],
      folders: [],
      requests: [plainRequest, bodyRequest],
      grpcRequests: [grpcRequest],
      websocketRequests: [websocketRequest],
      mqttRequests: [mqttRequest],
      requestCollections: [requestCollection],
      requestFolders: [requestFolder],
      templates: [template],
      templateCollections: [templateCollection],
      templateFolders: [],
      environments: [plainEnvironment, secretEnvironment],
      workspaceVariables,
      vault,
      trustedRoots: null,
      specs: [spec],
      liveWorkflows: [liveWorkflow],
      liveVariables: [liveVariable],
    },
    unknowns,
  };
}

/**
 * A slot reader over the generated state: every container's children
 * (folders then leaves, matched by path prefix) shuffled by the rng —
 * a manual order the arrays do not carry.
 */
/**
 * A slot reader over the state's own containment, shuffled: every child
 * gets a random key from a shared keyspace, so folders and leaves of one
 * container interleave by key exactly as a mixed order would.
 */
function shuffledSlots(state: WorkspaceTreeState, rng: Rng): TreeSlotReader {
  const byUid = new Map<string, { path: string }>();
  const all = [
    ...state.collections,
    ...state.requestCollections,
    ...state.templateCollections,
    ...state.folders,
    ...state.requestFolders,
    ...state.templateFolders,
    ...state.rules,
    ...state.requests,
    ...state.grpcRequests,
    ...state.websocketRequests,
    ...state.mqttRequests,
    ...state.templates,
  ];
  for (const entity of all) byUid.set(entity.uid, entity);
  const containerPath = (parent: ParentRefShape): string | null => {
    if (parent.type === 'workspace-roots') return null;
    return byUid.get(parent.uid)?.path ?? null;
  };
  const keyOf = new Map<string, string>();
  const randomKey = (uid: string): string => {
    let key = keyOf.get(uid);
    if (key === undefined) {
      key = '';
      for (let i = 0; i < 3; i += 1) key += String.fromCharCode(0x61 + rng.int(26));
      keyOf.set(uid, key);
    }
    return key;
  };
  const childrenOf = (prefix: string, pool: ReadonlyArray<{ uid: string; path: string }>): TreeSlotEntry[] =>
    pool
      .filter((entity) => entity.path.startsWith(`${prefix}/`) && !entity.path.slice(prefix.length + 1).includes('/'))
      .map((e) => ({ uid: e.uid, orderKey: randomKey(e.uid) }))
      .sort((x, y) => (x.orderKey < y.orderKey ? -1 : x.orderKey > y.orderKey ? 1 : x.uid < y.uid ? -1 : 1));
  return (parent, setPath) => {
    if (parent.type === 'workspace-roots') {
      const prefix =
        setPath === 'ruleCollections' ? 'rules' : setPath === 'requestCollections' ? 'requests' : 'templates';
      return childrenOf(prefix, [...state.collections, ...state.requestCollections, ...state.templateCollections]);
    }
    const path = containerPath(parent);
    if (path === null) return [];
    if (setPath === 'folders')
      return childrenOf(path, [...state.folders, ...state.requestFolders, ...state.templateFolders]);
    return childrenOf(path, [
      ...state.rules,
      ...state.requests,
      ...state.grpcRequests,
      ...state.websocketRequests,
      ...state.mqttRequests,
      ...state.templates,
    ]);
  };
}

function expectSameFiles(actual: TreeFile[], expected: TreeFile[], seed: number): void {
  expect(
    actual.map((f) => f.path),
    `seed ${seed}: path sets diverge`,
  ).toEqual(expected.map((f) => f.path));
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i].content, `seed ${seed}: bytes diverge at ${expected[i].path}`).toBe(expected[i].content);
  }
}

describe('workspace-tree round-trip properties', () => {
  it(`plan → read → plan is a byte fixpoint with zero issues (${SEEDS} seeded workspaces)`, () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const rng = makeRng(seed * 7919);
      const { state, unknowns } = generateState(rng);

      const plan = planWorkspaceTree(state, unknowns);

      const sortedPaths = plan.map((f) => f.path);
      expect(sortedPaths, `seed ${seed}: plan not sorted`).toEqual([...sortedPaths].sort());

      const result = readWorkspaceTree(plan);
      expect(result.issues, `seed ${seed}: read issues`).toEqual([]);
      if (result.state.workspace === null) throw new Error(`seed ${seed}: workspace not recovered`);

      const replan = planWorkspaceTree({ ...result.state, workspace: result.state.workspace }, result.unknowns);
      expectSameFiles(replan, plan, seed);
    }
  });

  it('entity array order never changes the file set', () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const rng = makeRng(seed * 104_729);
      const { state, unknowns } = generateState(rng);
      const plan = planWorkspaceTree(state, unknowns);

      const shuffled: WorkspaceTreeState = {
        ...state,
        rules: rng.shuffle(state.rules),
        requests: rng.shuffle(state.requests),
        environments: rng.shuffle(state.environments),
        collections: rng.shuffle(state.collections),
        requestCollections: rng.shuffle(state.requestCollections),
        templateCollections: rng.shuffle(state.templateCollections),
      };
      expectSameFiles(planWorkspaceTree(shuffled, unknowns), plan, seed);
    }
  });

  it('unknown rows injected for an entity survive the tree round-trip', () => {
    const rng = makeRng(424_242);
    const { state, unknowns } = generateState(rng);
    const ruleUid = state.rules[0].uid;

    const plan = planWorkspaceTree(state, unknowns);
    const ruleFile = plan.find((f) => f.path === `${state.rules[0].path}/rule.yaml`);
    expect(ruleFile?.content).toContain('futureFlag:');

    const result = readWorkspaceTree(plan);
    expect(result.unknowns[ruleUid]).toEqual(unknowns[ruleUid]);
  });

  it(`order: stamped from the live sets is a byte fixpoint and array-order independent (${SEEDS} seeded workspaces)`, () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const rng = makeRng(seed * 15_485_863);
      const generated = generateState(rng);
      const state = applyTreeOrder(generated.state, shuffledSlots(generated.state, rng));
      const plan = planWorkspaceTree(state, generated.unknowns);

      const result = readWorkspaceTree(plan);
      expect(result.issues, `seed ${seed}: read issues`).toEqual([]);
      if (result.state.workspace === null) throw new Error(`seed ${seed}: workspace not recovered`);
      expect(result.state.workspace.order, `seed ${seed}: manifest order`).toEqual(state.workspace.order);
      for (const collection of state.requestCollections) {
        const read = result.state.requestCollections.find((c) => c.uid === collection.uid);
        expect(read?.order, `seed ${seed}: collection ${collection.uid} order`).toEqual(collection.order);
      }
      const replan = planWorkspaceTree({ ...result.state, workspace: result.state.workspace }, result.unknowns);
      expectSameFiles(replan, plan, seed);

      const shuffled: WorkspaceTreeState = {
        ...state,
        rules: rng.shuffle(state.rules),
        requests: rng.shuffle(state.requests),
        requestCollections: rng.shuffle(state.requestCollections),
      };
      expectSameFiles(planWorkspaceTree(shuffled, generated.unknowns), plan, seed);
    }
  });

  it('a case-insensitive path collision fails loudly', () => {
    const rng = makeRng(7);
    const { state, unknowns } = generateState(rng);
    const clashing: WorkspaceTreeState = {
      ...state,
      rules: [state.rules[0], { ...state.rules[1], path: state.rules[0].path.toUpperCase() }],
    };
    expect(() => planWorkspaceTree(clashing, unknowns)).toThrow(/duplicate tree path/);
  });
});
