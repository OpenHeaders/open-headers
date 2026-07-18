/**
 * WebSocketRequest types for the git-based workspace format.
 *
 * A WebSocketRequest is a standalone WebSocket session request — its
 * own entity kind beside the HTTP `Request` and `GrpcRequest` (S8
 * scope law: session-shaped protocols are never a discriminant on the
 * HTTP request). On disk, each WebSocket request is a folder
 * containing:
 *   websocket.yaml — schemaVersion, uid, name, url, flavor,
 *                    subprotocols, headers, params, messageFormat,
 *                    specLink, timeoutMs
 *   message.json / message.txt — compose draft (format-matched sibling)
 *
 * The 8-char uid is embedded in `websocket.yaml` and mirrored in the
 * folder name's `<slug>-<uid>` suffix (slug is a human hint; uid is
 * the identity). Persisted shapes derive from the valibot schemas so
 * the runtime validator and the type stay locked together.
 */

import type * as v from 'valibot';
import type {
  WebSocketFlavorSchema,
  WebSocketHeaderPairSchema,
  WebSocketMessageFormatSchema,
  WebSocketQueryParamSchema,
  WebSocketRequestSchema,
  WebSocketRequestSeedSchema,
  WebSocketSpecLinkSchema,
} from '../schemas/websocket-request';

/** Wire-family discriminant — raw WebSocket vs Socket.IO. */
export type WebSocketFlavor = v.InferOutput<typeof WebSocketFlavorSchema>;

/** One handshake header row (node-host capability; honest in the extension). */
export type WebSocketHeaderPair = v.InferOutput<typeof WebSocketHeaderPairSchema>;

/** One query-param row appended to the session URL. */
export type WebSocketQueryParam = v.InferOutput<typeof WebSocketQueryParamSchema>;

/** Compose-draft display mode for the raw flavor (absent = text). */
export type WebSocketMessageFormat = v.InferOutput<typeof WebSocketMessageFormatSchema>;

/** Ids-only binding to the AsyncAPI spec feeding compose aids. */
export type WebSocketSpecLink = v.InferOutput<typeof WebSocketSpecLinkSchema>;

export type WebSocketRequest = v.InferOutput<typeof WebSocketRequestSchema>;

/**
 * Content-only shape (no `uid` / `path` / `schemaVersion`) — the
 * pre-fill handoff unit for the create tab.
 */
export type WebSocketRequestSeed = v.InferOutput<typeof WebSocketRequestSeedSchema>;
