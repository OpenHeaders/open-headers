/**
 * The reverse bridge — an HTTP request whose body is the graphql
 * body mode, read into a GraphQL request's content. The compile's
 * inverse for everything the entity carries: the endpoint (the query
 * rows folded into the URL honestly — enabled rows appended as the
 * display form keeps them, templates verbatim; disabled rows dropped
 * and NOTED), the headers rows, the auth (the same HTTP mask), the
 * docs, the spec binding, the HTTP script pair and the HTTP settings
 * knobs verbatim; the body's document, variables text and operation
 * pick as the entity's own fields. The method is not a GraphQL
 * request's to keep (every operation is one POST) — a non-POST source
 * is noted. Anything else (a non-graphql body) is refused with null:
 * the callers ("Convert to GraphQL request", the Bruno import leg)
 * decide what to say.
 */

import { HTTP_INHERITABLE_SETTING_KEYS } from '../schemas/inheritable-settings';
import type { GraphqlRequestSeed } from '../types/graphql-request';
import type { HttpMethod, Request } from '../types/request';
import { buildUrlDisplay } from '../utils/url';
import type { GraphqlRequestSettings, HttpSettingKey } from './compile';

/** A GraphQL request's content minus its name — what a conversion yields. */
export type GraphqlRequestContent = Omit<GraphqlRequestSeed, 'name'>;

/** The request fields the conversion reads: the HTTP request's own
 *  shape minus identity, every optional leaf optional. */
export type HttpRequestLike = Pick<Request, 'url' | 'headers' | 'auth' | 'body'> &
  Partial<Pick<Request, 'method' | 'params' | 'description' | 'specLink' | 'preRequestScript' | 'postResponseScript'>> &
  GraphqlRequestSettings;

export type ConvertNote =
  /** Enabled query rows were appended to the URL. */
  | { readonly kind: 'params-folded'; readonly count: number }
  /** Disabled query rows have no place on a GraphQL request and were dropped. */
  | { readonly kind: 'disabled-params-dropped'; readonly count: number }
  /** The source used a method other than POST; the GraphQL request always posts. */
  | { readonly kind: 'method-changed'; readonly method: HttpMethod };

export interface HttpToGraphqlResult {
  readonly content: GraphqlRequestContent;
  readonly notes: readonly ConvertNote[];
}

function copySetting<K extends HttpSettingKey>(out: GraphqlRequestSettings, input: HttpRequestLike, key: K): void {
  const value = input[key];
  if (value !== undefined) out[key] = value;
}

/** True when the body is the graphql body mode — the only convertible shape. */
export function isConvertibleToGraphql(request: Pick<Request, 'body'>): boolean {
  return request.body.type === 'graphql';
}

/** Read an HTTP request into GraphQL request content; null unless its body is graphql. */
export function fromHttpRequest(input: HttpRequestLike): HttpToGraphqlResult | null {
  const body = input.body;
  if (body.type !== 'graphql') return null;
  const notes: ConvertNote[] = [];
  const params = input.params ?? [];
  const enabled = params.filter((param) => param.enabled !== false && param.key.trim() !== '');
  const disabled = params.filter((param) => param.enabled === false);
  const url = buildUrlDisplay(input.url, enabled);
  if (enabled.length > 0) notes.push({ kind: 'params-folded', count: enabled.length });
  if (disabled.length > 0) notes.push({ kind: 'disabled-params-dropped', count: disabled.length });
  if (input.method !== undefined && input.method !== 'POST')
    notes.push({ kind: 'method-changed', method: input.method });
  const settings: GraphqlRequestSettings = {};
  for (const key of HTTP_INHERITABLE_SETTING_KEYS) copySetting(settings, input, key);
  const content: GraphqlRequestContent = {
    ...(input.description !== undefined ? { description: input.description } : {}),
    url,
    query: body.content,
    ...(body.graphqlVariables !== undefined ? { variables: body.graphqlVariables } : {}),
    ...(body.operationName !== undefined ? { operationName: body.operationName } : {}),
    headers: [...input.headers],
    auth: input.auth,
    ...(input.specLink !== undefined ? { specLink: input.specLink } : {}),
    ...settings,
    ...(input.preRequestScript !== undefined ? { preRequestScript: input.preRequestScript } : {}),
    ...(input.postResponseScript !== undefined ? { postResponseScript: input.postResponseScript } : {}),
  };
  return { content, notes };
}
