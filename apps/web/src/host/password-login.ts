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

import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'PasswordLogin';

const META_PATH = '/auth/password/meta';
const LOGIN_PATH = '/auth/password/login';
const META_PROBE_TIMEOUT_MS = 1500;

/**
 * Is password login usable on the serving daemon? A daemon with OIDC
 * configured (or none at all) has no `/auth/password/*` routes, so the
 * SPA fallback answers with the app HTML — only JSON `enabled: true`
 * counts.
 */
export async function fetchPasswordMeta(): Promise<{ enabled: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), META_PROBE_TIMEOUT_MS);
    const response = await fetch(META_PATH, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) {
      return { enabled: false };
    }
    const payload = (await response.json()) as { enabled?: unknown };
    return { enabled: payload.enabled === true };
  } catch {
    return { enabled: false };
  }
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
