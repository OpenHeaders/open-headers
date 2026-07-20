/**
 * In-daemon unattended auto-update — opt-in and OFF by default
 * (`ohd config set updates.autoUpdate true`): a serving daemon's
 * restart belongs to its operator, so unlike the client CLI nothing
 * here fires unless explicitly enabled. When it is, a daily jittered
 * check resolves the build's channel manifest and, on a newer release,
 * runs the same verified stage pipeline as `ohd upgrade`
 * (`cli/upgrade.ts`), then restarts THROUGH the service manager — a
 * detached `systemctl --user restart` / `launchctl kickstart -k`, so
 * the supervisor performs the stop/start ordering while this process
 * dies mid-flight. Outside an installed unit (foreground `ohd run`)
 * the swap stays staged and a log line says so; the next manual
 * restart applies it.
 *
 * Never on dev builds, inside containers, on the plain-Node
 * distribution, or under `OH_NO_UPDATE_CHECK` — the stage pipeline
 * refuses non-binary installs structurally, this module just avoids
 * scheduling at all. The setting is read at boot like every daemon
 * setting: flipping it applies from the next start.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import { isSea } from 'node:sea';
import type { HostLogger } from '@openheaders/core/logger';
import { serviceUnitPath } from './cli/service-manager';
import { LAUNCHD_LABEL, SYSTEMD_UNIT_NAME } from './cli/service-units';
import type { UpdateChannel } from './cli/update-feed';
import { UPDATE_CHECK_ENV } from './cli/update-notify';
import {
  type DaemonInstallKind,
  detectInstallKind,
  type StageOutcome,
  type StageUpgradeDeps,
  stageUpgrade,
} from './cli/upgrade';

const SCOPE = 'oh-daemon-update';

/** First check waits out boot; steady state is daily with jitter. */
const FIRST_CHECK_DELAY_MS = 5 * 60_000;
const CHECK_INTERVAL_MS = 24 * 60 * 60_000;
const JITTER_MS = 30 * 60_000;

export interface DaemonAutoUpdateDeps {
  /** `updates.autoUpdate` read at boot; false = install nothing. */
  enabled: boolean;
  /** Channel the build follows; null on dev builds (install nothing). */
  channel: UpdateChannel | null;
  log: HostLogger;
  env?: NodeJS.ProcessEnv;
  installKind?: DaemonInstallKind;
  stageFn?: (deps: StageUpgradeDeps) => Promise<StageOutcome>;
  /** Detached supervisor restart; null when no unit is installed. */
  restartFn?: (() => void) | null;
  setTimer?: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimer?: (handle: NodeJS.Timeout) => void;
  random?: () => number;
}

export interface DaemonAutoUpdateHandle {
  dispose(): void;
}

/**
 * The supervisor-side restart, detached and unref'd: the command
 * outlives this process and performs stop → start itself, relaunching
 * into the swapped binary. Null when no installed unit exists to drive.
 */
function defaultRestart(): (() => void) | null {
  const host = { platform: process.platform, homedir: os.homedir(), uid: process.getuid?.() ?? 0 };
  try {
    if (!existsSync(serviceUnitPath(host))) return null;
  } catch {
    return null;
  }
  if (host.platform === 'darwin') {
    return () => {
      spawn('launchctl', ['kickstart', '-k', `gui/${host.uid}/${LAUNCHD_LABEL}`], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    };
  }
  return () => {
    spawn('systemctl', ['--user', 'restart', SYSTEMD_UNIT_NAME], { detached: true, stdio: 'ignore' }).unref();
  };
}

export function installDaemonAutoUpdate(deps: DaemonAutoUpdateDeps): DaemonAutoUpdateHandle {
  const env = deps.env ?? process.env;
  const inert: DaemonAutoUpdateHandle = { dispose: () => undefined };
  if (!deps.enabled || deps.channel === null) return inert;
  if ((env[UPDATE_CHECK_ENV] ?? '') !== '') return inert;
  if ((deps.installKind ?? detectInstallKind(isSea(), existsSync('/.dockerenv'))) !== 'binary') {
    deps.log.info(SCOPE, 'updates.autoUpdate is on but this install is not a self-managed binary — standing down');
    return inert;
  }
  const channel = deps.channel;

  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
  const random = deps.random ?? Math.random;
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  let running = false;
  // Version already swapped onto disk while this process keeps serving
  // the old one (no unit to restart through). Feeds the next check as
  // the effective current version, so the same release is never
  // re-downloaded daily — only a newer one re-stages.
  let stagedTo: string | null = null;

  const schedule = (delayMs: number): void => {
    if (disposed) return;
    const jitter = Math.round((random() * 2 - 1) * JITTER_MS);
    timer = setTimer(
      () => {
        timer = null;
        void tick();
      },
      Math.max(60_000, delayMs + jitter),
    );
  };

  const tick = async (): Promise<void> => {
    if (disposed || running) return;
    running = true;
    try {
      const outcome = await (deps.stageFn ?? stageUpgrade)({
        env,
        channel,
        ...(stagedTo !== null ? { currentVersion: stagedTo } : {}),
      });
      if (outcome.status === 'staged') {
        deps.log.info(SCOPE, `auto-update staged ${outcome.from} → ${outcome.to} (${outcome.asset})`);
        stagedTo = outcome.to;
        const restart = deps.restartFn !== undefined ? deps.restartFn : defaultRestart();
        if (restart !== null) {
          deps.log.info(SCOPE, 'restarting through the service manager to apply');
          restart();
          // The supervisor tears this process down; no reschedule.
          return;
        }
        deps.log.info(SCOPE, 'no installed service unit — the new version applies on the next restart');
      }
    } catch (err) {
      deps.log.warn(SCOPE, 'auto-update check failed', err);
    } finally {
      running = false;
    }
    schedule(CHECK_INTERVAL_MS);
  };

  schedule(FIRST_CHECK_DELAY_MS);
  deps.log.info(SCOPE, `unattended auto-update armed (${channel} channel, daily check)`);
  return {
    dispose(): void {
      disposed = true;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
  };
}
