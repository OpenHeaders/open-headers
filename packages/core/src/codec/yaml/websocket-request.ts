/**
 * WebSocketRequest codec — multi-file assembly.
 *
 * On disk, a WebSocket request is a folder containing:
 *
 *   websocket.yaml           # manifest — identity, target, flavor, rows, spec binding
 *   message.json / message.txt  # compose draft (only when non-empty)
 *
 * The codec's job is translation between the runtime
 * `WebSocketRequest` object and the on-disk fan-out; the caller
 * handles filesystem I/O. Parse input: the caller lists every sibling
 * it found on disk; the codec splices the message sibling into the
 * runtime shape. Serialize output: one websocket.yaml string + the
 * message sibling when present — named `message.json` when the compose
 * format is JSON (reviewers get native highlighting), `message.txt`
 * otherwise.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { WebSocketRequestSchema } from '../../schemas/websocket-request';
import type { WebSocketHeaderPair, WebSocketQueryParam, WebSocketRequest } from '../../types/websocket-request';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { WEBSOCKET_REQUEST_FIELD_ORDER } from './ordering';

const MESSAGE_JSON_FILE_NAME = 'message.json';
const MESSAGE_TEXT_FILE_NAME = 'message.txt';

// ── Parse ─────────────────────────────────────────────────────────

export interface WebSocketRequestSiblingFile {
  /** Filename relative to the request folder, e.g. "message.json". */
  fileName: string;
  content: string;
}

export interface WebSocketRequestCodecContext {
  /** Workspace-relative WebSocket request folder path. */
  path: string;
  /** Every sibling file the caller found next to `websocket.yaml`. The
   *  codec recognizes the message sibling (either name) and ignores the
   *  rest (forward-compat). */
  siblings?: readonly WebSocketRequestSiblingFile[];
}

export function parseWebSocketRequest(
  yaml: string,
  context: WebSocketRequestCodecContext,
): ParsedDocument<WebSocketRequest> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  let message = '';
  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName === MESSAGE_JSON_FILE_NAME || sibling.fileName === MESSAGE_TEXT_FILE_NAME) {
      message = sibling.content;
      break;
    }
  }

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    message,
  };

  const value = v.parse(WebSocketRequestSchema, merged);
  return makeParsed(value, doc);
}

// ── Serialize ─────────────────────────────────────────────────────

export interface WebSocketRequestSerializeOutput {
  /** `websocket.yaml` contents. */
  websocketYaml: string;
  /** Message sibling when the request carries a composed draft; null otherwise. */
  messageFile: WebSocketRequestSiblingFile | null;
}

export function serializeWebSocketRequest(write: WriteableDocument<WebSocketRequest>): WebSocketRequestSerializeOutput {
  // The manifest carries everything except the message text, which
  // fans out into its own sibling so reviewers read the draft with
  // format-native highlighting and the manifest stays scannable.
  const value = canonicalizeWebSocketRequest(write.value);
  const manifestView = {
    ...value,
    message: undefined,
  } as unknown as WebSocketRequest;

  const doc = write.raw
    ? (write.raw as YAML.Document)
    : buildFreshDocument(manifestView, WEBSOCKET_REQUEST_FIELD_ORDER);
  mergeKnownFields(doc, manifestView, WEBSOCKET_REQUEST_FIELD_ORDER);
  const websocketYaml = doc.toString(CANONICAL_STRINGIFY_OPTIONS);

  // The socketio flavor composes a JSON arguments array by
  // construction, so its sibling is always the .json name.
  const messageFileName =
    value.messageFormat === 'json' || value.flavor === 'socketio' ? MESSAGE_JSON_FILE_NAME : MESSAGE_TEXT_FILE_NAME;
  const messageFile: WebSocketRequestSiblingFile | null =
    value.message !== '' ? { fileName: messageFileName, content: value.message } : null;

  return { websocketYaml, messageFile };
}

/**
 * Normalize header + param row key order so two clients building the
 * same request via different paths emit byte-identical YAML — same
 * architectural shape as `canonicalizeRequest` (design §23.3).
 */
export function canonicalizeWebSocketRequest(request: WebSocketRequest): WebSocketRequest {
  return {
    ...request,
    headers: request.headers.map(canonicalHeaderPair),
    params: request.params.map(canonicalQueryParam),
  };
}

function canonicalHeaderPair(p: WebSocketHeaderPair): WebSocketHeaderPair {
  const out: WebSocketHeaderPair = { uid: p.uid, key: p.key, value: p.value };
  if (p.description !== undefined) out.description = p.description;
  if (p.enabled !== undefined) out.enabled = p.enabled;
  return out;
}

function canonicalQueryParam(p: WebSocketQueryParam): WebSocketQueryParam {
  const out: WebSocketQueryParam = { uid: p.uid, key: p.key, value: p.value };
  if (p.description !== undefined) out.description = p.description;
  if (p.enabled !== undefined) out.enabled = p.enabled;
  if (p.hasEquals !== undefined) out.hasEquals = p.hasEquals;
  return out;
}
