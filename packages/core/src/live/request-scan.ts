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

/**
 * Flat, order-preserving list of every templatable string in `request`.
 * Disabled headers / params are skipped to match the executor — they
 * never hit the wire, so their templates never resolve and shouldn't
 * contribute to the dependency graph either.
 */
export function collectRequestTemplateStrings(request: Request): string[] {
  const out: string[] = [];

  // ── URL ──
  if (request.url) out.push(request.url);

  // ── Query params (key + value) ──
  for (const p of request.params) {
    if (p.enabled === false) continue;
    if (p.key) out.push(p.key);
    if (p.value) out.push(p.value);
  }

  // ── Headers (key + value) ──
  for (const h of request.headers) {
    if (h.enabled === false) continue;
    if (h.key) out.push(h.key);
    if (h.value) out.push(h.value);
  }

  // ── Auth ──
  switch (request.auth.type) {
    case 'none':
    case 'inherit':
      break;
    case 'basic':
      if (request.auth.username) out.push(request.auth.username);
      if (request.auth.password) out.push(request.auth.password);
      break;
    case 'bearer':
      if (request.auth.token) out.push(request.auth.token);
      break;
    case 'api-key':
      if (request.auth.key) out.push(request.auth.key);
      if (request.auth.value) out.push(request.auth.value);
      break;
    case 'oauth2':
      // OAuth2 config fields are not user-templated — the credential
      // ref is an opaque handle; the tokens are fetched, not templated.
      break;
    case 'aws-sigv4':
      // Every SigV4 field is templatable — `{{vault.aws_secret}}` is
      // the expected idiom for the key material.
      if (request.auth.accessKeyId) out.push(request.auth.accessKeyId);
      if (request.auth.secretAccessKey) out.push(request.auth.secretAccessKey);
      if (request.auth.sessionToken) out.push(request.auth.sessionToken);
      if (request.auth.service) out.push(request.auth.service);
      if (request.auth.region) out.push(request.auth.region);
      break;
    case 'digest':
      if (request.auth.username) out.push(request.auth.username);
      if (request.auth.password) out.push(request.auth.password);
      break;
  }

  // ── Body ──
  // Exhaustive over the discriminated union — anything missed here
  // silently disappears from the dependency graph + the resolvability
  // gate. The compiler enforces exhaustion via the `never` assignment
  // on the default branch.
  const body = request.body;
  switch (body.type) {
    case 'none':
      break;
    case 'json':
    case 'xml':
    case 'text':
      if (body.content) out.push(body.content);
      break;
    case 'graphql':
      if (body.content) out.push(body.content);
      if (body.graphqlVariables) out.push(body.graphqlVariables);
      break;
    case 'form':
      for (const part of body.formParts) {
        if (part.enabled === false) continue;
        if (part.key) out.push(part.key);
        if (part.value) out.push(part.value);
      }
      break;
    case 'multipart':
      for (const part of body.multipartParts) {
        if (part.enabled === false) continue;
        if (part.name) out.push(part.name);
        if (part.kind === 'text' && part.value) out.push(part.value);
      }
      break;
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
    }
  }

  return out;
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
    auth: request.auth,
    credentialsMode: request.credentialsMode ?? null,
    followRedirects: request.followRedirects ?? null,
    sslVerification: request.sslVerification ?? null,
    tlsMinVersion: request.tlsMinVersion ?? null,
    tlsMaxVersion: request.tlsMaxVersion ?? null,
    tlsCipherSuites: request.tlsCipherSuites ?? null,
    allowHttp2: request.allowHttp2 ?? null,
    resolveToAddress: request.resolveToAddress ?? null,
    clientCertificateRef: request.clientCertificateRef ?? null,
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
