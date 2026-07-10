/**
 * Request resolution — turns a domain {@link Request} into a
 * {@link ResolvedRequest} ready for the wire: every `{{ref}}` template
 * substituted against the 4-scope chain (vault > environment >
 * collection > workspace), auth folded into headers/query, query params
 * appended, and a default Content-Type chosen for the body shape.
 *
 * Pure + host-neutral. The one platform-specific concern — refreshing an
 * expired OAuth token — is injected as the optional {@link OAuthRefreshFn}
 * hook: the browser SW passes its `chrome.identity` flow; the desktop
 * passes nothing for now and attaches the last-synced bundle as-is
 * (refresh-on-expired on Node is a later slice).
 */

import { isExpired as isOAuthTokenExpired, type OAuth2TokenBundle } from '@openheaders/core/oauth';
import type {
  AuthConfig,
  FormField,
  HttpMethod,
  MultipartPart,
  Request,
  RequestBody,
  Vault,
  VaultSecretTotp,
} from '@openheaders/core/types';
import { appendQueryParams, encodeBase64Bytes, isRequestResolvable } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { getTokenBundle } from '../../entity/oauth-token-store';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
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
  environmentId?: string;
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

  // Architectural gate: refuse to dispatch when any `{{ref}}` can't be
  // resolved.
  const resolvable = isRequestResolvable(
    request,
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
  await applyAuth(request.auth, headers, enabledParams, resolveStr, {
    workspaceId: scope.workspaceId ?? undefined,
    refreshOAuth: options.refreshOAuth,
  });

  // Append params after auth — api-key-in-query lives in enabledParams.
  resolvedUrl = appendQueryParams(resolvedUrl, enabledParams);

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
    },
    totpUsed: [...totpUsed.values()],
  };
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

async function applyAuth(
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
    headers.push({ key: 'Authorization', value: `Basic ${token}` });
    return;
  }
  if (auth.type === 'bearer') {
    headers.push({ key: 'Authorization', value: `Bearer ${resolveStr(auth.token)}` });
    return;
  }
  if (auth.type === 'api-key') {
    const k = resolveStr(auth.key);
    const v = resolveStr(auth.value);
    if (auth.in === 'header') headers.push({ key: k, value: v });
    else params.push({ key: k, value: v });
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
        headers.push({ key: 'Authorization', value: `${bundle.tokenType} ${bundle.accessToken}` });
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
