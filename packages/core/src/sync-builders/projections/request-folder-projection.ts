/**
 * Request-folder projection — `Folder ⇄ MutationBatch /
 * MaterializedEntity` for the request-folder entity type.
 *
 * Mirrors `folder-projection.ts`. Folder is its own entity but carries
 * minimal scalar state (`name` + `schemaVersion` + frozen
 * `pathSegment`). Sibling order + parent linkage live on the parent's
 * `folders` set under request-collection / request-folder routing.
 * Path on `Folder` is reconstructed at projection time by walking
 * the parent chain — `projectRequestFolder` takes the resolved
 * `parentPath` and produces a `Folder` with the full slug path
 * legacy consumers expect.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';

function fallbackPathSegment(name: string, uid: string): string {
  return toFolderName(name, uid);
}

/**
 * Convert a persisted `Folder` (under request-folder routing) into
 * a single-mutation create batch. The parent slot insertion is the
 * caller's responsibility — same contract as the rule-folder seed.
 */
export function seedRequestFolder(folder: Folder, ctx: MutatorContext): MutationBatch {
  const pathSegment = lastSegment(folder.path) ?? fallbackPathSegment(folder.name, folder.uid);
  const body: MutationBody = {
    kind: 'create',
    type: REQUEST_FOLDER_ENTITY_TYPE,
    id: folder.uid,
    payload: {
      schemaVersion: folder.schemaVersion,
      name: folder.name,
      pathSegment,
      // Ancestor script slots ride the seed when present (field absent
      // ↔ no script).
      ...(folder.preRequestScript !== undefined ? { preRequestScript: folder.preRequestScript } : {}),
      ...(folder.postResponseScript !== undefined ? { postResponseScript: folder.postResponseScript } : {}),
    },
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
 * Convert a `MaterializedEntity` (the oracle's per-request-folder
 * snapshot) back into a `Folder`. `parentPath` is the absolute path
 * of the parent (request collection or parent request folder) — the
 * cache's projection layer resolves it via parent-walk before calling
 * here. Returns `null` when the materialized data fails basic shape
 * checks.
 */
export function projectRequestFolder(materialized: MaterializedEntity, parentPath: string): Folder | null {
  if (materialized.type !== REQUEST_FOLDER_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  const name = typeof data.name === 'string' ? data.name : '';
  const schemaVersion = typeof data.schemaVersion === 'number' ? (data.schemaVersion as 5) : 5;
  const segment =
    typeof data.pathSegment === 'string' && data.pathSegment.length > 0
      ? data.pathSegment
      : fallbackPathSegment(name, materialized.id);
  return {
    schemaVersion,
    uid: materialized.id,
    path: `${parentPath}/${segment}`,
    name,
    // Ancestor script slots — carried when set (field absent ↔ no script).
    ...(typeof data.preRequestScript === 'string' ? { preRequestScript: data.preRequestScript } : {}),
    ...(typeof data.postResponseScript === 'string' ? { postResponseScript: data.postResponseScript } : {}),
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
