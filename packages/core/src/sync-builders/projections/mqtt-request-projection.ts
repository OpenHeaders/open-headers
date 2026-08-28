/**
 * MqttRequest projection — `MqttRequest ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Parallel to {@link websocket-request-projection}: the MQTT-request
 * entity treats `topics`, `savedMessages` and `userProperties` as
 * **sets** (parent-owned ordering with itemId-keyed members +
 * fractional indexing), while `MqttRequest` persists them as plain
 * arrays. `seedMqttRequest` strips the set-modeled fields off the
 * create payload and emits one `addToSet` per row keyed by the row's
 * own uid; `projectMqttRequest` reads the oracle's MaterializedEntity
 * back into an `MqttRequest`.
 */

import {
  type ChildPlacement,
  type MaterializedEntity,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  mqttRequestChild,
  orderKeyMinter,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { MqttRequest } from '@openheaders/core/types';
import { lastPathSegment } from '@openheaders/core/utils';
import { projectLeafPath } from './leaf-path';

/** Set-modeled paths on an MqttRequest, with their row readers. */
const SET_PATHS = [
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
] as const;

/**
 * Convert a persisted MqttRequest into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per
 * topic/saved-message/user-property row. Each row's `uid` doubles as
 * the sync engine's itemId, so reorder gestures land as `moveBefore`
 * over a known itemId set. Per-batch all-or-nothing under the
 * oracle's lock.
 *
 * `placement` is the tree linkage for a NEW request: the parent's
 * `items` slot rides the same batch and the shell is stamped with its
 * frozen `pathSegment`. Boot-time re-seeds pass none.
 */
export function seedMqttRequest(
  request: MqttRequest,
  ctx: MutatorContext,
  placement?: ChildPlacement<RequestFolderParentRef>,
): MutationBatch {
  // Deep clone via JSON round-trip — MqttRequest has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  for (const path of SET_PATHS) delete shell[path];
  if (placement) shell.pathSegment ??= lastPathSegment(request.path);

  const bodies: MutationBody[] = [{ kind: 'create', type: MQTT_REQUEST_ENTITY_TYPE, id: request.uid, payload: shell }];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break.
  for (const path of SET_PATHS) {
    const rows =
      path === MQTT_REQUEST_TOPICS_PATH
        ? request.topics
        : path === MQTT_REQUEST_SAVED_MESSAGES_PATH
          ? request.savedMessages
          : request.userProperties;
    const nextKey = orderKeyMinter();
    for (const row of rows) {
      bodies.push({
        kind: 'addToSet',
        type: MQTT_REQUEST_ENTITY_TYPE,
        id: request.uid,
        path,
        itemId: row.uid,
        item: row,
        orderKey: nextKey(),
      });
    }
  }
  if (placement) bodies.push(mqttRequestChild.slotAdd(request.uid, placement.parent, placement.orderKey));
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into an `MqttRequest`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds. `parentPath` is the resolved
 * path of the live parent slot; `null` keeps the stored `path`.
 */
export function projectMqttRequest(
  materialized: MaterializedEntity,
  parentPath: string | null = null,
): MqttRequest | null {
  if (materialized.type !== MQTT_REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; the three set paths are emitted
  // as arrays. The cast is honest because seedMqttRequest committed to
  // that shape on the way in (all three arrays are schema-required, so
  // the store's [] for an empty set path IS the persisted shape).
  const request = data as MqttRequest;
  return parentPath === null ? request : { ...request, path: projectLeafPath(data, parentPath) };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
