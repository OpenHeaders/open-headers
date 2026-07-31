/**
 * API-request bridge RPCs — request CRUD, the collection / folder
 * management that organizes them, and request execution. All scoped to
 * the active workspace.
 */

import type { WireSnippetRequest } from '../../snippet';
import type {
  Collection,
  CollectionTree,
  ExecutedGrpcSnapshot,
  ExecutedProxyRoute,
  ExecutedRequestSnapshot,
  ExecutedWsSnapshot,
  GrpcRequest,
  Request,
  RequestSeed,
  WebSocketRequest,
} from '../../types';
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

/**
 * One live message of an in-flight gRPC stream, direction-tagged: the
 * message timeline's row unit. `atMs` is the executing host's arrival
 * (↓) / write (↑) wall-clock — SESSION-ONLY display data riding the
 * wire event, never persisted (the SSE timestamps law).
 */
export interface GrpcStreamMessageWire {
  direction: 'up' | 'down';
  /** The message payload, encoded and UNFRAMED, base64. */
  dataBase64: string;
  /** The frame's compression flag as received (↓); always false for ↑
   *  (v1 never compresses). Flag honesty — never a rewrite. */
  compressed: boolean;
  /** Epoch ms on the executing host. */
  atMs: number;
}

/**
 * One live frame of an in-flight gRPC streaming call — the
 * `grpcStreamEvent` broadcast's payload, a SIBLING of
 * `RequestStreamEventWire` (per-message, direction-tagged semantics
 * the HTTP chunk shape cannot carry; the HTTP contract stays
 * untouched). Same discipline: display-only hints superseded by the
 * resolving `executeGrpcRequest` snapshot, `seq` per-send monotonic,
 * message frames flush-batched by the executing host.
 */
export type GrpcStreamEventWire =
  | {
      sendId: string;
      seq: number;
      kind: 'head';
      httpStatus: number;
      headers: Array<{ key: string; value: string }>;
      /** How many messages preceded the head in CALL order, stamped by
       *  the executor — the timeline's interleave position. Message
       *  batching means the head event can outrun pooled ↑ frames on
       *  the wire; this count is the order truth. */
      afterMessages: number;
      /** The call's effective proxy route as the transport decided it —
       *  attribution from the record's live twin, so the streaming meta
       *  strip is honest BEFORE the snapshot settles. Absent = direct. */
      proxyRoute?: ExecutedProxyRoute;
    }
  | { sendId: string; seq: number; kind: 'messages'; items: GrpcStreamMessageWire[] }
  | { sendId: string; seq: number; kind: 'end' };

/**
 * One live message of an open WebSocket session, direction-tagged: the
 * message timeline's row unit. Payload base64 whether the frame was
 * text or binary (`binary` records the wire frame type — a text view
 * is a decode, never a guess). `atMs` is the executing host's arrival
 * (↓) / write (↑) wall-clock — SESSION-ONLY display data riding the
 * wire event, never persisted (the SSE timestamps law).
 */
export interface WsStreamMessageWire {
  direction: 'up' | 'down';
  dataBase64: string;
  binary: boolean;
  /** Epoch ms on the executing host. */
  atMs: number;
}

/**
 * One live frame of an open WebSocket session — the `wsStreamEvent`
 * broadcast's payload, the `grpcStreamEvent` sibling for the
 * WebSocketRequest executor plane (own channel; neither the HTTP nor
 * the gRPC contract changes). Same discipline: display-only hints
 * superseded by the resolving `executeWebSocketRequest` snapshot,
 * `seq` per-send monotonic, message frames flush-batched by the
 * executing host; `open` and `end` emit immediately (single and
 * load-bearing). Unlike gRPC there is no interleave count on `open` —
 * a WebSocket client cannot write before the handshake settles, so no
 * message can precede it in call order.
 */
/**
 * Socket.IO rider addendum on `sendWsMessage` — present only for a
 * socketio-flavor session. `eventName` is the compose editor's event
 * (templates resolved per send); `expectAck` opts this send into ack
 * correlation (the executor mints the id).
 */
export interface WsSendSocketIoWire {
  eventName: string;
  expectAck: boolean;
}

export type WsStreamEventWire =
  | {
      sendId: string;
      seq: number;
      kind: 'open';
      /** The subprotocol the server selected; empty when none. */
      protocol: string;
      /** Negotiated extensions; empty when none. */
      extensions: string;
      /** The session's effective proxy route as the transport decided
       *  it — attribution from the record's live twin, so the session
       *  strip is honest WHILE the session is open. Absent = direct. */
      proxyRoute?: ExecutedProxyRoute;
    }
  | { sendId: string; seq: number; kind: 'messages'; items: WsStreamMessageWire[] }
  | { sendId: string; seq: number; kind: 'end' };

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
   * Resolve a persisted request or draft to its concrete wire shape —
   * every `{{ref}}` substituted, auth folded into headers/query,
   * structured params folded into the URL — WITHOUT dispatching it.
   * Powers the workbench "Copy as cURL / fetch" actions; callers render
   * the shape with the pure formatters in `@openheaders/core/snippet`.
   * `requestUid` / `draft` / `workspaceId` / `environmentId` carry
   * `executeRequest` semantics verbatim. The resolved shape contains
   * live secret values (the point of a runnable copy) — surfaces treat
   * it as clipboard-bound output and never persist it.
   */
  resolveRequestWire: {
    req: {
      requestUid?: string;
      draft?: Request;
      environmentId?: string | null;
      workspaceId?: string;
    };
    res: { success: boolean; wire?: WireSnippetRequest; error?: string };
  };
  /**
   * Invoke a gRPC request — the GrpcRequest entity's executor plane,
   * a sibling of `executeRequest` keyed off the entity kind (session-
   * shaped protocols never ride the HTTP channel). Every call shape;
   * EXECUTED by hosts with a node HTTP/2 stack (the desktop main
   * process, the daemon). Browser hosts FORWARD the channel to a
   * connected companion over the backend wire (the extension SW's
   * grpc handlers; the editor's Invoke gates off the
   * `grpcCompanionInvoke` capability + live connection state), and
   * the web tab forwards it to its serving daemon like
   * `executeRequest`. `grpcRequestUid` takes precedence over `draft`;
   * the `workspaceId` / `environmentId` semantics are
   * `executeRequest`'s verbatim. `sendId` registers the exchange with
   * the SAME active-send registry, so `abortRequestSend` cancels a
   * gRPC invoke too; streaming shapes push live `grpcStreamEvent`
   * frames tagged with it (unary emits none — the resolving snapshot
   * carries the whole reply).
   */
  executeGrpcRequest: {
    req: {
      grpcRequestUid?: string;
      draft?: GrpcRequest;
      environmentId?: string | null;
      workspaceId?: string;
      sendId?: string;
    };
    res: { success: boolean; snapshot?: ExecutedGrpcSnapshot; error?: string };
  };
  /**
   * Write one upstream message into an in-flight gRPC client/bidi
   * stream, keyed by the invoke's `sendId`. `messageText` is the
   * compose editor's JSON — the EXECUTOR encodes it against the call's
   * input type, so an encode mismatch fails this RPC alone and never
   * kills the stream. `success: false` names the reason: no such
   * stream (settled, unknown id, host without the streaming twin) or
   * the encode error.
   */
  sendGrpcStreamMessage: {
    req: { sendId: string; messageText: string };
    res: { success: boolean; error?: string };
  };
  /**
   * Half-close the client side of an in-flight gRPC client/bidi stream
   * — "End Streaming". The server's replies (and trailers) keep
   * arriving; the resolving `executeGrpcRequest` RPC settles when the
   * call completes. `success: false` = no such stream.
   */
  endGrpcClientStream: {
    req: { sendId: string };
    res: { success: boolean };
  };
  /**
   * Open a WebSocket session for a WebSocketRequest — the entity's
   * executor plane, a sibling of `executeGrpcRequest` keyed off the
   * entity kind. EXECUTED by hosts with a node network stack (the
   * desktop main process, the daemon) AND by the extension workbench
   * IN its page realm over the platform-native socket (the
   * `wsPageSession` capability — the page host answers this channel
   * and both riders locally, node-only knobs surfaced honestly);
   * browser surfaces without that capability keep the honest disabled
   * posture.
   * `webSocketRequestUid` takes precedence over `draft`; the
   * `workspaceId` / `environmentId` semantics are `executeRequest`'s
   * verbatim. `sendId` is REQUIRED: it keys the open session for the
   * `sendWsMessage` / `closeWsSession` riders, registers with the
   * SAME active-send registry (`abortRequestSend` = Stop-abort,
   * materializes what arrived), and tags the live `wsStreamEvent`
   * frames. The RPC resolves when the session SETTLES (server close,
   * Disconnect, Stop, or pre-open failure) — the streaming-invoke
   * posture — with the whole-session snapshot.
   */
  executeWebSocketRequest: {
    req: {
      webSocketRequestUid?: string;
      draft?: WebSocketRequest;
      environmentId?: string | null;
      workspaceId?: string;
      sendId: string;
    };
    res: { success: boolean; snapshot?: ExecutedWsSnapshot; error?: string };
  };
  /**
   * Write one message into an open WebSocket session, keyed by the
   * connect's `sendId`. `messageText` is the compose editor's text —
   * the EXECUTOR resolves {{variables}} through the resolver it built
   * at Connect (same scope), so an unresolved reference fails this RPC
   * alone and never closes the session. On a socketio-flavor session
   * the editor passes `socketio`: `messageText` is then the JSON
   * arguments ARRAY and the executor frames the EVENT packet
   * (`eventName` resolved per send; `expectAck` mints the ack id) — a
   * frame that does not compose fails this RPC alone too. `success:
   * false` names the reason: no such session (settled, unknown id),
   * the resolve error, or the compose error.
   */
  sendWsMessage: {
    req: { sendId: string; messageText: string; socketio?: WsSendSocketIoWire };
    res: { success: boolean; error?: string };
  };
  /**
   * Disconnect an open WebSocket session — the clean close (code
   * 1000). The resolving `executeWebSocketRequest` RPC settles with
   * the snapshot once the close handshake completes. `success: false`
   * = no such session.
   */
  closeWsSession: {
    req: { sendId: string };
    res: { success: boolean };
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
