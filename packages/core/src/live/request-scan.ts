/**
 * Pure collector for every templatable string in a Request.
 *
 * The executor walks these exact fields during variable resolution;
 * downstream callers (Live Workflow dependency graph, step-reference
 * validator) need the same set to answer "which variables does THIS
 * request reference?" without duplicating the walker.
 *
 * Keep in lock-step with `request-executor.resolveRequest`. Every
 * string the executor feeds through `resolveTemplate` is a candidate
 * for `{{VAR}}` resolution and must be visible here; anything this
 * collector misses means the dependency graph (Phase C reconcile) +
 * the step-reference validator (Phase A) silently under-report refs.
 */

import { canonicalJson } from '../sync/store/canonical';
import type { Request } from '../types';
import { collectAuthTemplateStrings, collectPairTemplateStrings } from './auth-scan';

/** The templated field list of an HTTP request — the persisted entity
 *  and the editor's save projection satisfy it alike, so one walk feeds
 *  the editor's tab dots and lifecycle flag, the sidebar's resolvability
 *  set and the Variable Scope panel. */
export type RequestTemplateSource = Pick<
  Request,
  'url' | 'params' | 'pathParams' | 'headers' | 'auth' | 'body' | 'sniServerName'
>;

/** The templates by the entity field they ride. */
export interface RequestTemplateGroups {
  url: string[];
  /** The enabled query rows and the path parameter VALUES — one tab,
   *  one group (a path key is the URL's, never templated). */
  params: string[];
  headers: string[];
  auth: string[];
  body: string[];
  /** The Settings knobs — the SNI override. */
  settings: string[];
}

/**
 * Every templatable string in `request`, grouped by field. Disabled
 * headers / params are skipped to match the executor — they never hit
 * the wire, so their templates never resolve and shouldn't contribute
 * to the dependency graph either.
 */
export function collectRequestTemplateGroups(request: RequestTemplateSource): RequestTemplateGroups {
  const url: string[] = [];
  if (request.url) url.push(request.url);

  const params: string[] = [];
  collectPairTemplateStrings(request.params, params);
  for (const p of request.pathParams ?? []) {
    if (p.value) params.push(p.value);
  }

  const headers: string[] = [];
  collectPairTemplateStrings(request.headers, headers);

  // The SNI override — the Settings tab's one templatable knob; the
  // executors gate it on the EFFECTIVE request, so an inherited
  // template answers here like the request's own.
  const settings: string[] = [];
  if (request.sniServerName) settings.push(request.sniServerName);

  // The shared auth walk every request kind rides.
  const auth: string[] = [];
  collectAuthTemplateStrings(request.auth, auth);

  // Exhaustive over the discriminated union — anything missed here
  // silently disappears from the dependency graph + the resolvability
  // gate. The compiler enforces exhaustion via the `never` assignment
  // on the default branch.
  const body: string[] = [];
  const requestBody = request.body;
  switch (requestBody.type) {
    case 'none':
      break;
    case 'json':
    case 'xml':
    case 'text':
      if (requestBody.content) body.push(requestBody.content);
      break;
    case 'graphql':
      if (requestBody.content) body.push(requestBody.content);
      if (requestBody.graphqlVariables) body.push(requestBody.graphqlVariables);
      break;
    case 'form':
      for (const part of requestBody.formParts) {
        if (part.enabled === false) continue;
        if (part.key) body.push(part.key);
        if (part.value) body.push(part.value);
      }
      break;
    case 'multipart':
      for (const part of requestBody.multipartParts) {
        if (part.enabled === false) continue;
        if (part.name) body.push(part.name);
        if (part.kind === 'text' && part.value) body.push(part.value);
      }
      break;
    default: {
      const _exhaustive: never = requestBody;
      void _exhaustive;
    }
  }

  return { url, params, headers, auth, body, settings };
}

/** Flat, order-preserving list of every templatable string in `request`. */
export function collectRequestTemplateStrings(request: RequestTemplateSource): string[] {
  const g = collectRequestTemplateGroups(request);
  return [...g.url, ...g.params, ...g.headers, ...g.settings, ...g.auth, ...g.body];
}

/**
 * Stable fingerprint of a request's EXECUTABLE surface — every field
 * that influences the response a workflow step extracts from. Two
 * requests with the same fingerprint produce the same value from the
 * same upstream; a fingerprint change means the cached value was
 * minted by a recipe that no longer exists ("definitional staleness").
 *
 * Excluded as non-executable: `schemaVersion` (format axis), `uid`
 * (identity), `path` (folder placement), `name` + `description`
 * (cosmetic). Editing any of those must NOT trigger a refresh — it
 * cannot change the produced value.
 *
 * Scripts ARE included: a step with `runScripts: true` executes
 * `preRequestScript` / `postResponseScript`, which can rewrite the
 * request or gate the captured response, so they are part of the
 * recipe. For opted-out steps the inclusion is conservative (a script
 * edit triggers a refresh that can't change the value) — the harmless
 * direction, and cheaper than a per-step fingerprint.
 *
 * Keyed through `canonicalJson` so structurally-equal requests
 * serialize byte-identically regardless of object key order.
 */
export function requestExecutableFingerprint(request: Request): string {
  return canonicalJson({
    method: request.method,
    url: request.url,
    headers: request.headers,
    params: request.params,
    // Absent and empty are one state — no path value to hash.
    pathParams: request.pathParams ?? [],
    auth: request.auth,
    credentialsMode: request.credentialsMode ?? null,
    followRedirects: request.followRedirects ?? null,
    sslVerification: request.sslVerification ?? null,
    tlsMinVersion: request.tlsMinVersion ?? null,
    tlsMaxVersion: request.tlsMaxVersion ?? null,
    tlsCipherSuites: request.tlsCipherSuites ?? null,
    sniServerName: request.sniServerName ?? null,
    httpVersion: request.httpVersion ?? null,
    resolveToAddress: request.resolveToAddress ?? null,
    clientCertificateRef: request.clientCertificateRef ?? null,
    proxyMode: request.proxyMode ?? null,
    proxyUrl: request.proxyUrl ?? null,
    proxyCredentialRef: request.proxyCredentialRef ?? null,
    unixSocketPath: request.unixSocketPath ?? null,
    cookieJar: request.cookieJar ?? null,
    timeoutMs: request.timeoutMs ?? null,
    maxResponseBytes: request.maxResponseBytes ?? null,
    maxRedirects: request.maxRedirects ?? null,
    followOriginalHttpMethod: request.followOriginalHttpMethod ?? null,
    followAuthorizationHeader: request.followAuthorizationHeader ?? null,
    body: request.body,
    preRequestScript: request.preRequestScript ?? null,
    postResponseScript: request.postResponseScript ?? null,
  });
}
