/**
 * API-request bridge RPCs — request CRUD, the collection / folder
 * management that organizes them, and request execution. All scoped to
 * the active workspace.
 */

import type { Collection, CollectionTree, ExecutedRequestSnapshot, Request, RequestSeed } from '../../types';
import type { FolderDescriptor } from './common';

export interface RequestRpc {
  getLocalRequests: {
    req: Record<string, never>;
    res: { requests: Request[] };
  };
  getLocalRequest: {
    req: { requestUid: string };
    res: { success: boolean; request?: Request };
  };
  getLocalRequestCollections: {
    req: Record<string, never>;
    res: { collections: Collection[] };
  };
  getLocalRequestCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: CollectionTree[] };
  };
  getLocalRequestFolders: {
    req: Record<string, never>;
    res: { folders: FolderDescriptor[] };
  };
  createLocalRequest: {
    req: {
      name: string;
      collectionUid?: string;
      parentPath?: string;
      seed?: Partial<Request>;
    };
    res: { success: boolean; request?: Request };
  };
  updateLocalRequest: {
    req: {
      requestUid: string;
      updates: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
    };
    res:
      | { ok: true; request: Request }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteLocalRequest: {
    req: { requestUid: string };
    res: { success: boolean };
  };
  /**
   * Stash / consume a scratch-request pre-fill handed from the devpanel
   * to the workbench (single-consume nonce, same flow as
   * `createRuleDraft` / `takeRuleDraft`).
   */
  createRequestDraft: {
    req: { seed: RequestSeed };
    res: { success: boolean; nonce?: string; error?: string };
  };
  takeRequestDraft: {
    req: { nonce: string };
    res: { success: boolean; seed: RequestSeed | null };
  };
  createLocalRequestCollection: {
    req: { name: string };
    res: { success: boolean; collection?: Collection };
  };
  renameLocalRequestCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalRequestCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };
  createLocalRequestFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameLocalRequestFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalRequestFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };
  /**
   * Execute a persisted request or a draft. `requestUid` takes
   * precedence when both are provided; `draft` is for unsaved editor
   * state that the user wants to Send without persisting first.
   */
  executeRequest: {
    req: {
      requestUid?: string;
      draft?: Request;
      environmentId?: string;
    };
    res: { success: boolean; snapshot?: ExecutedRequestSnapshot; error?: string };
  };
}
