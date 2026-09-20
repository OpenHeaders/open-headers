/**
 * The one session TTL policy (the client sign-in plan §6.5, D3): every
 * `session`-kind mint on the daemon — the password login, the server
 * claim, the OIDC completion, the device flow's poll — expires by the
 * same server-wide `sessionTtlDays`. The host resolves it once
 * (`daemon.json` / `OH_DAEMON_SESSION_TTL_DAYS`, default 30) and the
 * spine threads the resulting milliseconds into each service; a
 * service that is built without one (tests, a host that declares
 * nothing) takes the same default.
 */

export const DEFAULT_SESSION_TTL_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60_000;

/** Days → the `expiresAt` offset a session mint adds to `now`. */
export function sessionTtlMsFromDays(days: number): number {
  return Math.max(1, days) * MS_PER_DAY;
}

export const DEFAULT_SESSION_TTL_MS = sessionTtlMsFromDays(DEFAULT_SESSION_TTL_DAYS);
