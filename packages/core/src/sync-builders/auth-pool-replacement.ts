/**
 * Auth-pool replacement diff — persist a container's complete pool
 * (entries + default) in ONE batch.
 *
 * Entries are set members keyed by `uid`, so the diff is the same
 * LIS-optimal {@link synthesizeSetDiff} the variables replacement
 * runs: vanished uids → `removeFromSet`, new or changed → `addToSet`
 * with an orderKey, pure moves → `moveBefore`. The default rides as a
 * scalar (`setField` / `unsetField`). A container still carrying the
 * pre-pool single `auth` field gets its leaves tombstoned in the same
 * batch — the first pool write retires the legacy field, and the
 * read-side net (`authPoolOf`) stops mattering for it.
 *
 * `null` when nothing changed — the caller short-circuits.
 */

import { type MutationBatch, type MutationBody, type MutatorContext, mintBatch } from '@openheaders/core/sync';
import type { AuthConfig, AuthPoolEntry } from '@openheaders/core/types';
import { synthesizeFieldDiff } from './field-diff';
import { synthesizeSetDiff, toLiveSetEntries } from './set-diff';

export interface AuthPoolReplacementBindings {
  entityType: string;
  authsPath: string;
  defaultAuthPath: string;
}

export interface AuthPoolReplacementInput {
  entityUid: string;
  newEntries: readonly AuthPoolEntry[];
  /** The materialized entries — the diff pre-image. */
  oldEntries: readonly AuthPoolEntry[];
  newDefaultUid: string | undefined;
  oldDefaultUid: string | undefined;
  /** The pre-pool single field as materialized; its leaves tombstone when present. */
  legacyAuth: AuthConfig | undefined;
  /** Current persisted per-uid order keys off the mirror — unmoved rows stay byte-stable. */
  currentKeys?: ReadonlyMap<string, string>;
}

function normalizeEntry(entry: AuthPoolEntry): AuthPoolEntry {
  return {
    uid: entry.uid,
    name: entry.name,
    config: entry.config,
    ...(entry.appliesTo !== undefined && entry.appliesTo.trim() !== '' ? { appliesTo: entry.appliesTo.trim() } : {}),
  };
}

export function buildAuthPoolReplacement(
  bindings: AuthPoolReplacementBindings,
  ctx: MutatorContext,
  input: AuthPoolReplacementInput,
): { batch: MutationBatch } | null {
  const { entityType, authsPath, defaultAuthPath } = bindings;
  const currentKeys = input.currentKeys ?? new Map<string, string>();
  const bodies: MutationBody[] = synthesizeSetDiff({
    type: entityType,
    id: input.entityUid,
    path: authsPath,
    live: toLiveSetEntries(input.oldEntries.map(normalizeEntry), currentKeys),
    newItems: input.newEntries.map(normalizeEntry),
  });
  // A default naming no surviving entry persists absent — the first
  // entry is the default then, the same rule the reader applies.
  const survivors = new Set(input.newEntries.map((e) => e.uid));
  const newDefault =
    input.newDefaultUid !== undefined && survivors.has(input.newDefaultUid) ? input.newDefaultUid : undefined;
  if (newDefault !== input.oldDefaultUid) {
    bodies.push(
      newDefault === undefined
        ? { kind: 'unsetField', type: entityType, id: input.entityUid, path: defaultAuthPath }
        : { kind: 'setField', type: entityType, id: input.entityUid, path: defaultAuthPath, value: newDefault },
    );
  }
  if (input.legacyAuth !== undefined) {
    bodies.push(
      ...synthesizeFieldDiff({
        type: entityType,
        id: input.entityUid,
        basePath: 'auth',
        oldValue: input.legacyAuth,
        newValue: undefined,
      }),
    );
  }
  if (bodies.length === 0) return null;
  return { batch: mintBatch(ctx, bodies) };
}
