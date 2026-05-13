/**
 * Request codec — multi-file assembly.
 *
 * On disk, a request is a folder containing:
 *
 *   request.yaml       # manifest (no body block — type lives in the file extension)
 *   body.<ext>         # body content; extension determines type (invariant #15)
 *   variables.json     # optional — graphql only (invariant #15 addendum)
 *   pre-request.js     # optional — two-file scripts (invariant #9)
 *   test.js            # optional
 *
 * The codec's job is translation between the runtime `Request` object
 * (which has `body: { type, content?, graphqlVariables? }` + optional
 * scripts as string fields) and the on-disk fan-out. The caller (desktop
 * storage service, future team-sync layer) handles filesystem I/O.
 *
 * Parse input: the caller lists every sibling it found on disk. The
 * codec infers body `type` from the filename extension (single source of
 * truth per invariant #15) and splices the contents into the runtime
 * shape. Serialize output: one request.yaml string + zero or more
 * sibling files, each tagged with the filename the caller should write.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { RequestSchema } from '../../schemas/request';
import type {
  BodyType,
  FormField,
  MultipartPart,
  QueryParam,
  Request,
  RequestBody,
  RequestHeader,
} from '../../types/request';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { REQUEST_FIELD_ORDER } from './ordering';

/** Body file extensions per invariant #15. */
const BODY_EXT_TO_TYPE: Record<string, BodyType> = {
  json: 'json',
  xml: 'xml',
  graphql: 'graphql',
  form: 'form',
  multipart: 'multipart',
  txt: 'text',
};

const BODY_TYPE_TO_EXT: Record<BodyType, string | null> = {
  none: null,
  json: 'json',
  xml: 'xml',
  graphql: 'graphql',
  form: 'form',
  multipart: 'multipart',
  text: 'txt',
};

function bodyFileNameFor(type: BodyType): string | null {
  const ext = BODY_TYPE_TO_EXT[type];
  return ext ? `body.${ext}` : null;
}

function bodyTypeFromFileName(fileName: string): BodyType {
  const match = fileName.match(/^body\.(\w+)$/);
  if (!match) return 'none';
  return BODY_EXT_TO_TYPE[match[1]] ?? 'none';
}

// ── Parse ─────────────────────────────────────────────────────────

export interface RequestSiblingFile {
  /** Filename relative to the request folder, e.g. "body.json", "pre-request.js". */
  fileName: string;
  content: string;
}

export interface RequestCodecContext {
  /** Workspace-relative request folder path. */
  path: string;
  /** Every sibling file the caller found next to `request.yaml`. The codec
   *  recognizes `body.<ext>`, `variables.json`, `pre-request.js`, `test.js`
   *  and ignores the rest (future forward-compat). */
  siblings?: readonly RequestSiblingFile[];
}

export function parseRequest(yaml: string, context: RequestCodecContext): ParsedDocument<Request> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  // Body assembly: pick up structural fields from the manifest's
  // `body:` block (formParts for form, multipartParts for multipart,
  // rawFormat for text, type discriminator), then fold sibling files
  // in:
  //   • body.<ext>     → overrides `type` (extension is authoritative
  //                      per invariant #15) and supplies `content`
  //   • variables.json → graphql `graphqlVariables` (graphql only)
  //
  // Multiple body files is a corrupt state — accept the first and
  // ignore the rest; the storage service enforces single-body on write.
  const rawBody =
    raw.body && typeof raw.body === 'object' ? (raw.body as Record<string, unknown>) : { type: 'none' as BodyType };
  let preRequestScript: string | undefined;
  let postResponseScript: string | undefined;
  let bodyContent: string | undefined;
  let bodyTypeFromSibling: BodyType | undefined;
  let graphqlVariables: string | undefined;

  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName.startsWith('body.') && bodyTypeFromSibling === undefined) {
      bodyTypeFromSibling = bodyTypeFromFileName(sibling.fileName);
      bodyContent = sibling.content;
    } else if (sibling.fileName === 'variables.json') {
      graphqlVariables = sibling.content;
    } else if (sibling.fileName === 'pre-request.js') {
      preRequestScript = sibling.content;
    } else if (sibling.fileName === 'post-response.js') {
      postResponseScript = sibling.content;
    }
  }

  // Reconstruct the discriminated-union body from the manifest fields
  // + sibling content. Each variant takes only the fields it owns.
  const effectiveType: BodyType = bodyTypeFromSibling ?? (rawBody.type as BodyType) ?? 'none';
  const body = assembleBody(effectiveType, rawBody, bodyContent, graphqlVariables);

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    body,
  };
  if (preRequestScript !== undefined) merged.preRequestScript = preRequestScript;
  if (postResponseScript !== undefined) merged.postResponseScript = postResponseScript;

  const value = v.parse(RequestSchema, merged);
  return makeParsed(value, doc);
}

function assembleBody(
  type: BodyType,
  raw: Record<string, unknown>,
  content: string | undefined,
  graphqlVariables: string | undefined,
): RequestBody {
  switch (type) {
    case 'none':
      return { type: 'none' };
    case 'json':
      return { type: 'json', content: content ?? '' };
    case 'xml':
      return { type: 'xml', content: content ?? '' };
    case 'text': {
      const rawFormat = raw.rawFormat;
      if (rawFormat === 'javascript' || rawFormat === 'html' || rawFormat === 'text') {
        return { type: 'text', content: content ?? '', rawFormat };
      }
      return { type: 'text', content: content ?? '' };
    }
    case 'form':
      return {
        type: 'form',
        formParts: Array.isArray(raw.formParts) ? (raw.formParts as FormField[]) : [],
      };
    case 'multipart':
      return {
        type: 'multipart',
        multipartParts: Array.isArray(raw.multipartParts) ? (raw.multipartParts as MultipartPart[]) : [],
      };
    case 'graphql':
      return graphqlVariables !== undefined
        ? { type: 'graphql', content: content ?? '', graphqlVariables }
        : { type: 'graphql', content: content ?? '' };
  }
}

// ── Serialize ─────────────────────────────────────────────────────

export interface RequestSerializeOutput {
  /** `request.yaml` contents. */
  requestYaml: string;
  /** `body.<ext>` when the request carries a body; null for `type: 'none'`. */
  bodyFile: RequestSiblingFile | null;
  /** `variables.json` for graphql requests with variables set; null otherwise. */
  variablesFile: RequestSiblingFile | null;
  /** `pre-request.js` when the request has a pre-request script. */
  preRequestScript: RequestSiblingFile | null;
  /** `post-response.js` when the request has a post-response script. */
  postResponseScript: RequestSiblingFile | null;
}

export function serializeRequest(write: WriteableDocument<Request>): RequestSerializeOutput {
  // The request.yaml manifest carries the body's STRUCTURAL fields
  // (formParts for form bodies, multipartParts for multipart bodies,
  // rawFormat hint for text bodies). Bulk content (the JSON / XML / text
  // / GraphQL body string) and graphql variables fan out into sibling
  // files so a code reviewer reads them with native syntax highlighting
  // and the manifest stays scannable.
  const value = canonicalizeRequest(write.value);
  const body = value.body;
  const manifestBody = manifestBodyOf(body);
  const manifestView = {
    ...value,
    body: manifestBody,
    preRequestScript: undefined,
    postResponseScript: undefined,
  } as unknown as Request;

  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(manifestView, REQUEST_FIELD_ORDER);
  mergeKnownFields(doc, manifestView, REQUEST_FIELD_ORDER);
  const requestYaml = doc.toString(CANONICAL_STRINGIFY_OPTIONS);

  const bodyFileName = bodyFileNameFor(body.type);
  const bodyContent = bodyContentOf(body);
  const bodyFile: RequestSiblingFile | null =
    bodyFileName && bodyContent !== undefined ? { fileName: bodyFileName, content: bodyContent } : null;

  const variablesFile: RequestSiblingFile | null =
    body.type === 'graphql' && body.graphqlVariables !== undefined
      ? { fileName: 'variables.json', content: body.graphqlVariables }
      : null;

  const preRequestScript: RequestSiblingFile | null =
    value.preRequestScript !== undefined
      ? { fileName: 'pre-request.js', content: value.preRequestScript }
      : null;

  const postResponseScript: RequestSiblingFile | null =
    value.postResponseScript !== undefined
      ? { fileName: 'post-response.js', content: value.postResponseScript }
      : null;

  return { requestYaml, bodyFile, variablesFile, preRequestScript, postResponseScript };
}

/**
 * Manifest projection of the body — strips bulk content (which fans
 * out into sibling files) but keeps the structural fields the YAML
 * needs to round-trip the body type back through `parseRequest`.
 *
 * Returns a loose record (not the runtime `RequestBody` shape) because
 * the manifest INTENTIONALLY omits per-variant required fields like
 * `content` — those live in `body.<ext>`. The runtime invariant
 * (`json` carries `content`) is reconstructed on parse by
 * `assembleBody` reading the sibling file.
 *
 * Exhaustive over the discriminated union; the compiler refuses to
 * compile a missed variant.
 */
function manifestBodyOf(body: RequestBody): Record<string, unknown> {
  switch (body.type) {
    case 'none':
    case 'json':
    case 'xml':
      return { type: body.type };
    case 'text':
      return body.rawFormat !== undefined ? { type: 'text', rawFormat: body.rawFormat } : { type: 'text' };
    case 'graphql':
      // graphqlVariables fans out to variables.json; query fans out to body.graphql.
      return { type: 'graphql' };
    case 'form':
      return { type: 'form', formParts: body.formParts };
    case 'multipart':
      return { type: 'multipart', multipartParts: body.multipartParts };
  }
}

/**
 * Bulk content destined for the `body.<ext>` sibling file. `undefined`
 * for body types that have no fan-out (none / form / multipart — those
 * carry their wire payload in the manifest itself).
 */
function bodyContentOf(body: RequestBody): string | undefined {
  switch (body.type) {
    case 'none':
    case 'form':
    case 'multipart':
      return undefined;
    case 'json':
    case 'xml':
    case 'text':
    case 'graphql':
      return body.content;
  }
}

/**
 * Normalize nested row key order in a request's set-modeled subtrees
 * so two clients building the same request via different paths emit
 * byte-identical YAML. Same architectural shape as `canonicalizeRule`
 * — set rows (headers, params, body form/multipart parts) enter
 * insertion order via the form's register sequence vs. the
 * oracle-projected materialize pipeline; without normalization the
 * diff dialog would show every row as removed+added on a partial-leaf
 * change.
 *
 * Wired into `serializeRequest` so the persist boundary emits canonical
 * YAML — design §23.3 "byte-identical YAML for byte-identical state".
 */
export function canonicalizeRequest(request: Request): Request {
  const headers = request.headers.map(canonicalRequestHeader);
  const params = request.params.map(canonicalQueryParam);
  const body = canonicalRequestBody(request.body);
  return { ...request, headers, params, body };
}

function canonicalRequestHeader(h: RequestHeader): RequestHeader {
  const out: RequestHeader = { uid: h.uid, key: h.key, value: h.value };
  if (h.description !== undefined) out.description = h.description;
  if (h.enabled !== undefined) out.enabled = h.enabled;
  return out;
}

function canonicalQueryParam(p: QueryParam): QueryParam {
  const out: QueryParam = { uid: p.uid, key: p.key, value: p.value };
  if (p.description !== undefined) out.description = p.description;
  if (p.enabled !== undefined) out.enabled = p.enabled;
  if (p.hasEquals !== undefined) out.hasEquals = p.hasEquals;
  return out;
}

function canonicalFormField(f: FormField): FormField {
  const out: FormField = { uid: f.uid, key: f.key, value: f.value };
  if (f.description !== undefined) out.description = f.description;
  if (f.enabled !== undefined) out.enabled = f.enabled;
  return out;
}

function canonicalMultipartPart(p: MultipartPart): MultipartPart {
  if (p.kind === 'text') {
    const out = { kind: 'text' as const, uid: p.uid, name: p.name, value: p.value } as MultipartPart;
    if (p.description !== undefined) (out as { description?: string }).description = p.description;
    if (p.enabled !== undefined) (out as { enabled?: boolean }).enabled = p.enabled;
    return out;
  }
  const out = { kind: 'file' as const, uid: p.uid, name: p.name, fileRefs: p.fileRefs } as MultipartPart;
  if (p.description !== undefined) (out as { description?: string }).description = p.description;
  if (p.enabled !== undefined) (out as { enabled?: boolean }).enabled = p.enabled;
  return out;
}

function canonicalRequestBody(body: RequestBody): RequestBody {
  switch (body.type) {
    case 'form':
      return { type: 'form', formParts: body.formParts.map(canonicalFormField) };
    case 'multipart':
      return { type: 'multipart', multipartParts: body.multipartParts.map(canonicalMultipartPart) };
    default:
      return body;
  }
}
