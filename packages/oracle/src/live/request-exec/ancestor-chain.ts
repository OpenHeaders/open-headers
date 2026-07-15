/**
 * Ancestor carrier walk — the one place that derives a request's
 * collection/folder chain for ancestor-composed concerns (script
 * slots, default auth).
 *
 * Derivation is path-based — the same prefix mechanism
 * `collectionIdForRequest` uses: the collection whose `path` prefixes
 * `request.path`, then every folder along the segments outer→inner.
 * `workspaceId: null` reads the runtime-Active mirrors (the workbench
 * Send path); a pinned id reads that workspace's caches — the same
 * tri-state every store read in the executor follows. A scratch draft
 * matches no ancestors.
 */

import type { AuthConfig, Request } from '@openheaders/core/types';
import {
  getRequestCollections,
  getRequestCollectionsForWorkspace,
  getRequestFolders,
  getRequestFoldersForWorkspace,
} from '../../entity/request-store';

/** The ancestor fields the composed concerns read. */
export interface AncestorCarrierEntity {
  path: string;
  name: string;
  preRequestScript?: string;
  postResponseScript?: string;
  auth?: AuthConfig;
}

export interface AncestorCarrier {
  /** Attribution label, e.g. `Collection 'Auth'`, `Folder 'Tokens'`. */
  label: string;
  entity: AncestorCarrierEntity;
}

/**
 * Collect the request's ancestor carriers outer→inner: the owning
 * collection first, then each folder on the path sorted by depth.
 */
export function collectAncestorCarriers(request: Request, workspaceId: string | null): AncestorCarrier[] {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const folders = workspaceId ? getRequestFoldersForWorkspace(workspaceId) : getRequestFolders();

  const carriers: AncestorCarrier[] = [];
  const collection = collections.find((c) => request.path.startsWith(`${c.path}/`));
  if (collection) carriers.push({ label: `Collection '${collection.name}'`, entity: collection });

  const chainFolders = folders
    .filter((f) => request.path.startsWith(`${f.path}/`))
    .sort((a, b) => a.path.length - b.path.length);
  for (const folder of chainFolders) {
    carriers.push({ label: `Folder '${folder.name}'`, entity: folder });
  }
  return carriers;
}

/**
 * Resolve a request's `inherit` auth against its ancestor chain: the
 * INNERMOST carrier whose `auth` is present and not itself `inherit`
 * wins (folder beats collection); `none` is a real carrier ("no
 * auth"), shadowing outer levels; a carrier with no `auth` field is
 * transparent. A chain with no carrier degrades to `{ type: 'none' }`
 * — exactly the pre-D2 behavior for `inherit` requests.
 *
 * Callers gate on `request.auth.type === 'inherit'` themselves —
 * explicit request auth always wins outright and never reaches this
 * walk.
 */
export function resolveInheritedAuth(request: Request, workspaceId: string | null): AuthConfig {
  const carriers = collectAncestorCarriers(request, workspaceId);
  for (let i = carriers.length - 1; i >= 0; i--) {
    const auth = carriers[i].entity.auth;
    if (auth !== undefined && auth.type !== 'inherit') return auth;
  }
  return { type: 'none' };
}
