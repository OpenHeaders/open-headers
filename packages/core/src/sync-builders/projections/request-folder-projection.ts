/**
 * Request-folder projection — `Folder ⇄ MutationBatch /
 * MaterializedEntity` for the request-folder entity type.
 *
 * Mirrors `folder-projection.ts`. Folder is its own entity but carries
 * minimal scalar state (`name` + `schemaVersion` + frozen
 * `pathSegment`, the script slots, the pool's default) plus the auth
 * pool as set members at `auths`. Sibling order + parent linkage live
 * on the parent's `folders` set under request-collection /
 * request-folder routing.
 * Path on `Folder` is reconstructed at projection time by walking
 * the parent chain — `projectRequestFolder` takes the resolved
 * `parentPath` and produces a `Folder` with the full slug path
 * legacy consumers expect.
 */

import {
  AuthConfigSchema,
  AuthPoolEntrySchema,
  ContainerSettingsObjectSchema,
  hasInheritableSettings,
  SessionScriptSlotsSchema,
} from '@openheaders/core/schemas';
import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  REQUEST_FOLDER_AUTHS_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

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
      ...(folder.scripts !== undefined ? { scripts: folder.scripts } : {}),
      // The pool's default scalar rides the seed; the entries are set
      // members below. The pre-pool `auth` field passes through as
      // data — read as a one-entry pool until the first pool write.
      ...(folder.defaultAuthUid !== undefined ? { defaultAuthUid: folder.defaultAuthUid } : {}),
      ...(folder.auth !== undefined ? { auth: folder.auth } : {}),
      // The inheritable settings ride the seed when they set anything
      // (the flattener keys one leaf per knob); an empty record never
      // seeds — see the collection projection.
      ...(hasInheritableSettings(folder.settings) ? { settings: folder.settings } : {}),
    },
  };
  const bodies: MutationBody[] = [body];
  const nextKey = orderKeyMinter();
  for (const entry of folder.auths ?? []) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: folder.uid,
      path: REQUEST_FOLDER_AUTHS_PATH,
      itemId: entry.uid,
      item: entry,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
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
  // The pool — entries carried only when each is a well-formed
  // AuthPoolEntry (a malformed member is skipped, never surfaced); the
  // pre-pool `auth` field the same way (per-leaf writes could
  // transiently compose an invalid shape; projection stays fail-soft).
  const auths = Array.isArray(data.auths)
    ? data.auths.flatMap((entry) => {
        const parsed = v.safeParse(AuthPoolEntrySchema, entry);
        return parsed.success ? [parsed.output] : [];
      })
    : [];
  const auth = v.safeParse(AuthConfigSchema, data.auth);
  // The session slot record — carried when well-formed and non-empty
  // (per-leaf writes could transiently compose an invalid shape; the
  // last slot's unset leaves an empty record behind).
  const scripts = v.safeParse(SessionScriptSlotsSchema, data.scripts);
  const scriptRecord = scripts.success && Object.keys(scripts.output).length > 0 ? scripts.output : undefined;
  // The inheritable settings — carried when well-formed per knob and
  // non-empty (the record shape without the proxy pair tie: per-leaf
  // writes compose transiently; the last knob's unset leaves an empty
  // slice or record behind).
  const settings = v.safeParse(ContainerSettingsObjectSchema, data.settings);
  const settingsRecord = settings.success && hasInheritableSettings(settings.output) ? settings.output : undefined;
  return {
    schemaVersion,
    uid: materialized.id,
    path: `${parentPath}/${segment}`,
    name,
    // Ancestor script slots — carried when set (field absent ↔ no script).
    ...(typeof data.preRequestScript === 'string' ? { preRequestScript: data.preRequestScript } : {}),
    ...(typeof data.postResponseScript === 'string' ? { postResponseScript: data.postResponseScript } : {}),
    ...(scriptRecord !== undefined ? { scripts: scriptRecord } : {}),
    ...(auths.length > 0 ? { auths } : {}),
    ...(typeof data.defaultAuthUid === 'string' ? { defaultAuthUid: data.defaultAuthUid } : {}),
    ...(auth.success ? { auth: auth.output } : {}),
    ...(settingsRecord !== undefined ? { settings: settingsRecord } : {}),
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
