/**
 * The reverse bridge — an HTTP request whose body is the graphql
 * body mode, read into a GraphQL request's content. The compile's
 * inverse for everything the entity carries: the endpoint (the query
 * rows folded into the URL honestly — enabled rows appended as the
 * display form keeps them, templates verbatim; disabled rows dropped
 * and NOTED; the path parameter rows written into their `:name`
 * segments as their value text reads and NOTED — a row without a
 * value REFUSES the convert by name, a GraphQL request having no path
 * parameters to carry it), the headers rows, the auth (the same HTTP mask), the
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
import { missingPathParamKeys } from '../utils/request-validation';
import { buildUrlDisplay, inlinePathParams } from '../utils/url';
import type { GraphqlRequestSettings, HttpSettingKey } from './compile';

/** A GraphQL request's content minus its name — what a conversion yields. */
export type GraphqlRequestContent = Omit<GraphqlRequestSeed, 'name'>;

/** The request fields the conversion reads: the HTTP request's own
 *  shape minus identity, every optional leaf optional. */
export type HttpRequestLike = Pick<Request, 'url' | 'headers' | 'auth' | 'body'> &
  Partial<
    Pick<
      Request,
      'method' | 'params' | 'pathParams' | 'description' | 'specLink' | 'preRequestScript' | 'postResponseScript'
    >
  > &
  GraphqlRequestSettings;

export type ConvertNote =
  /** Enabled query rows were appended to the URL. */
  | { readonly kind: 'params-folded'; readonly count: number }
  /** Disabled query rows have no place on a GraphQL request and were dropped. */
  | { readonly kind: 'disabled-params-dropped'; readonly count: number }
  /** Path parameter rows were written into their URL segments as their value text reads. */
  | { readonly kind: 'path-params-inlined'; readonly count: number }
  /** The source used a method other than POST; the GraphQL request always posts. */
  | { readonly kind: 'method-changed'; readonly method: HttpMethod };

/** Why a graphql-bodied request still does not convert. */
export type ConvertRefusal =
  /** The URL names path parameters whose rows carry no value — nothing
   *  honest to write into the segment, and a GraphQL request has no
   *  path parameters to keep the gap open. */
  { readonly kind: 'path-params-empty'; readonly keys: readonly string[] };

export interface HttpToGraphqlConverted {
  readonly content: GraphqlRequestContent;
  readonly notes: readonly ConvertNote[];
}

export interface HttpToGraphqlRefused {
  readonly refusal: ConvertRefusal;
}

export type HttpToGraphqlResult = HttpToGraphqlConverted | HttpToGraphqlRefused;

function copySetting<K extends HttpSettingKey>(out: GraphqlRequestSettings, input: HttpRequestLike, key: K): void {
  const value = input[key];
  if (value !== undefined) out[key] = value;
}

/** True when the body is the graphql body mode — the only convertible shape. */
export function isConvertibleToGraphql(request: Pick<Request, 'body'>): boolean {
  return request.body.type === 'graphql';
}

/** Read an HTTP request into GraphQL request content; null unless its
 *  body is graphql; a refusal when a path parameter has no value. */
export function fromHttpRequest(input: HttpRequestLike): HttpToGraphqlResult | null {
  const body = input.body;
  if (body.type !== 'graphql') return null;
  const emptyPathParams = missingPathParamKeys(input.url, input.pathParams);
  if (emptyPathParams.length > 0) return { refusal: { kind: 'path-params-empty', keys: emptyPathParams } };
  const notes: ConvertNote[] = [];
  const params = input.params ?? [];
  const enabled = params.filter((param) => param.enabled !== false && param.key.trim() !== '');
  const disabled = params.filter((param) => param.enabled === false);
  const pathValues = new Map((input.pathParams ?? []).map((row) => [row.key, row.value]));
  const pathUrl = inlinePathParams(input.url, (name) => pathValues.get(name) ?? null);
  const url = buildUrlDisplay(pathUrl, enabled);
  if (pathUrl !== input.url) notes.push({ kind: 'path-params-inlined', count: pathValues.size });
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
