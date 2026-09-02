/**
 * Ancestor carrier walk — the one place that derives a request's
 * collection/folder chain for ancestor-composed concerns (script
 * slots, the auth pool, the collection scope).
 *
 * The chain is read off the TREE INDEX — the parent-owned slots, the
 * containment authority — through `ancestorChain`, never off the
 * request's stored path (a leaf's path is a projection that goes stale
 * after a drag; the slots do not). `workspaceId: null` reads the
 * runtime-Active oracle and mirrors (the workbench Send path); a
 * pinned id reads that workspace's — the same tri-state every store
 * read in the executor follows. A scratch draft matches no ancestors,
 * and so does a request whose workspace has no oracle on this host.
 */

import {
  type AuthCarrier,
  type AuthProtocolKind,
  assertAuthAllowed,
  effectiveAuthFor,
  hostOf,
} from '@openheaders/core/auth-inheritance';
import type { ScriptSlotCarrier } from '@openheaders/core/scripts';
import type {
  AuthConfig,
  AuthPoolEntry,
  ConcreteAuthConfig,
  ExecutedAuthAttribution,
  Request,
} from '@openheaders/core/types';
import {
  getRequestCollections,
  getRequestCollectionsForWorkspace,
  getRequestFolders,
  getRequestFoldersForWorkspace,
} from '../../entity/request-store';
import { ancestorChain } from '../../sync/post-state/folder-tree-post-state';
import { REQUEST_TREE } from '../../sync/post-state/request-folder-post-state';
import { getOracleForCurrentWorkspace, getOracleForWorkspace } from '../../sync/service/accessors';

/** The ancestor fields the composed concerns read — the script slots
 *  (`ScriptSlotCarrier`: the HTTP pair and the session record) and the
 *  auth pool. */
export interface AncestorCarrierEntity extends ScriptSlotCarrier {
  uid: string;
  path: string;
  name: string;
  auths?: AuthPoolEntry[];
  defaultAuthUid?: string;
  auth?: AuthConfig;
}

export interface AncestorCarrier {
  level: 'collection' | 'folder';
  /** Attribution label, e.g. `Collection 'Auth'`, `Folder 'Tokens'`. */
  label: string;
  entity: AncestorCarrierEntity;
}

/**
 * Collect the leaf's ancestor carriers outer→inner: the owning
 * collection first, then each folder down to the leaf's parent. Every
 * request kind — HTTP, WebSocket, gRPC, MQTT — slots under the one
 * request tree, so any leaf's `{ uid, path }` walks the same index.
 */
export function collectAncestorCarriers(
  leaf: { uid: string; path: string },
  workspaceId: string | null,
): AncestorCarrier[] {
  const oracle = workspaceId ? getOracleForWorkspace(workspaceId) : getOracleForCurrentWorkspace();
  if (oracle === null) return [];
  const chain = ancestorChain(oracle, REQUEST_TREE, leaf);
  if (chain.length === 0) return [];
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const folders = workspaceId ? getRequestFoldersForWorkspace(workspaceId) : getRequestFolders();

  const carriers: AncestorCarrier[] = [];
  for (const node of chain) {
    if (node.type === REQUEST_TREE.collectionType) {
      const collection = collections.find((c) => c.uid === node.uid);
      if (collection)
        carriers.push({ level: 'collection', label: `Collection '${collection.name}'`, entity: collection });
      continue;
    }
    const folder = folders.find((f) => f.uid === node.uid);
    if (folder) carriers.push({ level: 'folder', label: `Folder '${folder.name}'`, entity: folder });
  }
  return carriers;
}

/** The uid of the collection a leaf lives in, off its chain; `undefined` for a scratch draft. */
export function collectionUidForRequest(
  leaf: { uid: string; path: string },
  workspaceId: string | null,
): string | undefined {
  return collectAncestorCarriers(leaf, workspaceId).find((c) => c.level === 'collection')?.entity.uid;
}

function toAuthCarrier(carrier: AncestorCarrier): AuthCarrier {
  const { entity } = carrier;
  return {
    level: carrier.level,
    uid: entity.uid,
    name: entity.name,
    auths: entity.auths,
    defaultAuthUid: entity.defaultAuthUid,
    auth: entity.auth,
  };
}

export interface ResolvedRequestAuth {
  /** The config the send applies — the request's own, or the resolved pool entry. */
  auth: Exclude<AuthConfig, { type: 'inherit' }>;
  /** The snapshot attribution; `undefined` when the request's own auth is `none`. */
  attribution: ExecutedAuthAttribution | undefined;
}

/**
 * Resolve a request's auth against its ancestor chain through THE
 * rule (`@openheaders/core/auth-inheritance`): its own config wins
 * outright; `inherit` takes the nearest pool's default (a host-scoped
 * entry first) or the entry it names by uid from any level. A chain
 * with no pool degrades to `{ type: 'none' }`.
 */
export function resolveRequestAuth(request: Request, workspaceId: string | null): ResolvedRequestAuth {
  const chain = request.auth.type === 'inherit' ? collectAncestorCarriers(request, workspaceId).map(toAuthCarrier) : [];
  const effective = effectiveAuthFor(request.auth, chain, hostOf(request.url));
  if (request.auth.type !== 'inherit' && request.auth.type === 'none') {
    return { auth: effective.auth, attribution: undefined };
  }
  return {
    auth: effective.auth,
    attribution: {
      type: effective.auth.type,
      source: effective.source,
      ...(effective.danglingAuthUid !== undefined ? { danglingAuthUid: effective.danglingAuthUid } : {}),
    },
  };
}

/** A session-kind leaf as the auth resolution sees it. */
export interface SessionAuthLeaf {
  uid: string;
  path: string;
  /** The dial target, templates resolved — the host `appliesTo`-scoped
   *  pool entries match against. */
  url: string;
  auth?: AuthConfig;
}

export interface ResolvedSessionAuth {
  /** The concrete config the session applies — `none` when nothing
   *  contributes anywhere. */
  auth: ConcreteAuthConfig;
  /** The snapshot attribution; `undefined` when the request's own auth is `none`. */
  attribution: ExecutedAuthAttribution | undefined;
  /** The per-kind mask refusal naming the inherited entry; `null` when
   *  the resolved auth can ride the kind (or contributes nothing). */
  refusal: string | null;
}

/**
 * Resolve a session-kind leaf's auth against its ancestor chain
 * through THE rule, then hold it to the kind's mask
 * (`assertAuthAllowed`): a resolved type the wire cannot carry fails
 * the Connect / Invoke by NAME — never a silent none. `chain` is the
 * host-injected carriers for page realms whose oracle mirrors are
 * empty (the `resolution` twin); absent = the tree-index walk.
 */
export function resolveSessionAuth(
  kind: AuthProtocolKind,
  leaf: SessionAuthLeaf,
  workspaceId: string | null,
  chain?: readonly AuthCarrier[],
): ResolvedSessionAuth {
  const auth = leaf.auth ?? { type: 'none' };
  const carriers =
    auth.type === 'inherit' ? (chain ?? collectAncestorCarriers(leaf, workspaceId).map(toAuthCarrier)) : [];
  const effective = effectiveAuthFor(auth, carriers, hostOf(leaf.url));
  const refusal = assertAuthAllowed(kind, effective);
  if (auth.type === 'none') return { auth: effective.auth, attribution: undefined, refusal };
  return {
    auth: effective.auth,
    attribution: {
      type: effective.auth.type,
      source: effective.source,
      ...(effective.danglingAuthUid !== undefined ? { danglingAuthUid: effective.danglingAuthUid } : {}),
    },
    refusal,
  };
}
