/**
 * Request completeness validation — shared between desktop and extension.
 *
 * Mirrors the rule-validation pattern: a pure function that answers the
 * single question "does this request have enough set to actually send?"
 *
 * Incomplete requests can still be saved and edited — they just can't
 * be executed. The executor rejects an empty URL at the wire boundary;
 * this helper lets upstream surfaces (Live Workflow steps, manual send
 * buttons, future test-runners) refuse to even try, and render the
 * right UI hint instead of a generic "Failed to fetch."
 *
 * Completeness rules:
 *   - URL required (non-empty after trim). A templated URL (`{{env.X}}`)
 *     counts as present — resolution happens at execute time.
 *   - Method is always set (schema enforces the picklist). No check needed.
 *   - Body has no must-fill-in fields — empty bodies are valid for every
 *     BodyType.
 *   - Auth per variant:
 *     · `none` / `inherit`            — always complete.
 *     · `basic`                        — `username` non-empty (password may be blank).
 *     · `bearer`                       — `token` non-empty.
 *     · `api-key`                      — `key` and `value` non-empty.
 *     · `oauth2`                       — schema already pins `credentialRef`,
 *                                        `tokenEndpoint`, `clientId` via
 *                                        `minLength(1)`, so any persisted
 *                                        OAuth2 config is structurally
 *                                        complete. Whether a TOKEN has
 *                                        been obtained is a runtime state
 *                                        (see oauth-token-store), not a
 *                                        request-completeness concern.
 */

import { collectRequestTemplateStrings } from '../live/request-scan';
import type { Request } from '../types/v5/request';
import type { ResolvedVariable } from '../types/v5/variable';
import { type ResolutionEnvSnapshot, resolveTemplate, type ScopedLookupFn } from '../variables';

/**
 * Returns `true` when the request has the minimum fields the executor
 * needs to dispatch. Works on `Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>`
 * too so pre-save editor drafts can be validated without faking storage fields.
 */
export function isRequestComplete(
  request: Request | Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>,
): boolean {
  if (!request.url?.trim()) return false;

  const auth = request.auth;
  switch (auth.type) {
    case 'none':
    case 'inherit':
      return true;
    case 'basic':
      // Password may legitimately be blank (some providers accept
      // username-only Basic auth); username is the non-negotiable bit.
      return auth.username.trim().length > 0;
    case 'bearer':
      return auth.token.trim().length > 0;
    case 'api-key':
      return auth.key.trim().length > 0 && auth.value.trim().length > 0;
    case 'oauth2':
      // Schema enforces credentialRef / tokenEndpoint / clientId each
      // non-empty. Token obtainment is a runtime state; we don't gate
      // completeness on "has the user authorized yet?" because the
      // request can still be dispatched (the API 401s and the user
      // sees that).
      return true;
  }
}

/**
 * Machine-readable reason a request is incomplete. `null` when
 * complete. Mirrors the shape of a `StructuralIssue` — lets upstream
 * validators (Live Workflow step-validator, request editor banner)
 * render a specific message instead of a boolean.
 */
export type RequestIncompleteReason =
  | 'missing-url'
  | 'basic-missing-username'
  | 'bearer-missing-token'
  | 'api-key-missing-key'
  | 'api-key-missing-value';

// ── Variable-resolution gating ─────────────────────────────────────

/**
 * Does every `{{...}}` reference in this request resolve against the
 * supplied lookups? Mirrors `isRuleResolvable` in `rule-validation` —
 * the executor refuses to dispatch when false, so literal `{{env.X}}`
 * never hits the wire.
 *
 * Reserved-namespace errors (`{{file.X}}` / `{{dynamic.X}}`) are
 * excluded from gating — those references are intentionally
 * unresolved until those features ship.
 *
 * Pure — no resolver instance required. Callers supply the same
 * lookup shape `resolveTemplate` takes; the helper can be used from
 * the extension background (request-executor, live-chain-adapter) and
 * the renderer (Send button gate, inline error) without coupling.
 */
export function isRequestResolvable(
  request: Request | Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>,
  lookup: (name: string) => ResolvedVariable | null,
  scopedLookup?: ScopedLookupFn,
  env?: ResolutionEnvSnapshot,
): boolean {
  // `collectRequestTemplateStrings` types on the uid/path-bearing Request;
  // safe for drafts since the walker only reads `url` + `params` + `headers`
  // + `auth.*` + `body.*`.
  const strings = collectRequestTemplateStrings(request as Request);
  for (const s of strings) {
    if (!s) continue;
    const { errors } = resolveTemplate(s, lookup, scopedLookup, env);
    for (const e of errors) {
      if (e.reason === 'reserved-namespace') continue;
      return false;
    }
  }
  return true;
}

export function requestIncompleteReason(
  request: Request | Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>,
): RequestIncompleteReason | null {
  if (!request.url?.trim()) return 'missing-url';

  const auth = request.auth;
  switch (auth.type) {
    case 'none':
    case 'inherit':
      return null;
    case 'basic':
      return auth.username.trim().length > 0 ? null : 'basic-missing-username';
    case 'bearer':
      return auth.token.trim().length > 0 ? null : 'bearer-missing-token';
    case 'api-key':
      if (!auth.key.trim()) return 'api-key-missing-key';
      if (!auth.value.trim()) return 'api-key-missing-value';
      return null;
    case 'oauth2':
      return null;
  }
}
