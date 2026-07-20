/**
 * `ohd status` availability line (`DISTRIBUTION_PLAN.md` §5, daemon
 * row) — the notify half of the update pair. Status is an explicit,
 * short-lived probe command, so unlike the client CLI there is no
 * cache: one best-effort anonymous GET of the channel's pointer file,
 * abort-capped so a slow feed can never hold `ohd status` open, silent
 * on every failure. Severity law: the loud tier keys off the STABLE
 * manifest on both channels — a beta install below the stable floor
 * still escalates.
 */

import { getBuildInfo, resolveAppVersion } from '../build-info';
import { compareCalVer, parseDaemonManifestEntry, type UpdateChannel, versionsManifestUrl } from './update-feed';

export const UPDATE_CHECK_ENV = 'OH_NO_UPDATE_CHECK';

/** Cap on the whole feed round-trip — status must answer promptly. */
const FEED_TIMEOUT_MS = 1_500;

export interface UpdateNotifyDeps {
  env?: NodeJS.ProcessEnv;
  currentVersion?: string;
  /** Channel the build follows; null on dev builds (no line ever). */
  channel?: UpdateChannel | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

async function fetchEntry(fetchFn: typeof fetch, channel: UpdateChannel, signal: AbortSignal) {
  const response = await fetchFn(versionsManifestUrl(channel), { redirect: 'follow', signal });
  if (!response.ok) return null;
  return parseDaemonManifestEntry(await response.json());
}

/**
 * The availability line owed to `ohd status`, or null: up to date,
 * dev build, silenced by env, or any feed failure.
 */
export async function fetchAvailabilityLine(deps: UpdateNotifyDeps = {}): Promise<string | null> {
  try {
    const env = deps.env ?? process.env;
    if ((env[UPDATE_CHECK_ENV] ?? '') !== '') return null;
    const channel = deps.channel !== undefined ? deps.channel : (getBuildInfo()?.channel ?? null);
    if (channel === null) return null;
    const current = deps.currentVersion ?? resolveAppVersion();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? FEED_TIMEOUT_MS);
    const fetchFn = deps.fetchFn ?? fetch;
    try {
      const [offer, stable] = await Promise.all([
        fetchEntry(fetchFn, channel, controller.signal),
        channel === 'stable' ? null : fetchEntry(fetchFn, 'stable', controller.signal).catch(() => null),
      ]);
      if (offer === null || compareCalVer(offer.latest, current) <= 0) return null;
      const floorSource = channel === 'stable' ? offer : stable;
      const loud =
        floorSource?.severity === 'security' &&
        floorSource.minimumSafeVersion !== undefined &&
        compareCalVer(current, floorSource.minimumSafeVersion) < 0;
      if (loud) {
        return (
          `SECURITY UPDATE: ohd ${offer.latest} fixes versions below ${floorSource.minimumSafeVersion} ` +
          `(you have ${current}) — run: ohd upgrade`
        );
      }
      return `update available: ohd ${offer.latest} (you have ${current}) — run: ohd upgrade`;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
