/**
 * GrpcRequest codec — multi-file assembly.
 *
 * On disk, a gRPC request is a folder containing:
 *
 *   grpc.yaml      # manifest — identity, target, method, metadata, spec binding
 *   message.json   # request message as canonical protobuf JSON (only when non-empty)
 *
 * The codec's job is translation between the runtime `GrpcRequest`
 * object and the on-disk fan-out; the caller handles filesystem I/O.
 * Parse input: the caller lists every sibling it found on disk. The
 * codec splices `message.json` into the runtime shape. Serialize
 * output: one grpc.yaml string + the message sibling when present.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { GrpcRequestSchema } from '../../schemas/grpc-request';
import type { GrpcMetadataPair, GrpcRequest } from '../../types/grpc-request';
import { emitCanonicalYaml } from './canonical-emit';
import { GRPC_REQUEST_FIELD_ORDER } from './ordering';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

const MESSAGE_FILE_NAME = 'message.json';

// ── Parse ─────────────────────────────────────────────────────────

export interface GrpcRequestSiblingFile {
  /** Filename relative to the request folder, e.g. "message.json". */
  fileName: string;
  content: string;
}

export interface GrpcRequestCodecContext {
  /** Workspace-relative gRPC request folder path. */
  path: string;
  /** Every sibling file the caller found next to `grpc.yaml`. The codec
   *  recognizes `message.json` and ignores the rest (forward-compat). */
  siblings?: readonly GrpcRequestSiblingFile[];
}

export function parseGrpcRequest(yaml: string, context: GrpcRequestCodecContext): ParsedDocument<GrpcRequest> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  let message = '';
  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName === MESSAGE_FILE_NAME) {
      message = sibling.content;
      break;
    }
  }

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    message,
  };

  const value = v.parse(GrpcRequestSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, GrpcRequestSchema, GRPC_REQUEST_FIELD_ORDER));
}

// ── Serialize ─────────────────────────────────────────────────────

export interface GrpcRequestSerializeOutput {
  /** `grpc.yaml` contents. */
  grpcYaml: string;
  /** `message.json` when the request carries a composed message; null otherwise. */
  messageFile: GrpcRequestSiblingFile | null;
}

export function serializeGrpcRequest(write: WriteableDocument<GrpcRequest>): GrpcRequestSerializeOutput {
  // The manifest carries everything except the message text, which
  // fans out into message.json so reviewers read it with native JSON
  // highlighting and the manifest stays scannable.
  const value = canonicalizeGrpcRequest(write.value);
  const manifestView = {
    ...value,
    message: undefined,
  } as unknown as GrpcRequest;

  const grpcYaml = emitCanonicalYaml(manifestView, GrpcRequestSchema, GRPC_REQUEST_FIELD_ORDER, unknownFieldsOf(write));

  const messageFile: GrpcRequestSiblingFile | null =
    value.message !== '' ? { fileName: MESSAGE_FILE_NAME, content: value.message } : null;

  return { grpcYaml, messageFile };
}

/**
 * Normalize metadata row key order so two clients building the same
 * request via different paths emit byte-identical YAML — same
 * architectural shape as `canonicalizeRequest` (design §23.3).
 */
export function canonicalizeGrpcRequest(request: GrpcRequest): GrpcRequest {
  return { ...request, metadata: request.metadata.map(canonicalMetadataPair) };
}

function canonicalMetadataPair(p: GrpcMetadataPair): GrpcMetadataPair {
  const out: GrpcMetadataPair = { uid: p.uid, key: p.key, value: p.value };
  if (p.description !== undefined) out.description = p.description;
  if (p.enabled !== undefined) out.enabled = p.enabled;
  return out;
}
