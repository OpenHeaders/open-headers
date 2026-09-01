/**
 * Request resolution — turns a `Request` draft into the wire-ready
 * `ResolvedRequest` shape: resolvability gate, template substitution
 * across URL / params / headers / body, auth folding, TOTP usage
 * tracking, and the default Content-Type fill.
 */

import type {
  AsapCredentials,
  AwsSigV4Credentials,
  EdgeGridCredentials,
  HawkCredentials,
  JwtCredentials,
  OAuth1Credentials,
} from '@openheaders/core/auth-signing';
import type {
  CredentialsMode,
  ExecutedAuthAttribution,
  HttpMethod,
  Request,
  RequestBody,
  VaultSecretTotp,
} from '@openheaders/core/types';
import { isRequestResolvable } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { collectionUidForRequest, resolveRequestAuth } from '@openheaders/oracle/live/request-exec/ancestor-chain';
import type { ExecuteRequestOptions } from './api';
import { applyAuth } from './auth';
import { buildResolvedBody, defaultContentType } from './body';
import { buildResolver } from './scope';

export interface ResolvedRequest {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  /**
   * Query params kept as a structured list — NOT yet folded into `url`.
   * Resolved (templates substituted) and auth-augmented (api-key /
   * oauth2 `sendAs:'query'` push their entries here), but appended to
   * the URL only at the wire in {@link executeResolved}. Carrying them
   * structured this far is what lets a pre-request script read them off
   * the snapshot and replace them via a `params` mutation — symmetric
   * with how `headers` round-trip through scripts.
   */
  params: Array<{ key: string; value: string }>;
  body: RequestBody;
  /** Wire-level cookie policy. `'omit'` unless the request opts into `'include'`. */
  credentialsMode: CredentialsMode;
  /**
   * Redirect policy forwarded to `fetch`. `false` maps to `'manual'`,
   * `undefined`/`true` map to `'follow'`. See the `followRedirects`
   * field on `Request` for the architectural note about the missing
   * max-redirects cap.
   */
  followRedirects?: boolean;
  /**
   * Wall-clock ceiling (ms) on the whole round-trip — the wire layer
   * arms an abort deadline spanning connect, response, and body read.
   * Absent = no per-request ceiling. The response size cap is NOT
   * carried here: on the browser runtime it stays the app-wide user
   * setting, read per send at the wire.
   */
  timeoutMs?: number;
  /**
   * AWS SigV4 credentials, templates already resolved — present only
   * when the effective auth is an enabled `aws-sigv4` config. Signing
   * happens at the wire in {@link executeResolved}, after the
   * pre-request script has mutated the request and the params have
   * folded into the URL — twin of the oracle resolver's carry.
   */
  awsSigV4?: AwsSigV4Credentials;
  /**
   * OAuth 1.0a credentials, templates already resolved — present only
   * when the effective auth is an enabled `oauth1` config. Like SigV4,
   * signing happens at the wire in {@link executeResolved}, after the
   * pre-request script has mutated the request and the params have
   * folded into the URL — twin of the oracle resolver's carry.
   */
  oauth1?: OAuth1Credentials;
  /**
   * Hawk credentials, templates already resolved — present only when
   * the effective auth is an enabled `hawk` config. Like SigV4 and
   * OAuth1, signing happens at the wire in {@link executeResolved},
   * after the pre-request script has mutated the request and the
   * params have folded into the URL — twin of the oracle resolver's
   * carry. `includePayloadHash` opts the executor into the payload
   * integrity hash.
   */
  hawk?: HawkCredentials & { includePayloadHash?: boolean };
  /**
   * EdgeGrid credentials, templates already resolved — present only
   * when the effective auth is an enabled `edgegrid` config. Signs at
   * the wire in {@link executeResolved} like the other signing schemes
   * — twin of the oracle resolver's carry.
   */
  edgegrid?: EdgeGridCredentials;
  /**
   * ASAP config, templates already resolved — present only when the
   * effective auth is an enabled `asap` config. The token mints at
   * the wire in {@link executeResolved} with a per-send `jti` — twin
   * of the oracle resolver's carry.
   */
  asap?: AsapCredentials;
  /**
   * JWT Bearer config, templates already resolved — present only when
   * the effective auth is an enabled `jwt` config. The token mints at
   * the wire in {@link executeResolved} (the send-time clock stamps
   * `iat`/`exp` when a lifetime is set) — twin of the oracle
   * resolver's carry.
   */
  jwt?: JwtCredentials;
  /** The auth this send applies and its source — resolve-time
   *  attribution the executor stamps on the snapshot; absent when the
   *  request's own auth is `none`. Twin of the oracle's carry. */
  auth?: ExecutedAuthAttribution;
  // auth folds into `url` + `headers`; params ride structured to the wire.
}

/** Tagged error thrown from {@link resolveRequest} when any `{{ref}}`
 *  in the draft can't be resolved against the current scopes. Caught
 *  by {@link executeRequestDraft} and turned into an `errorSnapshot`
 *  with a stable `error` message the UI matches on. Same architectural
 *  discipline as the DNR compile gate — we refuse to ship literal
 *  `{{env.var}}` strings on the wire. */
export class UnresolvedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedRequestError';
  }
}

/**
 * One TOTP vault entry the resolved request used. Carries the code
 * (so the cooldown gate can match against the recently-used code) and
 * the entry's `period` (so {@link recordTotpUsage} can compute the
 * window-end deadline). `name` doubles as the cooldown-store key
 * partition.
 */
export interface TotpUsage {
  name: string;
  code: string;
  period: number;
}

export interface ResolvedRequestOutcome {
  resolved: ResolvedRequest;
  /** Every TOTP vault entry referenced by the resolved request. Empty
   *  when no `{{vault.X}}` template hit a kind:'totp' entry. */
  totpUsed: ReadonlyArray<TotpUsage>;
}

export async function resolveRequest(
  request: Request,
  options: ExecuteRequestOptions,
): Promise<ResolvedRequestOutcome> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId, options.stepCaptures);
  // The collection scope reads off the same ancestor chain the auth
  // walk uses — the tree index, never the request's stored path.
  const context = {
    collectionId: collectionUidForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };

  // `inherit` resolves against the ancestor chain BEFORE the
  // resolvability gate — the inherited config's own templates (a
  // collection-level `{{auth_token}}` bearer) must pass the same gate
  // explicit request auth does, or a literal `{{ref}}` ships on the
  // wire. A disabled inherit resolves too (the attribution names what
  // was suspended); `applyAuth` skips the disabled contribution whole.
  // Twin of the oracle resolver's leg (`resolve-request.ts`).
  const { auth: effectiveAuth, attribution: authAttribution } = resolveRequestAuth(request, scope.workspaceId);
  const gated: Request = { ...request, auth: effectiveAuth };

  // Architectural gate: refuse to dispatch when any `{{ref}}` in the
  // draft can't be resolved. Mirrors the DNR compile pipeline's
  // `getUnresolvableRuleUids` filter — shipping literal `{{env.var}}`
  // on the wire is almost never the user's intent. `isRequestResolvable`
  // excludes reserved-namespace errors (`{{dynamic.X}}`) so they don't
  // block until that feature ships; `{{file.X}}` resolves here (the file
  // registry is fed above) and only blocks when the file is missing.
  const resolvable = isRequestResolvable(
    gated,
    (name) => resolver.resolve(name, context),
    (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
  );
  if (!resolvable) {
    throw new UnresolvedRequestError(
      'Request has unresolved variables. Define them in vault, environment, collection, workspace, or a live workflow before sending.',
    );
  }

  // Track every kind:'totp' vault entry referenced during this resolve.
  // Index TOTP entries by name once so the per-template scan is O(1).
  // `scope.vault` is the per-workspace snapshot when `options.workspaceId`
  // is set — guards against a vault rotation between buildResolver and
  // here, and keeps cross-workspace dispatches honest.
  const totpEntries = new Map<string, VaultSecretTotp>();
  for (const s of scope.vault.secrets) {
    if (s.kind === 'totp') totpEntries.set(s.name, s);
  }
  const totpUsed = new Map<string, TotpUsage>();

  const resolveStr = (s: string): string => {
    const result = resolveTemplate(
      s,
      (name) => resolver.resolve(name, context),
      (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
    );
    if (totpEntries.size > 0) {
      for (const v of result.variables) {
        if (!v.resolved || v.scope !== 'vault' || !v.value) continue;
        // Template-variable names carry the namespace prefix when the
        // user wrote `{{vault.X}}`; strip it before matching the bare
        // entry name. Flat `{{X}}` resolves the same way but the name
        // arrives unprefixed.
        const bareName = v.name.startsWith('vault.') ? v.name.slice('vault.'.length) : v.name;
        const entry = totpEntries.get(bareName);
        if (entry) totpUsed.set(bareName, { name: bareName, code: v.value, period: entry.period });
      }
    }
    return result.result;
  };

  // ── URL + query params ──────────────────────────────────────────
  // The base URL keeps any query string the user typed inline; the
  // structured params (enabled, non-empty key, resolved) ride separately
  // and are folded into the URL only at the wire (`executeResolved`), so
  // a pre-request script can read + replace them first.
  const resolvedUrl = resolveStr(request.url);
  const enabledParams = request.params
    .filter((p) => (p.enabled ?? true) && p.key.trim())
    .map((p) => ({ key: resolveStr(p.key), value: resolveStr(p.value) }));

  // ── Headers ─────────────────────────────────────────────────────
  const headers: Array<{ key: string; value: string }> = request.headers
    .filter((h) => (h.enabled ?? true) && h.key.trim())
    .map((h) => ({ key: resolveStr(h.key), value: resolveStr(h.value) }));

  // ── Auth folds into headers/params ──────────────────────────────
  // api-key-in-query + oauth2 `sendAs:'query'` push onto `enabledParams`,
  // so they ride the structured param list to the wire alongside the
  // user's params.
  await applyAuth(effectiveAuth, headers, enabledParams, resolveStr);

  // SigV4 credentials resolve here but sign at the wire — see
  // {@link ResolvedRequest.awsSigV4}.
  const awsSigV4: AwsSigV4Credentials | undefined =
    effectiveAuth.type === 'aws-sigv4' && !effectiveAuth.disabled
      ? {
          accessKeyId: resolveStr(effectiveAuth.accessKeyId),
          secretAccessKey: resolveStr(effectiveAuth.secretAccessKey),
          ...(effectiveAuth.sessionToken ? { sessionToken: resolveStr(effectiveAuth.sessionToken) } : {}),
          service: resolveStr(effectiveAuth.service),
          region: resolveStr(effectiveAuth.region),
          ...(effectiveAuth.addTo ? { addTo: effectiveAuth.addTo } : {}),
        }
      : undefined;

  // OAuth1 credentials resolve here but sign at the wire — see
  // {@link ResolvedRequest.oauth1}.
  const oauth1: OAuth1Credentials | undefined =
    effectiveAuth.type === 'oauth1' && !effectiveAuth.disabled
      ? {
          consumerKey: resolveStr(effectiveAuth.consumerKey),
          consumerSecret: resolveStr(effectiveAuth.consumerSecret),
          ...(effectiveAuth.token ? { token: resolveStr(effectiveAuth.token) } : {}),
          ...(effectiveAuth.tokenSecret ? { tokenSecret: resolveStr(effectiveAuth.tokenSecret) } : {}),
          signatureMethod: effectiveAuth.signatureMethod,
          ...(effectiveAuth.privateKey ? { privateKey: resolveStr(effectiveAuth.privateKey) } : {}),
          ...(effectiveAuth.includeBodyHash === true ? { includeBodyHash: true } : {}),
          paramsLocation: effectiveAuth.paramsLocation,
          ...(effectiveAuth.realm !== undefined ? { realm: resolveStr(effectiveAuth.realm) } : {}),
        }
      : undefined;

  // Hawk credentials resolve here but sign at the wire — see
  // {@link ResolvedRequest.hawk}.
  const hawk: (HawkCredentials & { includePayloadHash?: boolean }) | undefined =
    effectiveAuth.type === 'hawk' && !effectiveAuth.disabled
      ? {
          authId: resolveStr(effectiveAuth.authId),
          authKey: resolveStr(effectiveAuth.authKey),
          algorithm: effectiveAuth.algorithm,
          ...(effectiveAuth.ext ? { ext: resolveStr(effectiveAuth.ext) } : {}),
          ...(effectiveAuth.app ? { app: resolveStr(effectiveAuth.app) } : {}),
          ...(effectiveAuth.dlg ? { dlg: resolveStr(effectiveAuth.dlg) } : {}),
          ...(effectiveAuth.includePayloadHash === true ? { includePayloadHash: true } : {}),
        }
      : undefined;

  // EdgeGrid credentials resolve here but sign at the wire — see
  // {@link ResolvedRequest.edgegrid}.
  const edgegrid: EdgeGridCredentials | undefined =
    effectiveAuth.type === 'edgegrid' && !effectiveAuth.disabled
      ? {
          clientToken: resolveStr(effectiveAuth.clientToken),
          accessToken: resolveStr(effectiveAuth.accessToken),
          clientSecret: resolveStr(effectiveAuth.clientSecret),
          ...(effectiveAuth.headersToSign ? { headersToSign: resolveStr(effectiveAuth.headersToSign) } : {}),
          ...(effectiveAuth.maxBodySize !== undefined ? { maxBodySize: effectiveAuth.maxBodySize } : {}),
        }
      : undefined;

  // ASAP config resolves here but mints at the wire — see
  // {@link ResolvedRequest.asap}.
  const asap: AsapCredentials | undefined =
    effectiveAuth.type === 'asap' && !effectiveAuth.disabled
      ? {
          algorithm: effectiveAuth.algorithm,
          issuer: resolveStr(effectiveAuth.issuer),
          audience: resolveStr(effectiveAuth.audience),
          keyId: resolveStr(effectiveAuth.keyId),
          privateKey: resolveStr(effectiveAuth.privateKey),
          ...(effectiveAuth.subject ? { subject: resolveStr(effectiveAuth.subject) } : {}),
          ...(effectiveAuth.claims ? { claims: resolveStr(effectiveAuth.claims) } : {}),
          ...(effectiveAuth.expiresInSeconds !== undefined ? { expiresInSeconds: effectiveAuth.expiresInSeconds } : {}),
        }
      : undefined;

  // JWT Bearer config resolves here but mints at the wire — see
  // {@link ResolvedRequest.jwt}.
  const jwt: JwtCredentials | undefined =
    effectiveAuth.type === 'jwt' && !effectiveAuth.disabled
      ? {
          algorithm: effectiveAuth.algorithm,
          secret: resolveStr(effectiveAuth.secret),
          ...(effectiveAuth.secretBase64 === true ? { secretBase64: true } : {}),
          privateKey: resolveStr(effectiveAuth.privateKey),
          payload: resolveStr(effectiveAuth.payload),
          ...(effectiveAuth.headers !== undefined ? { headers: resolveStr(effectiveAuth.headers) } : {}),
          ...(effectiveAuth.headerPrefix !== undefined ? { headerPrefix: resolveStr(effectiveAuth.headerPrefix) } : {}),
          addTo: effectiveAuth.addTo,
          ...(effectiveAuth.expiresInSeconds !== undefined ? { expiresInSeconds: effectiveAuth.expiresInSeconds } : {}),
        }
      : undefined;

  // ── Body ────────────────────────────────────────────────────────
  const resolvedBody = buildResolvedBody(request.body, resolveStr);

  // Ensure a Content-Type header matches the body shape if the user
  // didn't set one. Skipped for `none` (no body), `form` (set by the
  // URLSearchParams path below), and `multipart` (set by the browser
  // with a generated boundary that we MUST NOT override).
  if (
    resolvedBody.type !== 'none' &&
    resolvedBody.type !== 'form' &&
    resolvedBody.type !== 'multipart' &&
    !headers.some((h) => h.key.toLowerCase() === 'content-type')
  ) {
    const ct = defaultContentType(resolvedBody);
    if (ct) headers.push({ key: 'Content-Type', value: ct });
  }

  return {
    resolved: {
      method: request.method,
      url: resolvedUrl,
      headers,
      params: enabledParams,
      body: resolvedBody,
      // Cookie-jar policy. `'omit'` is the safe default when the request
      // doesn't explicitly opt in — even with `<all_urls>` granted, we
      // never ride the browser's cookie jar by accident. See ARCHITECTURE.md §14.
      credentialsMode: request.credentialsMode === 'include' ? 'include' : 'omit',
      followRedirects: request.followRedirects,
      timeoutMs: request.timeoutMs,
      ...(awsSigV4 ? { awsSigV4 } : {}),
      ...(oauth1 ? { oauth1 } : {}),
      ...(hawk ? { hawk } : {}),
      ...(edgegrid ? { edgegrid } : {}),
      ...(asap ? { asap } : {}),
      ...(jwt ? { jwt } : {}),
      ...(authAttribution !== undefined ? { auth: authAttribution } : {}),
    },
    totpUsed: [...totpUsed.values()],
  };
}
