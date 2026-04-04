/**
 * Collection types for v5.
 *
 * Collections organize Requests into a folder hierarchy.
 * They also hold collection-scoped variables and inherited auth.
 *
 * On disk, the folder structure IS the collection tree:
 *   collections/payments-api/
 *     collection.json
 *     authentication/
 *       login.request.json
 *       otp.request.json
 *     cards/
 *       list-cards.request.json
 */

import type { AuthConfig, HttpMethod, Request } from './request';
import type { Variable } from './variable';

// ── Collection ─────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  description?: string;
  /** Default auth inherited by all requests unless overridden. */
  auth?: AuthConfig;
  /** Collection-scoped variables (synced via Git, non-secret only). */
  variables: Variable[];
  /** Pre-request script run before every request in collection (Phase 2). */
  preRequestScript?: string;
  /** Test script run after every response in collection (Phase 2). */
  testScript?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Collection tree (in-memory) ────────────────────────────────────

/**
 * Lightweight folder node for the sidebar tree.
 * Full Request data is loaded on demand when opened in a tab.
 */
export interface CollectionFolder {
  type: 'folder';
  id: string;
  name: string;
  children: CollectionNode[];
}

/**
 * Lightweight request reference for the sidebar tree.
 * Contains just enough info to render the sidebar item.
 */
export interface CollectionRequestRef {
  type: 'request';
  id: string;
  name: string;
  method: HttpMethod;
}

export type CollectionNode = CollectionFolder | CollectionRequestRef;

/**
 * Full collection with its tree structure, as held in memory.
 * The tree is built by scanning the disk directory structure.
 */
export interface CollectionWithTree extends Collection {
  tree: CollectionNode[];
}

/**
 * Collection with all requests loaded (used during migration/export).
 */
export interface CollectionFull extends Collection {
  tree: CollectionNode[];
  requests: Request[];
}
