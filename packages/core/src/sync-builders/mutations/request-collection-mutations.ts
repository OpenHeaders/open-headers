/**
 * Request-collection write-site → oracle helpers.
 *
 * Mirrors `collection-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the request-collection cache) and the
 * renderer (`useRequestCollectionMutator` / variable write client).
 */

import type { ContainerSettingUpdate } from '@openheaders/core/settings-inheritance';
import {
  deleteRequestCollection,
  deriveSideEffectsForEnvelope,
  type MutatorContext,
  type MutatorIntent,
  mintBatch,
  REQUEST_COLLECTION_AUTHS_PATH,
  REQUEST_COLLECTION_DEFAULT_AUTH_PATH,
  REQUEST_COLLECTION_ENTITY_TYPE,
  type RequestCollectionScriptPath,
  removeRequestCollectionVar,
  renameRequestCollection,
  setRequestCollectionPinnedAndDefault,
  setRequestCollectionScripts,
  setRequestCollectionSettings,
  setRequestCollectionSpecLink,
  setRequestCollectionVar,
} from '@openheaders/core/sync';
import { buildAuthPoolReplacement } from '@openheaders/core/sync-builders';
import type { AuthPoolEntry, Collection, SpecLink, Variable } from '@openheaders/core/types';

export type RequestCollectionMutationPayload = MutatorIntent;

/**
 * Delete a request collection: the workspace roots' slot tombstone +
 * the entity tombstone in one batch (the catalog's
 * `deleteRequestCollection`).
 *
 * Deleting a request collection drops its variables from resolver
 * scope, so the payload carries the `INVALIDATE_RESOLVER` side effect —
 * single-sourced through {@link deriveSideEffectsForEnvelope} so the
 * deleting host's own resolver cache flushes, as a peer's does on
 * receive.
 */
export function buildDeleteRequestCollectionBatch(
  collectionUid: string,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  const { batch } = deleteRequestCollection(ctx, { collectionUid });
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

export interface RenameRequestCollectionInput {
  collectionUid: string;
  name: string;
}

export function buildRenameRequestCollectionBatch(
  input: RenameRequestCollectionInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return renameRequestCollection(ctx, input);
}

export interface SetRequestCollectionPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function buildSetRequestCollectionPinnedAndDefaultBatch(
  input: SetRequestCollectionPinnedAndDefaultInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionPinnedAndDefault(ctx, input);
}

export interface SetRequestCollectionScriptsInput {
  collectionUid: string;
  /** Slot updates; `value: undefined` removes the slot. */
  updates: ReadonlyArray<{ path: RequestCollectionScriptPath; value: string | undefined }>;
}

export function buildSetRequestCollectionScriptsBatch(
  input: SetRequestCollectionScriptsInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionScripts(ctx, input);
}

export interface SetRequestCollectionSettingsInput {
  collectionUid: string;
  /** Knob updates on their kinds' slices; `value: undefined` clears the knob. */
  updates: ReadonlyArray<ContainerSettingUpdate>;
}

/** Per-knob `setField` / `unsetField` under `settings.<kind>.<key>` — the
 *  object is never written whole (the flattened create leaves and a
 *  peer's concurrent knob edit would be clobbered). */
export function buildSetRequestCollectionSettingsBatch(
  input: SetRequestCollectionSettingsInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionSettings(ctx, input);
}

export interface SetRequestCollectionSpecLinkInput {
  collectionUid: string;
  /** New generation bookkeeping; `undefined` clears the link. */
  specLink: SpecLink | undefined;
}

/**
 * Whole-object `setField('specLink', …)` is deliberate here — unlike
 * auth, the field never rides a create payload (generation links a
 * collection AFTER it exists), so there are no flattened create-time
 * leaves to clobber; both members always change together.
 */
export function buildSetRequestCollectionSpecLinkBatch(
  input: SetRequestCollectionSpecLinkInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionSpecLink(ctx, input);
}

export interface SetRequestCollectionAuthPoolInput {
  collectionUid: string;
  auths: readonly AuthPoolEntry[];
  defaultAuthUid: string | undefined;
  /** The materialized collection — the diff pre-image (entries, default, the legacy field). */
  current: Pick<Collection, 'auths' | 'defaultAuthUid' | 'auth'>;
  currentKeys?: ReadonlyMap<string, string>;
}

/**
 * Persist the collection's whole auth pool — a set diff over the
 * entries plus the default scalar, the pre-pool `auth` field's leaves
 * tombstoned alongside. An empty pool with no default = the level goes
 * transparent. A no-op edit yields an empty batch; callers
 * short-circuit on it.
 */
export function buildSetRequestCollectionAuthPoolBatch(
  input: SetRequestCollectionAuthPoolInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  const payload = buildAuthPoolReplacement(
    {
      entityType: REQUEST_COLLECTION_ENTITY_TYPE,
      authsPath: REQUEST_COLLECTION_AUTHS_PATH,
      defaultAuthPath: REQUEST_COLLECTION_DEFAULT_AUTH_PATH,
    },
    ctx,
    {
      entityUid: input.collectionUid,
      newEntries: input.auths,
      oldEntries: input.current.auths ?? [],
      newDefaultUid: input.defaultAuthUid,
      oldDefaultUid: input.current.defaultAuthUid,
      legacyAuth: input.current.auth,
      currentKeys: input.currentKeys,
    },
  );
  return { batch: payload?.batch ?? mintBatch(ctx, []), sideEffects: [] };
}

export interface SetRequestCollectionVarInput {
  requestCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  orderKey?: string;
}

export function buildSetRequestCollectionVarBatch(
  input: SetRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionVar(ctx, input);
}

export interface RemoveRequestCollectionVarInput {
  requestCollectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveRequestCollectionVarBatch(
  input: RemoveRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return removeRequestCollectionVar(ctx, input);
}
