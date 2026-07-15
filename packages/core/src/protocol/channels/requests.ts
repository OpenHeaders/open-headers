/**
 * API-request bridge RPCs — request CRUD, the collection / folder
 * management that organizes them, and request execution. All scoped to
 * the active workspace.
 */

import type { Collection, CollectionTree, ExecutedRequestSnapshot, Request, RequestSeed } from '../../types';
import type { FolderDescriptor } from './common';

/**
 * One cookie in a node runtime's per-workspace cookie jar, as the jar
 * inspection surface may see it. Deliberately value-free: cookie VALUES
 * are session credentials and never leave the transport — the summary
 * carries only the matching metadata a user needs to recognize an entry.
 */
export interface CookieJarEntryWire {
  name: string;
  /** Lowercase match domain, no leading dot. */
  domain: string;
  /** True when the cookie had no Domain attribute — exact-host match only. */
  hostOnly: boolean;
  path: string;
  /** Attached over https: only. */
  secure: boolean;
  /** Epoch ms; absent = session cookie (lives as long as the jar). */
  expiresAt?: number;
}

/**
 * Response head of an in-flight interactive send, pushed on the
 * `requestStreamEvent` broadcast as soon as the executing host sees it —
 * status and headers render before the body finishes (or ever ends).
 */
export interface RequestStreamHeadWire {
  status: number;
  statusText: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * One live frame of an in-flight interactive send. Display-only hints:
 * the resolving `executeRequest` RPC's snapshot is the source of truth
 * and supersedes every frame, so a dropped frame is harmless. `seq` is
 * per-send monotonic so consumers can drop stale/duplicate deliveries.
 * Chunk frames are flush-batched by the executing host (time/byte
 * window), never per network chunk.
 */
export type RequestStreamEventWire =
  | { sendId: string; seq: number; kind: 'head'; head: RequestStreamHeadWire }
  | {
      sendId: string;
      seq: number;
      kind: 'chunk';
      /** Batched body bytes, base64 (JSON-safe on every bridge transport). */
      chunkBase64: string;
      /** Total body bytes read so far — drives the live byte counter. */
      totalBytes: number;
    }
  | { sendId: string; seq: number; kind: 'done' };

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
   *
   * `workspaceId` names the workspace the caller's editor is on — a
   * forwarding surface (the web tab) stamps it because the answering
   * host's runtime-Active workspace may differ from the caller's. Node
   * hosts resolve against it (pinned when it isn't their active
   * workspace); omitted = the answering host's active workspace, the
   * in-process Send path.
   *
   * `environmentId` is tri-state: a string pins that environment;
   * explicit `null` is the caller's selectable "No environment" state —
   * the run resolves with no environment even when the answering host's
   * own pointer names one; omitted = defer to the answering host's
   * active-environment pointer (the in-process Send path, where caller
   * and host share the pointer).
   */
  executeRequest: {
    req: {
      requestUid?: string;
      draft?: Request;
      environmentId?: string | null;
      workspaceId?: string;
      /**
       * Caller-minted id for this send. When present, the executing
       * host pushes live `requestStreamEvent` frames tagged with it
       * while the response body streams in, and `abortRequestSend`
       * can stop the exchange. Hosts without the streaming leg ignore
       * it — the RPC contract is unchanged either way.
       */
      sendId?: string;
    };
    res: { success: boolean; snapshot?: ExecutedRequestSnapshot; error?: string };
  };
  /**
   * Stop an in-flight interactive send by its caller-minted `sendId`.
   * The executing host aborts the exchange; the original
   * `executeRequest` RPC still resolves — with a snapshot materialized
   * from whatever arrived when a response head was already in
   * (`streamedCapture.endedBy: 'stop'`), or an error snapshot when
   * nothing had arrived yet. `success: false` = no such send (already
   * settled, or a host without the streaming leg).
   */
  abortRequestSend: {
    req: { sendId: string };
    res: { success: boolean };
  };
  /**
   * Inspect a workspace's in-memory cookie jar on a node runtime.
   * `workspaceId` omitted = the host's active workspace (the same pin
   * an unpinned send's jar key resolves from). Hosts without a jar
   * (browser runtimes, surfaces whose node runtime is remote) leave
   * the channel unhandled and the UI hides the affordance on rejection.
   */
  getCookieJarSummary: {
    req: { workspaceId?: string };
    res: { cookies: CookieJarEntryWire[] };
  };
  /** Empty a workspace's in-memory cookie jar. Same scoping as
   *  `getCookieJarSummary`; clearing an absent jar is a quiet no-op. */
  clearCookieJar: {
    req: { workspaceId?: string };
    res: { success: boolean };
  };
  /** Drop one jar entry by its replacement identity (name, domain,
   *  path). Same scoping as `getCookieJarSummary`; a missing entry or
   *  an absent jar is a quiet no-op. */
  deleteCookieJarEntry: {
    req: { workspaceId?: string; name: string; domain: string; path: string };
    res: { success: boolean };
  };
}
