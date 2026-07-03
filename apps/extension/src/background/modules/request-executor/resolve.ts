/**
 * Request resolution — turns a `Request` draft into the wire-ready
 * `ResolvedRequest` shape: resolvability gate, template substitution
 * across URL / params / headers / body, auth folding, TOTP usage
 * tracking, and the default Content-Type fill.
 */

import type { CredentialsMode, HttpMethod, Request, RequestBody, VaultSecretTotp } from '@openheaders/core/types';
import { isRequestResolvable } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import type { ExecuteRequestOptions } from './api';
import { applyAuth } from './auth';
import { buildResolvedBody, defaultContentType } from './body';
import { buildResolver, collectionIdForRequest } from './scope';

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
  const context = {
    collectionId: collectionIdForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };

  // Architectural gate: refuse to dispatch when any `{{ref}}` in the
  // draft can't be resolved. Mirrors the DNR compile pipeline's
  // `getUnresolvableRuleUids` filter — shipping literal `{{env.var}}`
  // on the wire is almost never the user's intent. `isRequestResolvable`
  // excludes reserved-namespace errors (`{{dynamic.X}}`) so they don't
  // block until that feature ships; `{{file.X}}` resolves here (the file
  // registry is fed above) and only blocks when the file is missing.
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
  await applyAuth(request.auth, headers, enabledParams, resolveStr);

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
    },
    totpUsed: [...totpUsed.values()],
  };
}
