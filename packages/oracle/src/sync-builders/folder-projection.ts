/**
 * Folder projection — `Folder ⇄ MutationBatch / MaterializedEntity`.
 *
 * Folder is its own entity but carries minimal scalar state on the
 * entity itself (`name` + `schemaVersion`). Sibling order + parent
 * linkage live on the parent's `folders` set (§23.5). Path on
 * `Folder` is reconstructed at projection time by walking the
 * parent chain — this module's `projectFolder` takes the resolved
 * `parentPath` and produces a `Folder` with the full slug path
 * legacy consumers expect.
 *
 * `seedFolder` does NOT touch the parent slot — boot-time seeding emits
 * the parent's `addToSet` separately so the cross-entity batch shape
 * (folder entity + parent slot) stays explicit at the call site. For
 * gesture-driven creates, the catalog factory `createFolder` mints the
 * full atomic batch including the parent slot.
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';
import { FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';

/**
 * Default path-segment derivation. Mirrors the legacy invariant — slug
 * from the initial name. Renames never alter the persisted segment;
 * the projection reads `data.pathSegment` first, falling back to this
 * derivation only for legacy folder records that never carried it.
 */
function fallbackPathSegment(name: string, uid: string): string {
  return toFolderName(name, uid);
}

/**
 * Convert a persisted `Folder` into a single-mutation batch that
 * creates the folder entity with its scalar shell. Parent slot
 * insertion is the caller's responsibility — it owns the parent's
 * `addToSet` envelope for the same boot-time batch.
 */
export function seedFolder(folder: Folder, ctx: MutatorContext): MutationBatch {
  // Recover the persisted path segment from the legacy `path` (last
  // `/`-component); fall back to the slug derivation when absent.
  const pathSegment = lastSegment(folder.path) ?? fallbackPathSegment(folder.name, folder.uid);
  const body: MutationBody = {
    kind: 'create',
    type: FOLDER_ENTITY_TYPE,
    id: folder.uid,
    payload: { schemaVersion: folder.schemaVersion, name: folder.name, pathSegment },
  };
  return mintBatch(ctx, [body]);
}

function lastSegment(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx < 0) return path || null;
  const tail = path.slice(idx + 1);
  return tail.length > 0 ? tail : null;
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-folder snapshot)
 * back into a `Folder`. `parentPath` is the absolute path of the
 * parent (collection or parent folder) — the cache's projection layer
 * resolves it via parent-walk before calling here. Returns `null` when
 * the materialized data fails basic shape checks.
 */
export function projectFolder(
  materialized: MaterializedEntity,
  parentPath: string,
): Folder | null {
  if (materialized.type !== FOLDER_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  const name = typeof data.name === 'string' ? data.name : '';
  const schemaVersion =
    typeof data.schemaVersion === 'number' ? (data.schemaVersion as 5) : 5;
  const segment =
    typeof data.pathSegment === 'string' && data.pathSegment.length > 0
      ? data.pathSegment
      : fallbackPathSegment(name, materialized.id);
  return {
    schemaVersion,
    uid: materialized.id,
    path: `${parentPath}/${segment}`,
    name,
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
