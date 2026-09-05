/**
 * Response examples as request children — the containment index for
 * the four example kinds.
 *
 * A request (HTTP, gRPC, WebSocket, MQTT, GraphQL) owns its examples
 * through one ordered set at its `examples` path; the slot `{ uid, type }` is
 * the ONE containment authority. An example's `path` is the request's
 * projected path plus the example's frozen `pathSegment`, and its
 * parent-uid field (`requestUid` and siblings) re-projects from the
 * slot's request — both stay persisted as projections because every
 * reader keys on them and the parent uid is the permanent seeding net
 * for slot-less examples (old clients).
 *
 * A request is a LEAF of the folder tree and a CONTAINER here, so the
 * index is a sibling of `folder-tree-post-state.ts` rather than a
 * generalisation of it: one pass over `materializeAll()` inverting
 * the five request kinds' `examples` sets into `exampleUid → (request,
 * position)`, memoized per oracle revision, composing the request's
 * path through the folder-tree index. The same conflict rules apply —
 * a child in two live slots keeps the higher add-HLC one (the other is
 * SHADOWED), a slot whose child is not live is DEAD — and no cycle is
 * possible (an example contains nothing). There is no rehome: an
 * example has no meaningful root besides its request.
 */

import {
  compareHlc,
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRAPHQL_REQUEST_EXAMPLES_PATH,
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_EXAMPLES_PATH,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type HLC,
  type MaterializedEntity,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_EXAMPLES_PATH,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MutationBody,
  type ParentRefShape,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EXAMPLES_PATH,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { projectGraphqlRequest } from '@openheaders/core/sync-builders/projections/graphql-request-projection';
import { projectGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import type { ExampleParent } from '@openheaders/core/sync-builders/projections/leaf-path';
import { projectMqttRequest } from '@openheaders/core/sync-builders/projections/mqtt-request-projection';
import { projectRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { projectWebSocketRequest } from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import type { EntityOracle } from '../oracle';
import { resolveLeafParentPath, type TreeSlotRecord } from './folder-tree-post-state';
import { REQUEST_TREE } from './request-folder-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

/**
 * One request kind as an example container: the request type, the
 * example type it holds, the example's stored parent-uid field (the
 * permanent seeding net), the `examples` path, the request's path
 * projector. The one vocabulary every example consumer reads — the
 * reconciler's seeding, the cascades, the readers.
 */
export interface ExampleContainerKind {
  requestType: string;
  exampleType: string;
  parentUidField: string;
  examplesPath: string;
  projectPath: (materialized: MaterializedEntity, parentPath: string | null) => string | null;
}

export const EXAMPLE_CONTAINER_KINDS: ReadonlyArray<ExampleContainerKind> = [
  {
    requestType: REQUEST_ENTITY_TYPE,
    exampleType: RESPONSE_EXAMPLE_ENTITY_TYPE,
    parentUidField: 'requestUid',
    examplesPath: REQUEST_EXAMPLES_PATH,
    projectPath: (m, parentPath) => projectRequest(m, parentPath)?.path ?? null,
  },
  {
    requestType: GRPC_REQUEST_ENTITY_TYPE,
    exampleType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
    parentUidField: 'grpcRequestUid',
    examplesPath: GRPC_REQUEST_EXAMPLES_PATH,
    projectPath: (m, parentPath) => projectGrpcRequest(m, parentPath)?.path ?? null,
  },
  {
    requestType: WEBSOCKET_REQUEST_ENTITY_TYPE,
    exampleType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
    parentUidField: 'websocketRequestUid',
    examplesPath: WEBSOCKET_REQUEST_EXAMPLES_PATH,
    projectPath: (m, parentPath) => projectWebSocketRequest(m, parentPath)?.path ?? null,
  },
  {
    requestType: MQTT_REQUEST_ENTITY_TYPE,
    exampleType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
    parentUidField: 'mqttRequestUid',
    examplesPath: MQTT_REQUEST_EXAMPLES_PATH,
    projectPath: (m, parentPath) => projectMqttRequest(m, parentPath)?.path ?? null,
  },
  // A GraphQL send compiles to one HTTP exchange, so the request holds
  // the HTTP example kind — same parent-uid field, same example type.
  {
    requestType: GRAPHQL_REQUEST_ENTITY_TYPE,
    exampleType: RESPONSE_EXAMPLE_ENTITY_TYPE,
    parentUidField: 'requestUid',
    examplesPath: GRAPHQL_REQUEST_EXAMPLES_PATH,
    projectPath: (m, parentPath) => projectGraphqlRequest(m, parentPath)?.path ?? null,
  },
];

const KIND_BY_TYPE: ReadonlyMap<string, ExampleContainerKind> = new Map(
  EXAMPLE_CONTAINER_KINDS.map((kind) => [kind.requestType, kind]),
);

/** The example-container vocabulary of a request type; `undefined` for a type that holds no examples. */
export function exampleContainerKind(requestType: string): ExampleContainerKind | undefined {
  return KIND_BY_TYPE.get(requestType);
}

/** The request whose live slot the index resolved for an example — the winner of two live slots; `null` when slot-less. */
export function resolveExampleSlotParent(oracle: Reads, exampleUid: string): ParentRefShape | null {
  const slot = exampleIndex(oracle).parentOf.get(exampleUid);
  return slot ? { type: slot.parent.type, uid: slot.parent.uid } : null;
}

/**
 * The live request an example projects from — its projected path and
 * uid. `null` when the example has no live slot; the example
 * projectors then keep the stored `path` + parent uid as the net.
 */
export function resolveExampleParent(oracle: Reads, exampleUid: string): ExampleParent | null {
  const index = exampleIndex(oracle);
  const slot = index.parentOf.get(exampleUid);
  if (!slot) return null;
  const path = requestPath(oracle, index, slot.parent);
  return path === null ? null : { path, uid: slot.parent.uid };
}

/** The live request path of `(type, uid)`, through the folder tree — memoized on the index. */
export function resolveRequestPath(oracle: Reads, request: { type: string; uid: string }): string | null {
  return requestPath(oracle, exampleIndex(oracle), request);
}

/**
 * Arrange projected examples in container order: by request uid (the
 * live slot's when slotted, the stored parent field otherwise), then
 * by slot position with slot-less examples after the slotted run,
 * then by uid. The persisted array carries this order to the next
 * boot, where parent-derived seeding mints ascending keys from it.
 */
export function arrangeInExampleOrder<E extends { uid: string }>(
  oracle: Reads,
  parentUidOf: (example: E) => string,
  entities: E[],
): E[] {
  const index = exampleIndex(oracle);
  const keyed = entities.map((entity) => {
    const slot = index.parentOf.get(entity.uid);
    return {
      entity,
      parentUid: slot ? slot.parent.uid : parentUidOf(entity),
      position: slot ? slot.position : UNSLOTTED,
    };
  });
  keyed.sort((a, b) => {
    if (a.parentUid !== b.parentUid) return a.parentUid < b.parentUid ? -1 : 1;
    if (a.position !== b.position) return a.position < b.position ? -1 : 1;
    return a.entity.uid < b.entity.uid ? -1 : a.entity.uid > b.entity.uid ? 1 : 0;
  });
  return keyed.map((entry) => entry.entity);
}

/** Whether an example uid holds a live slot on a live request. */
export function hasExampleSlot(oracle: Reads, exampleUid: string): boolean {
  return exampleIndex(oracle).parentOf.has(exampleUid);
}

/** Whether a committed envelope added, moved or removed an example slot on any request kind. */
export function affectsExampleContainment(body: MutationBody): boolean {
  const kind = KIND_BY_TYPE.get(body.type);
  return kind !== undefined && 'path' in body && body.path === kind.examplesPath;
}

/** Whether `type` is one of the request kinds that hold examples. */
export function isExampleContainerType(type: string): boolean {
  return KIND_BY_TYPE.has(type);
}

/** The slots the index dropped this revision — what the reconciler heals. */
export interface ExampleConflicts {
  shadowed: TreeSlotRecord[];
  deadSlots: TreeSlotRecord[];
}

export function exampleConflicts(oracle: Reads): ExampleConflicts {
  const index = exampleIndex(oracle);
  return { shadowed: index.shadowed, deadSlots: index.deadSlots };
}

// ── Index ────────────────────────────────────────────────────────────

interface ParentRef {
  type: string;
  uid: string;
}

interface SlotRef {
  parent: ParentRef;
  position: number;
  setPath: string;
  item: unknown;
  orderKey: string;
  addHlc: HLC;
}

interface ExampleIndex {
  revision: number;
  parentOf: Map<string, SlotRef>;
  /** Memoized request path per `type:uid`; null = unresolvable. */
  pathOf: Map<string, string | null>;
  shadowed: TreeSlotRecord[];
  deadSlots: TreeSlotRecord[];
}

const indexMemo = new WeakMap<object, ExampleIndex>();

function exampleIndex(oracle: Reads): ExampleIndex {
  const hit = indexMemo.get(oracle);
  if (hit && hit.revision === oracle.revision) return hit;

  const revision = oracle.revision;
  const materialized = oracle.materializeAll();
  const liveIds = new Set(materialized.map((m) => m.id));
  const parentOf = new Map<string, SlotRef>();
  const shadowed: TreeSlotRecord[] = [];
  const deadSlots: TreeSlotRecord[] = [];
  for (const m of materialized) {
    const kind = KIND_BY_TYPE.get(m.type);
    if (!kind) continue;
    const parent: ParentRef = { type: m.type, uid: m.id };
    const slots = oracle.liveOrderedSetItems(m.type, m.id, kind.examplesPath);
    for (let position = 0; position < slots.length; position++) {
      const entry = slots[position];
      const slot: SlotRef = {
        parent,
        position,
        setPath: kind.examplesPath,
        item: entry.item,
        orderKey: entry.key,
        addHlc: entry.addHlc,
      };
      if (!liveIds.has(entry.itemId)) {
        deadSlots.push(slotRecord(entry.itemId, slot));
        continue;
      }
      const held = parentOf.get(entry.itemId);
      if (!held) {
        parentOf.set(entry.itemId, slot);
        continue;
      }
      if (outranks(slot, held)) {
        shadowed.push(slotRecord(entry.itemId, held));
        parentOf.set(entry.itemId, slot);
      } else {
        shadowed.push(slotRecord(entry.itemId, slot));
      }
    }
  }
  const index: ExampleIndex = { revision, parentOf, pathOf: new Map(), shadowed, deadSlots };
  indexMemo.set(oracle, index);
  return index;
}

/** Higher add-HLC wins; equal HLCs fall back to the parent key. */
function outranks(candidate: SlotRef, held: SlotRef): boolean {
  const byHlc = compareHlc(candidate.addHlc, held.addHlc);
  if (byHlc !== 0) return byHlc > 0;
  return nodeKey(candidate.parent) > nodeKey(held.parent);
}

function slotRecord(childUid: string, slot: SlotRef): TreeSlotRecord {
  return { childUid, parent: slot.parent, setPath: slot.setPath, item: slot.item, orderKey: slot.orderKey };
}

function nodeKey(node: ParentRef): string {
  return `${node.type}:${node.uid}`;
}

function requestPath(oracle: Reads, index: ExampleIndex, request: ParentRef): string | null {
  const key = nodeKey(request);
  const memo = index.pathOf.get(key);
  if (memo !== undefined) return memo;
  const kind = KIND_BY_TYPE.get(request.type);
  const materialized = kind ? oracle.materializeOne(request.type, request.uid) : null;
  const path =
    kind && materialized
      ? kind.projectPath(materialized, resolveLeafParentPath(oracle, request.uid, REQUEST_TREE))
      : null;
  index.pathOf.set(key, path);
  return path;
}

/** Slot-less examples sort after every slotted sibling. */
const UNSLOTTED = Number.POSITIVE_INFINITY;
