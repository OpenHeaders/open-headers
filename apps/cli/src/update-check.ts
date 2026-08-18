/**
 * On-start availability notify (the distribution plan §5, CLI row) —
 * the only automatic piece of the update pair; installation is always
 * the human-typed `oh upgrade`. Any command may print the one stderr
 * line, but only from the 24h on-disk cache and only when every gate
 * passes: a TTY stderr, no `--json`, no `CI`, no `OH_NO_UPDATE_CHECK`,
 * a released (non-`dev`) build. The network refresh is background and
 * best-effort exactly like the telemetry flush — an anonymous GET of a
 * static pointer file, silent on every failure, capped at exit so a
 * slow feed can never hold a finished command open or change its
 * outcome. Severity law: the loud tier keys off the STABLE manifest on
 * both channels (the updates plan §4) — a beta install below the
 * stable floor still escalates.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { cliConfigPath, readCliConfig, type UpdateChannel } from './config-store';
import { compareCalVer, parseCliManifestEntry, type UpdateSeverity, versionsManifestUrl } from './update-feed';
import { CLI_VERSION } from './version';

export const UPDATE_CHECK_ENV = 'OH_NO_UPDATE_CHECK';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/**
 * How long the exit flush may wait on an unfinished refresh before
 * aborting it — the fetch itself carries no timer, so nothing but this
 * grace ever holds a finished command's event loop open.
 */
const FINISH_WAIT_MS = 500;

/** Raw facts from the last successful feed read; the line derives at print time. */
export interface UpdateCheckCache {
  checkedAt: number;
  channel: UpdateChannel;
  latest: string;
  tag: string;
  /** Always sourced from the STABLE manifest (severity law). */
  severity: UpdateSeverity;
  minimumSafeVersion?: string;
}

export function updateCheckCachePath(configPath: string): string {
  return path.join(path.dirname(configPath), 'update-check.json');
}

/**
 * All print/fetch gates in one predicate, env-only — no file IO happens
 * on a gated-off invocation. `upgrade` is excluded because it IS the
 * action the line would suggest.
 */
export function updateCheckAllowed(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  stderrIsTTY: boolean,
  cliVersion: string,
): boolean {
  if (cliVersion === 'dev') return false;
  if ((env[UPDATE_CHECK_ENV] ?? '') !== '') return false;
  if ((env.CI ?? '') !== '') return false;
  if (!stderrIsTTY) return false;
  if (argv.includes('--json')) return false;
  return argv[0] !== 'upgrade';
}

/**
 * Derive the notify line from cached facts + the running version —
 * never from cached conclusions, so an upgrade between runs silences
 * the line without touching the cache.
 */
export function composeNotifyLine(cache: UpdateCheckCache, currentVersion: string): string | null {
  if (compareCalVer(cache.latest, currentVersion) <= 0) return null;
  const loud =
    cache.severity === 'security' &&
    cache.minimumSafeVersion !== undefined &&
    compareCalVer(currentVersion, cache.minimumSafeVersion) < 0;
  if (loud) {
    return `SECURITY UPDATE: oh ${cache.latest} fixes versions below ${cache.minimumSafeVersion} (you have ${currentVersion}) — run: oh upgrade`;
  }
  return `oh ${cache.latest} is available (you have ${currentVersion}) — run: oh upgrade`;
}

function parseCache(raw: unknown): UpdateCheckCache | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { checkedAt, channel, latest, tag, severity, minimumSafeVersion } = raw as Record<string, unknown>;
  if (typeof checkedAt !== 'number') return null;
  if (channel !== 'stable' && channel !== 'beta') return null;
  if (typeof latest !== 'string' || typeof tag !== 'string') return null;
  if (severity !== 'normal' && severity !== 'security') return null;
  if (minimumSafeVersion !== undefined && typeof minimumSafeVersion !== 'string') return null;
  return {
    checkedAt,
    channel,
    latest,
    tag,
    severity,
    ...(minimumSafeVersion !== undefined ? { minimumSafeVersion } : {}),
  };
}

/** Last successful feed read, or null on any miss — shared with auto-upgrade's trigger. */
export async function readUpdateCheckCache(cachePath: string): Promise<UpdateCheckCache | null> {
  try {
    return parseCache(JSON.parse(await readFile(cachePath, 'utf8')));
  } catch {
    return null;
  }
}

async function writeCache(cachePath: string, cache: UpdateCheckCache): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true, mode: 0o700 });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

async function fetchManifestEntry(fetchFn: typeof fetch, channel: UpdateChannel, signal: AbortSignal) {
  const response = await fetchFn(versionsManifestUrl(channel), { redirect: 'follow', signal });
  if (!response.ok) return null;
  return parseCliManifestEntry(await response.json());
}

/**
 * One feed read → one cache record: offer (latest/tag) from the
 * selected channel, severity + floor from STABLE regardless (a beta
 * manifest never carries floors). A failed stable read degrades to
 * `normal` — silent, never loud by accident.
 */
async function refreshCache(
  cachePath: string,
  channel: UpdateChannel,
  fetchFn: typeof fetch,
  now: () => number,
  signal: AbortSignal,
): Promise<void> {
  const [offer, stable] = await Promise.all([
    fetchManifestEntry(fetchFn, channel, signal),
    channel === 'stable' ? null : fetchManifestEntry(fetchFn, 'stable', signal).catch(() => null),
  ]);
  if (offer === null) return;
  const floorSource = channel === 'stable' ? offer : stable;
  await writeCache(cachePath, {
    checkedAt: now(),
    channel,
    latest: offer.latest,
    tag: offer.tag,
    severity: floorSource?.severity ?? 'normal',
    ...(floorSource?.minimumSafeVersion !== undefined ? { minimumSafeVersion: floorSource.minimumSafeVersion } : {}),
  });
}

export interface UpdateNotify {
  /** The stderr line owed on this invocation, from cache only. */
  line: string | null;
  /** Best-effort exit wait on a background refresh; never throws. */
  finish(): Promise<void>;
}

export interface UpdateNotifyDeps {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  cliVersion?: string;
  stderrIsTTY?: boolean;
  fetchFn?: typeof fetch;
  now?: () => number;
}

const inert: UpdateNotify = { line: null, finish: async () => undefined };

/**
 * Boot the check for this invocation: gate, print-from-cache, and kick
 * the ≤1/day background refresh when the cache is stale. Every failure
 * path degrades to the inert handle — a broken cache or feed can never
 * change a command's outcome.
 */
export async function bootUpdateNotify(argv: readonly string[], deps: UpdateNotifyDeps = {}): Promise<UpdateNotify> {
  try {
    const env = deps.env ?? process.env;
    const cliVersion = deps.cliVersion ?? CLI_VERSION;
    if (!updateCheckAllowed(argv, env, deps.stderrIsTTY ?? process.stderr.isTTY === true, cliVersion)) return inert;

    const configPath = deps.configPath ?? cliConfigPath();
    const cachePath = updateCheckCachePath(configPath);
    let channel: UpdateChannel = 'stable';
    try {
      channel = (await readCliConfig(configPath)).channel ?? 'stable';
    } catch {
      // A malformed config counts as stable here; the command's own
      // config read raises the loud fix-or-delete error.
    }

    const now = deps.now ?? Date.now;
    const cache = await readUpdateCheckCache(cachePath);
    const at = now();
    const fresh =
      cache !== null && cache.channel === channel && at >= cache.checkedAt && at - cache.checkedAt < CHECK_INTERVAL_MS;
    const line = fresh ? composeNotifyLine(cache, cliVersion) : null;

    if (fresh) return { line, finish: async () => undefined };
    const controller = new AbortController();
    const pending = refreshCache(cachePath, channel, deps.fetchFn ?? fetch, now, controller.signal).catch(
      () => undefined,
    );
    return {
      line,
      finish: async () => {
        let graceTimer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          pending,
          new Promise((resolve) => {
            graceTimer = setTimeout(resolve, FINISH_WAIT_MS);
          }),
        ]);
        clearTimeout(graceTimer);
        // Whatever the grace didn't finish is cut loose — the abort
        // settles the fetch so no socket outlives the command.
        controller.abort();
        await pending;
      },
    };
  } catch {
    return inert;
  }
}
