/**
 * Pure collector for every templatable string in a GraphQL request,
 * grouped by the entity field it belongs to.
 *
 * Keep in lock-step with the compile (`graphql/compile.ts`): a GraphQL
 * request reaches the wire as ONE HTTP `POST` — the URL, the enabled
 * header rows, the auth and the SNI override carried verbatim, the
 * document and the variables JSON as the graphql body — and the HTTP
 * executor resolves exactly those fields (`collectRequestTemplateStrings`
 * over the compiled request names the same set). A subscription rides
 * the same document and variables over the WebSocket plane. The
 * operation pick is an identifier, never templated.
 *
 * The input is the entity's FIELD LIST, so the persisted entity and
 * the editor's save projection satisfy it alike.
 */

import type { GraphqlRequest } from '../types';
import { collectAuthTemplateStrings, collectPairTemplateStrings } from './auth-scan';

export type GraphqlTemplateSource = Pick<
  GraphqlRequest,
  'url' | 'headers' | 'auth' | 'query' | 'variables' | 'sniServerName'
>;

/** The templates by the entity field they ride, in wire order. */
export interface GraphqlTemplateGroups {
  url: string[];
  headers: string[];
  auth: string[];
  /** The document and the variables JSON. */
  query: string[];
  /** The HTTP knobs — the SNI override. */
  settings: string[];
}

export function collectGraphqlTemplateGroups(request: GraphqlTemplateSource): GraphqlTemplateGroups {
  const url: string[] = [];
  if (request.url) url.push(request.url);

  const headers: string[] = [];
  collectPairTemplateStrings(request.headers, headers);

  const auth: string[] = [];
  collectAuthTemplateStrings(request.auth, auth);

  const query: string[] = [];
  if (request.query) query.push(request.query);
  if (request.variables) query.push(request.variables);

  const settings: string[] = [];
  if (request.sniServerName) settings.push(request.sniServerName);

  return { url, headers, auth, query, settings };
}

/** Flat, order-preserving list of every templatable string in `request`. */
export function collectGraphqlRequestTemplateStrings(request: GraphqlTemplateSource): string[] {
  const g = collectGraphqlTemplateGroups(request);
  return [...g.url, ...g.headers, ...g.auth, ...g.query, ...g.settings];
}
