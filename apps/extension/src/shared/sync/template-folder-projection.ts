/**
 * Template-folder projection — `V5.Folder ⇄ MutationBatch /
 * MaterializedEntity` for the template-folder entity type.
 *
 * Mirrors `request-folder-projection.ts`. Folder is its own entity but
 * carries minimal scalar state (`name` + `schemaVersion` + frozen
 * `pathSegment`). Sibling order + parent linkage live on the parent's
 * `folders` set under template-collection / template-folder routing.
 * Path on `V5.Folder` is reconstructed at projection time by walking
 * the parent chain — `projectTemplateFolder` takes the resolved
 * `parentPath` and produces a `V5.Folder` with the full slug path
 * legacy consumers expect.
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  TEMPLATE_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';

function fallbackPathSegment(name: string, uid: string): string {
  return toFolderName(name, uid);
}

/**
 * Convert a persisted `V5.Folder` (under template-folder routing) into
 * a single-mutation create batch. The parent slot insertion is the
 * caller's responsibility — same contract as the rule-folder seed.
 */
export function seedTemplateFolder(folder: V5.Folder, ctx: MutatorContext): MutationBatch {
  const pathSegment = lastSegment(folder.path) ?? fallbackPathSegment(folder.name, folder.uid);
  const body: MutationBody = {
    kind: 'create',
    type: TEMPLATE_FOLDER_ENTITY_TYPE,
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
 * Convert a `MaterializedEntity` (the oracle's per-template-folder
 * snapshot) back into a `V5.Folder`. `parentPath` is the absolute path
 * of the parent (template collection or parent template folder) — the
 * cache's projection layer resolves it via parent-walk before calling
 * here. Returns `null` when the materialized data fails basic shape
 * checks.
 */
export function projectTemplateFolder(
  materialized: MaterializedEntity,
  parentPath: string,
): V5.Folder | null {
  if (materialized.type !== TEMPLATE_FOLDER_ENTITY_TYPE) return null;
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
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
