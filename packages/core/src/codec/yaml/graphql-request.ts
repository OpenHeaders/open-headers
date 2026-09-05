/**
 * GraphqlRequest codec — multi-file assembly.
 *
 * On disk, a GraphQL request is a folder containing:
 *
 *   graphql.yaml      # manifest — identity, endpoint, operation pick, headers, auth, spec binding, HTTP knobs
 *   query.graphql     # the document (only when non-empty)
 *   variables.json    # the variables JSON text (only when set)
 *   pre-request.js    # the HTTP script pair, one file per slot (invariant #9)
 *   post-response.js
 *
 * The codec's job is translation between the runtime `GraphqlRequest`
 * object and the on-disk fan-out; the caller handles filesystem I/O.
 * Parse input: the caller lists every sibling it found on disk; the
 * codec splices the document, the variables and the script siblings
 * into the runtime shape. Serialize output: one graphql.yaml string +
 * the document sibling when non-empty + the variables sibling when
 * set + one script sibling per slot the request carries — the HTTP
 * body mode's `body.graphql` / `variables.json` fan-out (invariant #15
 * addendum) on an entity of its own.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { GraphqlRequestSchema } from '../../schemas/graphql-request';
import { HTTP_SCRIPT_KINDS } from '../../scripts/slots';
import type { GraphqlRequest } from '../../types/graphql-request';
import type { RequestHeader } from '../../types/request';
import { emitCanonicalYaml } from './canonical-emit';
import { GRAPHQL_REQUEST_FIELD_ORDER } from './ordering';
import { type ScriptSiblingFile, scriptFieldsFromSiblings, scriptSiblingsFromFields } from './script-siblings';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

const QUERY_FILE_NAME = 'query.graphql';
const VARIABLES_FILE_NAME = 'variables.json';

// ── Parse ─────────────────────────────────────────────────────────

export type GraphqlRequestSiblingFile = ScriptSiblingFile;

export interface GraphqlRequestCodecContext {
  /** Workspace-relative GraphQL request folder path. */
  path: string;
  /** Every sibling file the caller found next to `graphql.yaml`. The
   *  codec recognizes `query.graphql`, `variables.json` and the HTTP
   *  script pair's siblings, and ignores the rest (forward-compat). */
  siblings?: readonly GraphqlRequestSiblingFile[];
}

export function parseGraphqlRequest(yaml: string, context: GraphqlRequestCodecContext): ParsedDocument<GraphqlRequest> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  let query = '';
  let variables: string | undefined;
  for (const sibling of context.siblings ?? []) {
    if (sibling.fileName === QUERY_FILE_NAME) query = sibling.content;
    else if (sibling.fileName === VARIABLES_FILE_NAME) variables = sibling.content;
  }

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    query,
    ...(variables !== undefined ? { variables } : {}),
    ...scriptFieldsFromSiblings(context.siblings, HTTP_SCRIPT_KINDS),
  };

  const value = v.parse(GraphqlRequestSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, GraphqlRequestSchema, GRAPHQL_REQUEST_FIELD_ORDER));
}

// ── Serialize ─────────────────────────────────────────────────────

export interface GraphqlRequestSerializeOutput {
  /** `graphql.yaml` contents. */
  graphqlYaml: string;
  /** `query.graphql` when the request carries a document; null otherwise. */
  queryFile: GraphqlRequestSiblingFile | null;
  /** `variables.json` when the request carries variables; null otherwise. */
  variablesFile: GraphqlRequestSiblingFile | null;
  /** One sibling per script slot the request carries, in kind order. */
  scriptFiles: ScriptSiblingFile[];
}

export function serializeGraphqlRequest(write: WriteableDocument<GraphqlRequest>): GraphqlRequestSerializeOutput {
  // The manifest carries everything except the document, the
  // variables and the scripts, which fan out into their own siblings
  // so reviewers read them with native highlighting and the manifest
  // stays scannable.
  const value = canonicalizeGraphqlRequest(write.value);
  const manifestView = {
    ...value,
    query: undefined,
    variables: undefined,
    preRequestScript: undefined,
    postResponseScript: undefined,
  } as unknown as GraphqlRequest;

  const graphqlYaml = emitCanonicalYaml(
    manifestView,
    GraphqlRequestSchema,
    GRAPHQL_REQUEST_FIELD_ORDER,
    unknownFieldsOf(write),
  );

  const queryFile: GraphqlRequestSiblingFile | null =
    value.query !== '' ? { fileName: QUERY_FILE_NAME, content: value.query } : null;
  const variablesFile: GraphqlRequestSiblingFile | null =
    value.variables !== undefined ? { fileName: VARIABLES_FILE_NAME, content: value.variables } : null;

  return { graphqlYaml, queryFile, variablesFile, scriptFiles: scriptSiblingsFromFields(value, HTTP_SCRIPT_KINDS) };
}

/**
 * Normalize header row key order so two clients building the same
 * request via different paths emit byte-identical YAML — the same
 * architectural shape as `canonicalizeRequest` (design §23.3).
 */
export function canonicalizeGraphqlRequest(request: GraphqlRequest): GraphqlRequest {
  return { ...request, headers: request.headers.map(canonicalHeaderRow) };
}

function canonicalHeaderRow(row: RequestHeader): RequestHeader {
  const out: RequestHeader = { uid: row.uid, key: row.key, value: row.value };
  if (row.description !== undefined) out.description = row.description;
  if (row.enabled !== undefined) out.enabled = row.enabled;
  return out;
}
