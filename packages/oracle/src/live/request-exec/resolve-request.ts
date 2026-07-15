/**
 * Request resolution — turns a domain {@link Request} into a
 * {@link ResolvedRequest} ready for the wire: every `{{ref}}` template
 * substituted against the 4-scope chain (vault > environment >
 * collection > workspace), auth folded into headers/query, query params
 * appended, and a default Content-Type chosen for the body shape.
 *
 * Pure + host-neutral. The one host-owned concern — refreshing an
 * expired OAuth token — is injected as the optional {@link OAuthRefreshFn}
 * hook: the browser SW passes its own flow runner's refresh leg; node
 * hosts inject `buildRefreshOAuthHook` from `./oauth-refresh`. A caller
 * that omits the hook attaches the last-synced bundle as-is.
 */

import type { AwsSigV4Credentials, DigestCredentials } from '@openheaders/core/auth-signing';
import { isExpired as isOAuthTokenExpired, type OAuth2TokenBundle } from '@openheaders/core/oauth';
import type {
  AuthConfig,
  FormField,
  HttpMethod,
  MultipartPart,
  Request,
  RequestBody,
  TlsVersion,
  Vault,
  VaultSecretTotp,
} from '@openheaders/core/types';
import { appendQueryParams, encodeBase64Bytes, isRequestResolvable } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { getTokenBundle } from '../../entity/oauth-token-store';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { resolveInheritedAuth } from './ancestor-chain';
import { buildResolver } from './resolver-scope';

/** Resolved, wire-ready request. Auth + params are folded into `url`
 *  + `headers`; the body is the resolved domain union. */
export interface ResolvedRequest {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: RequestBody;
  /** Wire-level cookie policy. `'omit'` unless the request opts into `'include'`. */
  credentialsMode: 'omit' | 'include';
  /** `false` maps to `'manual'`; `undefined`/`true` map to `'follow'`. */
  followRedirects?: boolean;
  /** `false` → the transport skips TLS certificate verification;
   *  `undefined`/`true` → verify (the runtime default). */
  sslVerification?: boolean;
  /** TLS negotiation floor; absent → the runtime default (1.2). */
  tlsMinVersion?: TlsVersion;
  /** TLS negotiation ceiling; absent → the runtime default (1.3). */
  tlsMaxVersion?: TlsVersion;
  /** OpenSSL-format cipher list; absent → the runtime's default suites. */
  tlsCipherSuites?: string;
  /** Offer HTTP/2 on secure connections (the server picks); absent /
   *  `false` → HTTP/1.1 only. */
  allowHttp2?: boolean;
  /** Address the hostname resolves to at connect time; SNI / Host /
   *  cert verification keep the original hostname. Absent → DNS. */
  resolveToAddress?: string;
  /** Vault `client-certificate` entry NAME to present in the TLS
   *  handshake. Carried even when unresolved on this device — the
   *  transport owns that failure. Absent → no client certificate. */
  clientCertificateRef?: string;
  /** PEM material resolved from the vault entry named by
   *  `clientCertificateRef`; absent when the ref is absent OR the
   *  entry doesn't exist on this device. */
  clientCertificatePem?: string;
  /** See {@link clientCertificatePem}. */
  clientCertificateKeyPem?: string;
  /** See {@link clientCertificatePem}. */
  clientCertificatePassphrase?: string;
  /** HTTP(S) proxy the send tunnels through; absent → direct. */
  proxyUrl?: string;
  /** Vault string entry NAME holding the proxy's `user:password`.
   *  Carried even when unresolved on this device — the transport owns
   *  that failure. Absent → unauthenticated proxy. */
  proxyCredentialRef?: string;
  /** The `user:password` value resolved from the vault entry named by
   *  `proxyCredentialRef`; absent when the ref is absent OR the entry
   *  doesn't exist on this device. */
  proxyCredential?: string;
  /** Local socket (Unix domain socket path or Windows named pipe) the
   *  send dials instead of a TCP connection; absent → TCP. */
  unixSocketPath?: string;
  /** Runtime-local cookie-jar key (the workspace id) — present only
   *  when the request opted into the jar. Absent → no jar. */
  cookieJarKey?: string;
  /** Per-request round-trip ceiling (ms). A workflow step's own
   *  per-attempt timeout takes precedence at execute time. */
  timeoutMs?: number;
  /** Per-request response-body cap (bytes); overrides the executor's
   *  default when present. */
  maxResponseBytes?: number;
  /** Redirect-chain cap; absent → the transport's default (20). */
  maxRedirects?: number;
  /** Keep the original method + body across 301/302/303 redirects. */
  followOriginalHttpMethod?: boolean;
  /** Keep the Authorization header on cross-origin redirect hops. */
  followAuthorizationHeader?: boolean;
  /**
   * AWS SigV4 credentials, templates already resolved — present only
   * when the effective auth is an enabled `aws-sigv4` config. Signing
   * happens at EXECUTE time (the wire executor derives the
   * `Authorization` / `X-Amz-Date` headers over the final wire shape),
   * never here: a resolve-time signature would be invalidated by any
   * pre-request script mutation.
   */
  awsSigV4?: AwsSigV4Credentials;
  /**
   * HTTP digest credentials, templates already resolved — present only
   * when the effective auth is an enabled `digest` config. Nothing is
   * computable here: the scheme is challenge/response, so the honoring
   * transport (node) answers the target's 401 `WWW-Authenticate`
   * challenge with one authorized resend of that hop. Transports whose
   * network stack can't drive the second leg (the browser SW) ignore
   * the carry and the target's 401 is the actionable signal.
   */
  digest?: DigestCredentials;
}

/** One TOTP vault entry the resolved request used. Carries the code (so
 *  the cooldown gate can match the recently-used code) and the entry's
 *  `period` (so usage recording can compute the window-end deadline). */
export interface TotpUsage {
  name: string;
  code: string;
  period: number;
}

export interface ResolvedRequestOutcome {
  resolved: ResolvedRequest;
  /** Every TOTP vault entry referenced by the resolved request. Empty
   *  when no template hit a kind:'totp' entry. */
  totpUsed: ReadonlyArray<TotpUsage>;
}

/** Refresh an expired OAuth credential, returning a fresh bundle (or
 *  null when refresh is unavailable). Injected per host. */
export type OAuthRefreshFn = (auth: Extract<AuthConfig, { type: 'oauth2' }>) => Promise<OAuth2TokenBundle | null>;

export interface ResolveRequestOptions {
  workspaceId?: string;
  /** Tri-state: string pins an env, explicit `null` resolves with no
   *  environment, absent defers to the scope's active pointer. */
  environmentId?: string | null;
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Host hook to refresh an expired OAuth token before attaching it. */
  refreshOAuth?: OAuthRefreshFn;
}

/** Thrown when any `{{ref}}` in the request can't be resolved against
 *  the current scopes — refuses to ship a literal `{{env.var}}` on the
 *  wire, mirroring the DNR compile gate. */
export class UnresolvedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedRequestError';
  }
}

/**
 * Find the collection a request belongs to. Requests live under
 * `requests/<coll>/...`; we look in the REQUEST collection tree, keyed
 * on the same workspace pin the resolver scope used.
 */
function collectionIdForRequest(request: Request, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const hit = collections.find((c) => request.path.startsWith(`${c.path}/`));
  return hit?.uid;
}

export async function resolveRequest(
  request: Request,
  options: ResolveRequestOptions,
): Promise<ResolvedRequestOutcome> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId, options.stepCaptures);
  const context = {
    collectionId: collectionIdForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };

  // `inherit` resolves against the ancestor chain BEFORE the
  // resolvability gate — the inherited config's own templates (a
  // collection-level `{{auth_token}}` bearer) must pass the same gate
  // explicit request auth does, or a literal `{{ref}}` ships on the
  // wire. A disabled inherit stays as-is: `applyAuth` skips it whole.
  const effectiveAuth =
    request.auth.type === 'inherit' && !request.auth.disabled
      ? resolveInheritedAuth(request, scope.workspaceId)
      : request.auth;
  const gated: Request = { ...request, auth: effectiveAuth };

  // Architectural gate: refuse to dispatch when any `{{ref}}` can't be
  // resolved.
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
  const totpEntries = indexTotpEntries(scope.vault);
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
        // Names carry the `vault.` prefix when the user wrote
        // `{{vault.X}}`; strip it before matching the bare entry name.
        const bareName = v.name.startsWith('vault.') ? v.name.slice('vault.'.length) : v.name;
        const entry = totpEntries.get(bareName);
        if (entry) totpUsed.set(bareName, { name: bareName, code: v.value, period: entry.period });
      }
    }
    return result.result;
  };

  // ── URL with query params ──
  let resolvedUrl = resolveStr(request.url);
  const enabledParams = request.params
    .filter((p) => (p.enabled ?? true) && p.key.trim())
    .map((p) => ({ key: resolveStr(p.key), value: resolveStr(p.value) }));

  // ── Headers ──
  const headers: Array<{ key: string; value: string }> = request.headers
    .filter((h) => (h.enabled ?? true) && h.key.trim())
    .map((h) => ({ key: resolveStr(h.key), value: resolveStr(h.value) }));

  // ── Auth folds into headers/params ──
  await applyAuth(effectiveAuth, headers, enabledParams, resolveStr, {
    workspaceId: scope.workspaceId ?? undefined,
    refreshOAuth: options.refreshOAuth,
  });

  // SigV4 credentials resolve here but sign at execute time — see
  // {@link ResolvedRequest.awsSigV4}.
  const awsSigV4: AwsSigV4Credentials | undefined =
    effectiveAuth.type === 'aws-sigv4' && !effectiveAuth.disabled
      ? {
          accessKeyId: resolveStr(effectiveAuth.accessKeyId),
          secretAccessKey: resolveStr(effectiveAuth.secretAccessKey),
          ...(effectiveAuth.sessionToken ? { sessionToken: resolveStr(effectiveAuth.sessionToken) } : {}),
          service: resolveStr(effectiveAuth.service),
          region: resolveStr(effectiveAuth.region),
        }
      : undefined;

  // Digest credentials resolve here but answer the challenge at the
  // wire — see {@link ResolvedRequest.digest}.
  const digest: DigestCredentials | undefined =
    effectiveAuth.type === 'digest' && !effectiveAuth.disabled
      ? { username: resolveStr(effectiveAuth.username), password: resolveStr(effectiveAuth.password) }
      : undefined;

  // Append params after auth — api-key-in-query lives in enabledParams.
  resolvedUrl = appendQueryParams(resolvedUrl, enabledParams);

  // ── Client certificate (ref → PEM against the local vault) ──
  const clientCertificate = resolveClientCertificate(request.clientCertificateRef, scope.vault);

  // ── Proxy credential (ref → user:password against the local vault) ──
  const proxyCredential = resolveProxyCredential(request.proxyCredentialRef, scope.vault);

  // ── Body ──
  const resolvedBody = buildResolvedBody(request.body, resolveStr);

  // Ensure a Content-Type matches the body shape if the user didn't set
  // one. Skipped for `none`, `form` (set by the urlencoded encoder), and
  // `multipart` (set by the host with a generated boundary).
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
      body: resolvedBody,
      credentialsMode: request.credentialsMode === 'include' ? 'include' : 'omit',
      followRedirects: request.followRedirects,
      sslVerification: request.sslVerification,
      tlsMinVersion: request.tlsMinVersion,
      tlsMaxVersion: request.tlsMaxVersion,
      tlsCipherSuites: request.tlsCipherSuites,
      allowHttp2: request.allowHttp2,
      resolveToAddress: request.resolveToAddress,
      ...clientCertificate,
      proxyUrl: request.proxyUrl,
      ...proxyCredential,
      unixSocketPath: request.unixSocketPath,
      // The jar is keyed by the workspace the run resolved against, so
      // sessions never bleed across workspaces. An unpinned send
      // resolved against the runtime-Active workspace's mirrors, so its
      // jar key is that workspace's id — the same key the jar
      // inspection RPCs resolve an omitted workspaceId to.
      ...(request.cookieJar === true ? { cookieJarKey: scope.workspaceId ?? getActiveWorkspaceId() } : {}),
      timeoutMs: request.timeoutMs,
      maxResponseBytes: request.maxResponseBytes,
      maxRedirects: request.maxRedirects,
      followOriginalHttpMethod: request.followOriginalHttpMethod,
      followAuthorizationHeader: request.followAuthorizationHeader,
      ...(awsSigV4 ? { awsSigV4 } : {}),
      ...(digest ? { digest } : {}),
    },
    totpUsed: [...totpUsed.values()],
  };
}

/**
 * Resolve a `clientCertificateRef` against the local vault. The ref
 * always passes through when set — even unresolved — so the honoring
 * transport can fail the send loudly instead of silently dialing
 * without a certificate; the PEM material attaches only when the named
 * entry exists on this device with the right kind.
 */
function resolveClientCertificate(
  ref: string | undefined,
  vault: Vault,
): Pick<
  ResolvedRequest,
  'clientCertificateRef' | 'clientCertificatePem' | 'clientCertificateKeyPem' | 'clientCertificatePassphrase'
> {
  if (ref === undefined) return {};
  const entry = vault.secrets.find((s) => s.kind === 'client-certificate' && s.name === ref);
  if (!entry || entry.kind !== 'client-certificate') return { clientCertificateRef: ref };
  return {
    clientCertificateRef: ref,
    clientCertificatePem: entry.cert,
    clientCertificateKeyPem: entry.key,
    ...(entry.passphrase !== undefined ? { clientCertificatePassphrase: entry.passphrase } : {}),
  };
}

/**
 * Resolve a `proxyCredentialRef` against the local vault. Same contract
 * as {@link resolveClientCertificate}: the ref always passes through
 * when set — even unresolved — so the honoring transport can fail the
 * send loudly instead of silently dialing the proxy unauthenticated;
 * the `user:password` value attaches only when a string entry with that
 * name exists on this device.
 */
function resolveProxyCredential(
  ref: string | undefined,
  vault: Vault,
): Pick<ResolvedRequest, 'proxyCredentialRef' | 'proxyCredential'> {
  if (ref === undefined) return {};
  const entry = vault.secrets.find((s) => s.kind === 'string' && s.name === ref);
  if (!entry || entry.kind !== 'string') return { proxyCredentialRef: ref };
  return { proxyCredentialRef: ref, proxyCredential: entry.value };
}

function indexTotpEntries(vault: Vault): Map<string, VaultSecretTotp> {
  const out = new Map<string, VaultSecretTotp>();
  for (const s of vault.secrets) {
    if (s.kind === 'totp') out.set(s.name, s);
  }
  return out;
}

interface ApplyAuthOptions {
  workspaceId?: string;
  refreshOAuth?: OAuthRefreshFn;
}

/**
 * Auth contributions REPLACE a same-key user header rather than
 * duplicating it (duplicate `Authorization` values would combine on
 * the wire into garbage). The Headers tab mirrors this: a user row
 * that collides with the auth-generated header renders struck through.
 */
function setAuthHeader(headers: Array<{ key: string; value: string }>, key: string, value: string): void {
  const lower = key.toLowerCase();
  for (let i = headers.length - 1; i >= 0; i--) {
    if (headers[i].key.toLowerCase() === lower) headers.splice(i, 1);
  }
  headers.push({ key, value });
}

export async function applyAuth(
  auth: AuthConfig,
  headers: Array<{ key: string; value: string }>,
  params: Array<{ key: string; value: string }>,
  resolveStr: (s: string) => string,
  opts: ApplyAuthOptions,
): Promise<void> {
  // `disabled` suspends the contribution without discarding the config
  // (the Headers table's auth-row checkbox drives it).
  if (auth.disabled || auth.type === 'none' || auth.type === 'inherit') return;
  if (auth.type === 'basic') {
    const u = resolveStr(auth.username);
    const p = resolveStr(auth.password);
    // RFC 7617 mandates UTF-8. Encode the pair as UTF-8 bytes then
    // base64 the bytes so non-ASCII credentials (`pässwörd`) don't throw.
    const token = encodeBase64Bytes(new TextEncoder().encode(`${u}:${p}`));
    setAuthHeader(headers, 'Authorization', `Basic ${token}`);
    return;
  }
  if (auth.type === 'bearer') {
    setAuthHeader(headers, 'Authorization', `Bearer ${resolveStr(auth.token)}`);
    return;
  }
  if (auth.type === 'api-key') {
    const k = resolveStr(auth.key);
    const v = resolveStr(auth.value);
    if (auth.in === 'header') setAuthHeader(headers, k, v);
    else params.push({ key: k, value: v });
    return;
  }
  if (auth.type === 'aws-sigv4') {
    // Nothing folds here — SigV4 signs the FINAL wire shape at execute
    // time (see ResolvedRequest.awsSigV4); the resolver only resolves
    // the credential templates.
    return;
  }
  if (auth.type === 'digest') {
    // Nothing folds here either — digest is challenge/response, so the
    // honoring transport derives the Authorization header from the
    // target's 401 (see ResolvedRequest.digest); the resolver only
    // resolves the credential templates.
    return;
  }
  if (auth.type === 'oauth2') {
    // Access tokens live in the per-workspace token store. Fetch the
    // bundle, refresh if expired + a refresh token + a host refresh hook
    // are available, then attach `Authorization: <type> <access_token>`.
    // The hook owns its failure semantics: returning `null` means a
    // recoverable refresh failure (we attach the stale bundle so the
    // target's 401 is the actionable signal); throwing means an
    // unexpected error the caller should surface.
    let bundle = await getTokenBundle(auth.credentialRef, opts.workspaceId);
    if (bundle && isOAuthTokenExpired(bundle) && bundle.refreshToken && opts.refreshOAuth) {
      bundle = (await opts.refreshOAuth(auth)) ?? bundle;
    }
    if (bundle) {
      if (auth.sendAs === 'query') {
        params.push({ key: 'access_token', value: bundle.accessToken });
      } else {
        setAuthHeader(headers, 'Authorization', `${bundle.tokenType} ${bundle.accessToken}`);
      }
    }
  }
}

/**
 * Build the resolved body payload. Exhaustive over the discriminated
 * union — every variant runs its templatable fields through `resolveStr`
 * so the wire body never carries a literal `{{ref}}`. Disabled rows on
 * form / multipart are carried with `enabled: false` (the wire boundary
 * filters them) and skip `resolveStr` so they can't burn TOTP cooldown.
 */
export function buildResolvedBody(body: RequestBody, resolveStr: (s: string) => string): RequestBody {
  switch (body.type) {
    case 'none':
      return { type: 'none' };
    case 'json':
      return { type: 'json', content: resolveStr(body.content) };
    case 'xml':
      return { type: 'xml', content: resolveStr(body.content) };
    case 'text':
      return body.rawFormat !== undefined
        ? { type: 'text', content: resolveStr(body.content), rawFormat: body.rawFormat }
        : { type: 'text', content: resolveStr(body.content) };
    case 'graphql': {
      const variables = body.graphqlVariables !== undefined ? resolveStr(body.graphqlVariables) : undefined;
      return variables !== undefined
        ? { type: 'graphql', content: resolveStr(body.content), graphqlVariables: variables }
        : { type: 'graphql', content: resolveStr(body.content) };
    }
    case 'form': {
      const resolvedParts: FormField[] = body.formParts.map((part) => {
        if (part.enabled === false) return { ...part };
        return { ...part, key: resolveStr(part.key), value: resolveStr(part.value) };
      });
      return { type: 'form', formParts: resolvedParts };
    }
    case 'multipart': {
      const resolvedParts: MultipartPart[] = body.multipartParts.map((part) => {
        if (part.enabled === false) return part;
        const name = resolveStr(part.name);
        if (part.kind === 'text') {
          return { kind: 'text', uid: part.uid, name, value: resolveStr(part.value), enabled: part.enabled };
        }
        return { kind: 'file', uid: part.uid, name, fileRefs: part.fileRefs, enabled: part.enabled };
      });
      return { type: 'multipart', multipartParts: resolvedParts };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return { type: 'none' };
    }
  }
}

/**
 * Default Content-Type for the resolved body shape. `null` for variants
 * whose Content-Type is set elsewhere (`form`, `multipart`, `none`). For
 * `text` the rawFormat hint picks `text/javascript` / `text/html`.
 */
export function defaultContentType(body: RequestBody): string | null {
  switch (body.type) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'text':
      if (body.rawFormat === 'javascript') return 'text/javascript';
      if (body.rawFormat === 'html') return 'text/html';
      return 'text/plain';
    case 'graphql':
      return 'application/json';
    default:
      return null;
  }
}
