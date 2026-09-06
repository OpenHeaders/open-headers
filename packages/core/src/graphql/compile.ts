/**
 * The compile — a GraphQL request into the runtime HTTP `Request` the
 * existing executor runs on every host. One pure function, the only
 * way a GraphQL request reaches the wire: `POST` to the URL, the
 * headers rows, the auth, the HTTP script pair and the HTTP settings
 * knobs carried verbatim, the SAME uid + path so the ancestor chain
 * (script slots, auth pool, settings) resolves off the tree index
 * unchanged, and the body as the graphql variant — `content` is the
 * document, `graphqlVariables` the JSON text, `operationName` the
 * pick when the document holds several operations (the census owns
 * the pick rule; the compile forwards it).
 *
 * The input is typed as the entity's FIELD LIST — the `GraphqlRequest`
 * schema of the entity phase satisfies it structurally.
 */

import { HTTP_INHERITABLE_SETTING_KEYS } from '../schemas/inheritable-settings';
import type { AuthConfig, Request, RequestBody, RequestHeader, RequestSpecLink } from '../types/request';
import { censusDocument, wireOperationName } from './census';
import { parseDocument } from './parse';

export type HttpSettingKey = (typeof HTTP_INHERITABLE_SETTING_KEYS)[number];

/** The HTTP knobs a GraphQL request carries — the same optional scalars
 *  as the HTTP request's own. */
export type GraphqlRequestSettings = Pick<Request, HttpSettingKey>;

/** The GraphQL request's field list — identity, endpoint, document,
 *  variables, the operation pick, headers, auth, spec binding, the
 *  HTTP script pair, the HTTP settings knobs. */
export interface GraphqlRequestLike extends GraphqlRequestSettings {
  readonly schemaVersion: Request['schemaVersion'];
  readonly uid: string;
  readonly path: string;
  readonly pathSegment?: string;
  readonly name: string;
  readonly description?: string;
  readonly url: string;
  /** The GraphQL document (`query.graphql`). */
  readonly query: string;
  /** JSON text of the variables object (`variables.json`). */
  readonly variables?: string;
  /** The operation to run when the document holds several. */
  readonly operationName?: string;
  readonly headers: readonly RequestHeader[];
  readonly auth: AuthConfig;
  readonly specLink?: RequestSpecLink;
  readonly preRequestScript?: string;
  readonly postResponseScript?: string;
}

export interface CompileOptions {
  /** Overrides the request's stored pick (the operation select's
   *  live choice); absent falls back to the stored one. */
  readonly operationName?: string;
}

function copySetting<K extends HttpSettingKey>(out: GraphqlRequestSettings, input: GraphqlRequestLike, key: K): void {
  const value = input[key];
  if (value !== undefined) out[key] = value;
}

function settingsOf(input: GraphqlRequestLike): GraphqlRequestSettings {
  const out: GraphqlRequestSettings = {};
  for (const key of HTTP_INHERITABLE_SETTING_KEYS) copySetting(out, input, key);
  return out;
}

/** Compile a GraphQL request into the HTTP request the executor runs. */
export function toHttpRequest(input: GraphqlRequestLike, options: CompileOptions = {}): Request {
  const operationName = options.operationName ?? input.operationName;
  const body: RequestBody = {
    type: 'graphql',
    content: input.query,
    ...(input.variables !== undefined ? { graphqlVariables: input.variables } : {}),
    ...(operationName !== undefined && operationName !== '' ? { operationName } : {}),
  };
  return {
    schemaVersion: input.schemaVersion,
    uid: input.uid,
    path: input.path,
    ...(input.pathSegment !== undefined ? { pathSegment: input.pathSegment } : {}),
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    method: 'POST',
    url: input.url,
    headers: [...input.headers],
    params: [],
    auth: input.auth,
    ...(input.specLink !== undefined ? { specLink: input.specLink } : {}),
    ...settingsOf(input),
    body,
    ...(input.preRequestScript !== undefined ? { preRequestScript: input.preRequestScript } : {}),
    ...(input.postResponseScript !== undefined ? { postResponseScript: input.postResponseScript } : {}),
  };
}

/**
 * The whole compile the executing hosts (and the renderer's "Copy as"
 * snippet) run: the operation pick decided by the census's rule —
 * one operation → nothing on the wire; several → the requested name
 * when held, else the first named; an unparseable document sends as
 * written — then `toHttpRequest`. The stored `operationName` never
 * reaches the compile on its own, so a stale pick (the document no
 * longer holds it) never reaches the wire.
 */
export function compileGraphqlRequest(input: GraphqlRequestLike, options: CompileOptions = {}): Request {
  const { operationName: stored, ...fields } = input;
  const requested = options.operationName ?? stored;
  const parsed = parseDocument(input.query);
  const operationName =
    parsed.document === null ? requested : wireOperationName(censusDocument(parsed.document), requested);
  return toHttpRequest(fields, operationName !== undefined ? { operationName } : {});
}
