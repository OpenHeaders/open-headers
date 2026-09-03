/**
 * MqttRequest write-site → oracle helpers.
 *
 * Parallel to {@link websocket-request-mutations}: write sites produce
 * `(batch, sideEffects)` pairs as pure transforms — no oracle reads,
 * no IO. The three set-modeled fields (`topics`, `savedMessages`,
 * `userProperties`) route through the shared {@link synthesizeSetDiff}
 * minimum-envelope synthesizer; container-valued scalars
 * (`publishProperties`, `lastWill`, `specLink`, `auth`) route through
 * {@link synthesizeFieldDiff} so edits share create's per-leaf
 * representation and a cleared object tombstones its leaves.
 *
 * No side-effect intents: MQTT requests don't feed DNR or the
 * variables resolver.
 */

import {
  type ChildPlacement,
  deleteMqttRequest,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type RequestFolderParentRef,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeFieldDiff, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type { MqttRequest } from '@openheaders/core/types';
import { seedMqttRequest } from '../projections/mqtt-request-projection';

export interface MqttRequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/** Live-itemId reader for the set paths — see {@link request-mutations}' LiveSetEntries. */
export type MqttLiveSetEntries = (mqttRequestUid: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

/** Current materialized value reader for scalar paths — the
 *  container-valued ones' flatten-diff baseline (`publishProperties`,
 *  `lastWill`, `specLink`, `auth`, `scripts`) and the explicit-clear
 *  guard for every plain knob (see {@link request-mutations}'
 *  LiveFieldValue). */
export type MqttLiveFieldValue = (mqttRequestUid: string, path: string) => unknown;

/**
 * New MQTT request → seed batch. No side effects. `placement` is the
 * parent whose `items` slot the request takes in the same batch;
 * `null` only when the parent is unresolvable at the write site.
 */
export function buildMqttAddBatch(
  request: MqttRequest,
  ctx: MutatorContext,
  placement: ChildPlacement<RequestFolderParentRef> | null,
): MqttRequestMutationPayload {
  return { batch: seedMqttRequest(request, ctx, placement ?? undefined), sideEffects: [] };
}

/**
 * Delete an MQTT request: the parent's slot tombstone + the entity
 * tombstone in one batch. Tombstone is permanent under §7.2 delete-wins.
 */
export function buildMqttDeleteBatch(
  mqttRequestUid: string,
  parent: RequestFolderParentRef,
  ctx: MutatorContext,
): MqttRequestMutationPayload {
  return deleteMqttRequest(ctx, { mqttRequestUid, parent });
}

/** Bare entity tombstone for cascades where the parent is going too. */
export function buildMqttDeleteEntityBatch(mqttRequestUid: string, ctx: MutatorContext): MqttRequestMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: MQTT_REQUEST_ENTITY_TYPE, id: mqttRequestUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

const SET_PATHS = [
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
] as const;

/** The container-valued scalar paths that ride the per-leaf
 *  flatten-diff — and whose explicit `undefined` in a patch means
 *  CLEAR (the editor collapses an all-empty block to `undefined`), not
 *  "field untouched": the diff tombstones every old leaf. */
const CONTAINER_SCALAR_PATHS: ReadonlySet<string> = new Set(['publishProperties', 'lastWill', 'specLink', 'auth']);
type SetPath = (typeof SET_PATHS)[number];

/** A record with no keys reads as no record — see the `scripts` note below. */
function emptyRecordAsAbsent(value: unknown): unknown {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
    ? undefined
    : value;
}

const isSetPath = (key: string): SetPath | null =>
  key === MQTT_REQUEST_TOPICS_PATH
    ? MQTT_REQUEST_TOPICS_PATH
    : key === MQTT_REQUEST_SAVED_MESSAGES_PATH
      ? MQTT_REQUEST_SAVED_MESSAGES_PATH
      : key === MQTT_REQUEST_USER_PROPERTIES_PATH
        ? MQTT_REQUEST_USER_PROPERTIES_PATH
        : null;

/**
 * Translate a `Partial<Omit<MqttRequest, 'uid'|'path'>>` patch into a
 * single batch. Scalar fields → one `setField` per leaf; the three set
 * paths → minimum diff via {@link synthesizeSetDiff};
 * `publishProperties` / `lastWill` / `specLink` / `auth` → per-leaf
 * flatten-diff via {@link synthesizeFieldDiff}.
 */
export function buildMqttUpdateBatch(
  mqttRequestUid: string,
  updates: Partial<Omit<MqttRequest, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: MqttLiveSetEntries,
  liveFieldValue: MqttLiveFieldValue,
): MqttRequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      // An explicitly-present key with `undefined` clears: a
      // container scalar's old leaves tombstone through the flatten
      // diff (an absent baseline diffs to nothing, so the editor's
      // always-present keys stay no-ops when untouched); a plain knob
      // tombstones its one slot, but only when the canonical pre-image
      // actually carries a value — unconditional tombstones would
      // stamp fresh HLCs on every untouched field and stomp a peer's
      // concurrent set under LWW. Set-modeled paths never clear.
      if (CONTAINER_SCALAR_PATHS.has(key)) {
        bodies.push(
          ...synthesizeFieldDiff({
            type: MQTT_REQUEST_ENTITY_TYPE,
            id: mqttRequestUid,
            basePath: key,
            oldValue: liveFieldValue(mqttRequestUid, key),
            newValue: undefined,
          }),
        );
      } else if (isSetPath(key) === null && liveFieldValue(mqttRequestUid, key) !== undefined) {
        bodies.push({ kind: 'unsetField', type: MQTT_REQUEST_ENTITY_TYPE, id: mqttRequestUid, path: key });
      }
      continue;
    }

    const setPath = isSetPath(key);
    if (setPath && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: MQTT_REQUEST_ENTITY_TYPE,
          id: mqttRequestUid,
          path: setPath,
          live: liveSetEntries(mqttRequestUid, setPath),
          newItems: value,
        }),
      );
      continue;
    }

    // Container-valued scalars (`publishProperties`, `lastWill`,
    // `specLink`, `auth`) — emit a per-leaf flatten-diff so the edit
    // shares create's representation.
    if (value !== null && typeof value === 'object') {
      // The script slot record is absent when empty (one `<kind>.js`
      // sibling per present slot, no record leaf): an empty record on
      // either side diffs as no record, so a save without scripts never
      // writes an empty leaf and an emptied slot tombstones its own.
      const record = key === 'scripts';
      bodies.push(
        ...synthesizeFieldDiff({
          type: MQTT_REQUEST_ENTITY_TYPE,
          id: mqttRequestUid,
          basePath: key,
          oldValue: record
            ? emptyRecordAsAbsent(liveFieldValue(mqttRequestUid, key))
            : liveFieldValue(mqttRequestUid, key),
          newValue: record ? emptyRecordAsAbsent(value) : value,
        }),
      );
      continue;
    }

    bodies.push({ kind: 'setField', type: MQTT_REQUEST_ENTITY_TYPE, id: mqttRequestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
