/**
 * TOTP cooldown tracker — prevents the same TOTP code from being
 * reused within the time window it was generated for.
 *
 * Most providers (GitHub, AWS, Okta, Auth0, …) reject reused TOTP
 * codes for the duration of the window the code was minted in. Without
 * a tracker the user fires a request, immediately re-fires it (still
 * within the 30s window), the second one ships the same code, and the
 * provider 401s — confusing because the code "looks valid" to the user.
 *
 * The fix is to gate the second send BEFORE it leaves the executor:
 * the resolver computes the same code; we recognize it matches the
 * recently-used code and surface a structured error with the remaining
 * cooldown seconds. The user can wait for the next window or skip the
 * request.
 *
 * Key shape: `${workspaceId}::${vaultEntryName}` — different vault
 * entries (and different workspaces) have independent cooldowns. The
 * stored value is the last-used code; equality with the proposed code
 * is the cooldown signal because TOTP codes change on window rotation.
 *
 * State is in-memory only — SW restart resets every cooldown. Acceptable
 * degradation: the worst case is the provider returning a 401 on the
 * post-restart re-fire, which is the same outcome the user would see
 * without cooldown protection at all.
 */

interface CooldownEntry {
  code: string;
  /** Wall-clock ms until the cooldown lifts (window-end). */
  until: number;
}

const cooldowns = new Map<string, CooldownEntry>();

function makeKey(workspaceId: string, name: string): string {
  return `${workspaceId}::${name}`;
}

/** Window-end wall-clock ms — when the current `period`-second window flips. */
function windowEndMs(periodSeconds: number, nowMs: number): number {
  const seconds = Math.floor(nowMs / 1000);
  const secondsToNextWindow = periodSeconds - (seconds % periodSeconds);
  return (seconds + secondsToNextWindow) * 1000;
}

export type CooldownStatus = { inCooldown: false } | { inCooldown: true; remainingSeconds: number };

/**
 * Check whether the proposed `code` for `name` was just used inside
 * its current TOTP window. Returns `{ inCooldown: true, remainingSeconds }`
 * when reuse would race the provider's anti-replay; otherwise
 * `{ inCooldown: false }`.
 */
export function checkCooldown(
  workspaceId: string,
  name: string,
  code: string,
  nowMs: number = Date.now(),
): CooldownStatus {
  const entry = cooldowns.get(makeKey(workspaceId, name));
  if (!entry) return { inCooldown: false };
  if (entry.until <= nowMs) {
    cooldowns.delete(makeKey(workspaceId, name));
    return { inCooldown: false };
  }
  if (entry.code !== code) return { inCooldown: false };
  return { inCooldown: true, remainingSeconds: Math.ceil((entry.until - nowMs) / 1000) };
}

/**
 * Record that `code` was just used for `name`. Subsequent fires that
 * resolve to the same code (i.e., still inside the same window) will
 * fail the {@link checkCooldown} gate until the window flips.
 */
export function recordUsage(
  workspaceId: string,
  name: string,
  code: string,
  periodSeconds: number,
  nowMs: number = Date.now(),
): void {
  cooldowns.set(makeKey(workspaceId, name), {
    code,
    until: windowEndMs(periodSeconds, nowMs),
  });
}

/** Drop every entry for a workspace — called on workspace delete. */
export function purgeWorkspaceCooldowns(workspaceId: string): void {
  const prefix = `${workspaceId}::`;
  for (const key of [...cooldowns.keys()]) {
    if (key.startsWith(prefix)) cooldowns.delete(key);
  }
}

/** Test-only: clear every entry across every workspace. */
export function __resetForTests(): void {
  cooldowns.clear();
}
