/**
 * Spec projection — `Spec ⇄ MutationBatch / MaterializedEntity`.
 *
 * Mirrors `env-projection.ts`. The oracle stores source files as set
 * members at `files` (set member identity = `file.uid`, see
 * `mutators/spec/types.ts`); persisted `Spec.files` is a plain array.
 * `seedSpec` therefore strips the `files` array off the create payload
 * and emits one `addToSet` per file (itemId = uid); `projectSpec` is
 * the inverse.
 *
 * File identity is stable across cold wakes because the itemId is the
 * persisted `uid` — survives renames intact (the user-mutable
 * `fileName` is just another field on the LWW item body).
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  SPEC_ENTITY_TYPE,
  SPEC_FILES_PATH,
} from '@openheaders/core/sync';
import type { Spec } from '@openheaders/core/types';

/**
 * Convert a persisted `Spec` into a `MutationBatch` of one `create`
 * for the scalar shell (uid, name, path, format, rootFileUid,
 * schemaVersion) plus one `addToSet` per file. All-or-nothing under
 * the oracle's per-entity lock.
 */
export function seedSpec(spec: Spec, ctx: MutatorContext): MutationBatch {
  const shell = stripFiles(spec);

  const bodies: MutationBody[] = [{ kind: 'create', type: SPEC_ENTITY_TYPE, id: spec.uid, payload: shell }];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break at
  // materialize time.
  const nextKey = orderKeyMinter();
  for (const file of spec.files) {
    bodies.push({
      kind: 'addToSet',
      type: SPEC_ENTITY_TYPE,
      id: spec.uid,
      path: SPEC_FILES_PATH,
      itemId: file.uid,
      item: file,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-spec snapshot) back
 * into a `Spec`. Returns `null` when the materialized data fails basic
 * shape checks.
 */
export function projectSpec(materialized: MaterializedEntity): Spec | null {
  if (materialized.type !== SPEC_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries `files: SpecFile[]` thanks to the
  // oracle emitting set members under the same path. The cast is honest
  // because seedSpec committed to that shape on the way in and
  // per-(setPath, itemId) LWW preserves it.
  return data as Spec;
}

// ── internals ─────────────────────────────────────────────────────

function stripFiles(spec: Spec): unknown {
  const shell = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  delete shell.files;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
