/**
 * GraphQL execution — the ONE compile a GraphqlRequest goes through
 * before it reaches the wire, on the host that runs it. The entity
 * becomes the runtime HTTP `Request` (`toHttpRequest`: one POST of the
 * `{query, variables, operationName}` envelope, the SAME uid + path so
 * the ancestor chain — script slots, auth pool, settings — resolves
 * off the tree index unchanged) and the existing HTTP pipeline runs it:
 * `runInteractiveSend` / `runStepRequest` on the node hosts, the SW's
 * `executeRequestDraft` in the extension. No GraphQL transport, ever.
 *
 * The operation pick is the census's rule, applied here so a stale
 * stored `operationName` (the document no longer holds it) never
 * reaches the wire: one operation → nothing on the wire; several →
 * the requested name when held, else the first named. An unparseable
 * document sends as written — the server's own error is the honest
 * answer, and the editor's diagnostics already said so.
 */

import { censusDocument, parseDocument, toHttpRequest, wireOperationName } from '@openheaders/core/graphql';
import type { GraphqlRequest, Request } from '@openheaders/core/types';

export interface CompileGraphqlRequestOptions {
  /** The operation select's live choice — overrides the entity's stored pick for this send. */
  readonly operationName?: string;
}

/** The compiled HTTP request the executors run for a GraphQL request. */
export function compileGraphqlRequest(entity: GraphqlRequest, options: CompileGraphqlRequestOptions = {}): Request {
  const { operationName: stored, ...fields } = entity;
  const requested = options.operationName ?? stored;
  const parsed = parseDocument(entity.query);
  const operationName =
    parsed.document === null ? requested : wireOperationName(censusDocument(parsed.document), requested);
  // The pick is decided HERE — the stored name never reaches the compile
  // on its own, so a single-operation document sends nothing on the wire.
  return toHttpRequest(fields, operationName !== undefined ? { operationName } : {});
}
