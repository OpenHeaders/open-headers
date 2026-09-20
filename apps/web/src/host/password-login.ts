/**
 * Local password login support for the web tab (enterprise Phase 3).
 *
 * The daemon composes `/auth/password/*` only when no OIDC provider is
 * configured — password is the no-IdP deployment's login story. The
 * SPA probes the meta route to decide whether the gate renders the
 * form, then swaps `{email, password}` for a session token in one POST.
 * The token then rides the exact pasted-token path: candidate in
 * memory, real HELLO, persist only on WELCOME accept.
 */

import { fetchJsonDocument } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { PASSWORD_META_PATH, parsePasswordMeta } from '@openheaders/ui/shared/backend';

const SCOPE = 'PasswordLogin';

const LOGIN_PATH = '/auth/password/login';

/**
 * Is password login usable on the serving daemon? A daemon with OIDC
 * configured (or none at all) has no `/auth/password/*` routes, so the
 * SPA fallback answers with the app HTML — only JSON `enabled: true`
 * counts. Same-origin: the tab is served by the daemon it asks.
 */
export async function fetchPasswordMeta(): Promise<{ enabled: boolean }> {
  return parsePasswordMeta(await fetchJsonDocument(PASSWORD_META_PATH));
}

/**
 * Swap credentials for the session token. Null = refused (the daemon
 * answers uniformly whatever the cause — wrong password, unknown email,
 * locked account) or unreachable.
 */
export async function submitPasswordLogin(email: string, password: string): Promise<string | null> {
  try {
    const response = await fetch(LOGIN_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: unknown; secret?: unknown };
    return payload.ok === true && typeof payload.secret === 'string' ? payload.secret : null;
  } catch (err) {
    logger.warn(SCOPE, 'password login failed', err);
    return null;
  }
}
