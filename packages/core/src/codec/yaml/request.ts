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
import type { BodyType, Request, RequestBody } from '../../types/v5/request';
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

  // Body assembly: find the sole `body.<ext>` among siblings. Multiple
  // body files is a corrupt state — accept the first and ignore the
  // rest; the desktop storage service is responsible for enforcing
  // single-body on write.
  let body: RequestBody = { type: 'none' };
  let preRequestScript: string | undefined;
  let testScript: string | undefined;
  let graphqlVariables: string | undefined;

  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName.startsWith('body.')) {
      const type = bodyTypeFromFileName(sibling.fileName);
      body = { type, content: sibling.content };
    } else if (sibling.fileName === 'variables.json') {
      graphqlVariables = sibling.content;
    } else if (sibling.fileName === 'pre-request.js') {
      preRequestScript = sibling.content;
    } else if (sibling.fileName === 'test.js') {
      testScript = sibling.content;
    }
  }

  if (graphqlVariables !== undefined && body.type === 'graphql') {
    body = { ...body, graphqlVariables };
  }

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    body,
  };
  if (preRequestScript !== undefined) merged.preRequestScript = preRequestScript;
  if (testScript !== undefined) merged.testScript = testScript;

  const value = v.parse(RequestSchema, merged);
  return makeParsed(value, doc);
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
  /** `test.js` when the request has a test script. */
  testScript: RequestSiblingFile | null;
}

export function serializeRequest(write: WriteableDocument<Request>): RequestSerializeOutput {
  // The request.yaml manifest omits body content + script content — those
  // go to sibling files. Stripping them here keeps the YAML diff-readable.
  const manifestView = {
    ...write.value,
    body: { type: write.value.body.type },
    preRequestScript: undefined,
    testScript: undefined,
  } as unknown as Request;

  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(manifestView, REQUEST_FIELD_ORDER);
  mergeKnownFields(doc, manifestView, REQUEST_FIELD_ORDER);
  const requestYaml = doc.toString(CANONICAL_STRINGIFY_OPTIONS);

  const bodyFileName = bodyFileNameFor(write.value.body.type);
  const bodyContent = write.value.body.content;
  const bodyFile: RequestSiblingFile | null =
    bodyFileName && bodyContent !== undefined ? { fileName: bodyFileName, content: bodyContent } : null;

  const variablesFile: RequestSiblingFile | null =
    write.value.body.type === 'graphql' && write.value.body.graphqlVariables !== undefined
      ? { fileName: 'variables.json', content: write.value.body.graphqlVariables }
      : null;

  const preRequestScript: RequestSiblingFile | null =
    write.value.preRequestScript !== undefined
      ? { fileName: 'pre-request.js', content: write.value.preRequestScript }
      : null;

  const testScript: RequestSiblingFile | null =
    write.value.testScript !== undefined ? { fileName: 'test.js', content: write.value.testScript } : null;

  return { requestYaml, bodyFile, variablesFile, preRequestScript, testScript };
}
