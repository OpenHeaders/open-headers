/**
 * The DELEGATED request family's wire shapes — the Execution Place
 * plan's second channel family beside the context sends. A context
 * (the surface the user sits at) resolves everything it holds and
 * ships the transport seam's own {@link TransportRequest} — final URL,
 * final headers, final body bytes, the transport knobs — to the place
 * that opens the socket; the place answers with the seam's
 * {@link TransportResponse} and stamps where it ran. Nothing is
 * resolved at the place: no workspace, no vault, no scripts, no jar.
 *
 * The wire shape IS the seam's shape, JSON-safe: multipart file parts
 * carry their bytes base64 (the response side is already text +
 * `bodyEncoding`), and the one field that names state the place does
 * not hold — `cookieJarKey`, the context's jar — never rides: the
 * context attaches its own `Cookie` header before the frame leaves and
 * captures `Set-Cookie` from the answered headers itself.
 *
 * Both ends import this module: a context builds a frame's request
 * through {@link encodeDelegatedRequest}; the place validates an
 * inbound frame through {@link parseDelegatedRequestFrame} — a peer's
 * input, every field structurally checked, file bytes decoded (a
 * malformed run refuses the frame, never sends empty bytes), the body
 * cap clamped to the place's own bound — and what comes out is the
 * seam's request, ready for the transport.
 */

import { JWT_ALGORITHMS } from '@openheaders/core/auth-signing';
import { DELEGATE_REQUEST_CHANNEL } from '@openheaders/core/protocol';
import type { ExecutedRequestErrorHint } from '@openheaders/core/types';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import * as v from 'valibot';
import { toBase64 } from './body-decode';
import type { TransportRequest, TransportResponse } from './transport';

/** The most a place buffers for a delegated body, whatever the frame
 *  asks — the executor's own interactive cap, so a peer can never
 *  make this process hold more than its own sends would. */
export const DELEGATED_MAX_BODY_BYTES = 2 * 1024 * 1024;

const TLS_VERSIONS = ['1.0', '1.1', '1.2', '1.3'] as const;

const HeaderSchema = v.object({ key: v.string(), value: v.string() });

/** A file part: base64 text in, the seam's bytes out — refusing the
 *  frame on a run that does not decode (the issue names the part). */
const FilePartSchema = v.pipe(
  v.object({
    kind: v.literal('file'),
    name: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    bytesBase64: v.string(),
  }),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const { bytesBase64, ...part } = dataset.value;
    const decoded = decodeBase64Bytes(bytesBase64);
    if (decoded === null) {
      addIssue({
        message: 'file bytes are not base64',
        path: [{ type: 'object', origin: 'value', input: dataset.value, key: 'bytesBase64', value: bytesBase64 }],
      });
      return NEVER;
    }
    return { ...part, bytes: new Uint8Array(decoded) };
  }),
);

const MultipartPartSchema = v.variant('kind', [
  v.object({ kind: v.literal('text'), name: v.string(), value: v.string() }),
  FilePartSchema,
]);

const BodySchema = v.variant('kind', [
  v.object({ kind: v.literal('none') }),
  v.object({ kind: v.literal('raw'), content: v.string() }),
  v.object({ kind: v.literal('urlencoded'), fields: v.array(v.object({ name: v.string(), value: v.string() })) }),
  v.object({ kind: v.literal('multipart'), parts: v.array(MultipartPartSchema) }),
]);

const DpopSchema = v.object({
  key: v.object({
    algorithm: v.picklist(JWT_ALGORITHMS),
    privateKeyPkcs8: v.string(),
    publicJwk: v.variant('kty', [
      v.object({ kty: v.literal('EC'), crv: v.string(), x: v.string(), y: v.string() }),
      v.object({ kty: v.literal('RSA'), n: v.string(), e: v.string() }),
    ]),
    jkt: v.string(),
  }),
  accessToken: v.string(),
});

/** The seam's request as the wire carries it — every knob the node
 *  transport honours rides verbatim; the jar key alone is absent by
 *  design. Input = the JSON frame; output = the seam's shape. */
const DelegatedRequestWireSchema = v.object({
  method: v.string(),
  url: v.string(),
  headers: v.array(HeaderSchema),
  body: BodySchema,
  redirect: v.picklist(['follow', 'manual']),
  credentials: v.picklist(['omit', 'include']),
  maxBodyBytes: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.transform((bytes) => Math.min(bytes, DELEGATED_MAX_BODY_BYTES)),
  ),
  sslVerification: v.optional(v.boolean()),
  trustedRootsPem: v.optional(v.array(v.string())),
  tlsMinVersion: v.optional(v.picklist(TLS_VERSIONS)),
  tlsMaxVersion: v.optional(v.picklist(TLS_VERSIONS)),
  tlsCipherSuites: v.optional(v.string()),
  sniServerName: v.optional(v.string()),
  httpVersion: v.optional(v.picklist(['auto', '1.1', '2', '2-prior-knowledge', '3'])),
  resolveToAddress: v.optional(v.string()),
  clientCertificateRef: v.optional(v.string()),
  clientCertificatePem: v.optional(v.string()),
  clientCertificateKeyPem: v.optional(v.string()),
  clientCertificatePassphrase: v.optional(v.string()),
  proxyMode: v.optional(v.picklist(['direct', 'url'])),
  proxyUrl: v.optional(v.string()),
  proxyCredentialRef: v.optional(v.string()),
  proxyCredential: v.optional(v.string()),
  unixSocketPath: v.optional(v.string()),
  timeoutMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  maxRedirects: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  followOriginalHttpMethod: v.optional(v.boolean()),
  followAuthorizationHeader: v.optional(v.boolean()),
  digestAuth: v.optional(
    v.object({ username: v.string(), password: v.string(), disableRetry: v.optional(v.boolean()) }),
  ),
  dpop: v.optional(DpopSchema),
  captureNetwork: v.optional(v.boolean()),
});

/** The JSON shape a context puts on the wire. */
export type DelegatedRequestWire = v.InferInput<typeof DelegatedRequestWireSchema>;

/** One `delegateRequest` frame as it crosses the wire. `workspaceId`
 *  is the gate's subject (the opt-in audit and the per-workspace
 *  capability) — the place resolves nothing against it. */
const DelegatedRequestFrameSchema = v.object({
  type: v.literal(DELEGATE_REQUEST_CHANNEL),
  sendId: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  request: DelegatedRequestWireSchema,
});

export type DelegatedRequestFrame = v.InferInput<typeof DelegatedRequestFrameSchema>;

/** A validated frame: the request is the seam's, ready to send. */
export interface ParsedDelegatedRequestFrame {
  sendId: string;
  workspaceId: string;
  request: TransportRequest;
}

/** Who answered — the answering host's label, stamped by that host. */
export interface DelegatedExecutedOn {
  kind: 'backend';
  name: string;
}

/**
 * The place's answer. A 4xx / 5xx is a `success: true` response like
 * on the seam; `success: false` carries the transport's classified
 * failure (never a snapshot — the context builds its own) with the
 * hint the context stamps on its error snapshot. Both carry the stamp:
 * where the send failed is still that host.
 */
export type DelegatedRequestResult =
  | { success: true; response: TransportResponse; executedOn: DelegatedExecutedOn }
  | { success: false; error: string; hint?: ExecutedRequestErrorHint; executedOn: DelegatedExecutedOn };

export type DelegatedFrameParse = { ok: true; frame: ParsedDelegatedRequestFrame } | { ok: false; error: string };

/** Validate an inbound frame — the first issue's path names what was
 *  wrong; a valid frame comes out seam-ready. */
export function parseDelegatedRequestFrame(message: Record<string, unknown>): DelegatedFrameParse {
  const parsed = v.safeParse(DelegatedRequestFrameSchema, message);
  if (parsed.success) {
    const { sendId, workspaceId, request } = parsed.output;
    return { ok: true, frame: { sendId, workspaceId, request } };
  }
  const issue = parsed.issues[0];
  const path = v.getDotPath(issue);
  return { ok: false, error: `Malformed delegated send frame${path !== null ? ` at ${path}` : ''}: ${issue.message}` };
}

/** The context side: the seam's request as the wire carries it — file
 *  bytes base64, the jar key dropped (the context's own). */
export function encodeDelegatedRequest(request: TransportRequest): DelegatedRequestWire {
  const { body, headers, cookieJarKey: _contextJar, ...rest } = request;
  return { ...rest, headers: [...headers], body: encodeBody(body) };
}

function encodeBody(body: TransportRequest['body']): DelegatedRequestWire['body'] {
  switch (body.kind) {
    case 'none':
    case 'raw':
      return body;
    case 'urlencoded':
      return { kind: 'urlencoded', fields: [...body.fields] };
    case 'multipart':
      return {
        kind: 'multipart',
        parts: body.parts.map((part) =>
          part.kind === 'file'
            ? {
                kind: 'file',
                name: part.name,
                filename: part.filename,
                mimeType: part.mimeType,
                bytesBase64: toBase64(part.bytes),
              }
            : part,
        ),
      };
  }
}
