/**
 * Check-and-notify update orchestrator (the updates plan).
 *
 * Pure state machine over an injected {@link UpdaterPort} — the
 * electron-updater wiring lives in `electron-updater-port.ts`; this
 * module never imports Electron so the machine is unit-testable with a
 * fake port.
 *
 * Action model, enforced structurally:
 *   - a CHECK only looks (nothing installs),
 *   - a DOWNLOAD only stages (nothing installs),
 *   - an INSTALL restarts only through an explicit user action (or the
 *     next natural app quit applying an already-staged download),
 *   - UPDATE & RESTART is the one-click compound: download if needed,
 *     then install — the restart is the action the user asked for.
 * `updates.autoDownload` (default ON) collapses check→download so an
 * update is already staged by the time the user sees it — installing is
 * then a single restart, and a natural quit+relaunch opens the new
 * version; it never triggers a restart by itself.
 *
 * Every check also reads the published severity manifest
 * (`versions-manifest.ts`): `severity`/`belowSafeFloor` ride the state
 * so the UI can escalate, and the `security-only` tier silences
 * scheduled checks that find no security exposure.
 *
 * Linux deb/rpm installs run the same machine under the `notify`
 * {@link UpdateCapability}: checks, severity, and escalation all work,
 * but DOWNLOAD/INSTALL structurally refuse — the package manager owns
 * updates there, so the machine can never leave `available`.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import type { UpdateChannel } from './update-feed';
import { isBelowSafeFloor, type SeverityInfo } from './versions-manifest';

/** What a check found. `null` — already on the latest. */
export interface AvailableUpdate {
  version: string;
  releaseNotesUrl: string | null;
}

/**
 * What the running install lets the service do (the distribution plan
 * §5). `self` — full check/download/install (mac/win packaged builds,
 * AppImage). `notify` — check-and-notify only: Linux deb/rpm installs,
 * where the package manager owns updates and the machine structurally
 * refuses download/install. `none` — no service at all (dev/unpackaged
 * runs, `OH_DISABLE_UPDATE_CHECKS`); notify still dials the feed, so
 * the escape hatch maps to `none`, never `notify`.
 */
export type UpdateCapability = 'self' | 'notify' | 'none';

/**
 * The slice of an updater implementation the machine drives. Matches
 * electron-updater's surface shape-wise; a fake in tests.
 */
export interface UpdaterPort {
  /** Resolve what the feed offers beyond the current version, or null. */
  check(): Promise<AvailableUpdate | null>;
  /** Fetch the offered update. Resolves when fully staged on disk. */
  download(onProgressPercent: (percent: number) => void): Promise<void>;
  /** Quit the app and apply the staged update. */
  quitAndInstall(): void;
  /**
   * Allow or block the staged download from applying on a natural app
   * quit. The machine blocks when the feed stops offering the staged
   * version (rollback) or offers a different one (the stale stage must
   * not apply while its replacement downloads); explicit
   * {@link quitAndInstall} is unaffected.
   */
  setInstallOnQuit(enabled: boolean): void;
}

export interface UpdatePreferences {
  check: 'all' | 'security-only' | 'off';
  autoDownload: boolean;
  /**
   * Which release line checks follow (the distribution plan §4). The
   * channel changes offers, never consent; severity always reads the
   * STABLE manifest regardless (`versions-manifest.ts`).
   */
  channel: UpdateChannel;
}

/** `updates.*` reader over the raw user-settings record. */
export function readUpdatePreferences(settings: Record<string, unknown> | undefined): UpdatePreferences {
  const check = settings?.['updates.check'];
  const autoDownload = settings?.['updates.autoDownload'];
  const channel = settings?.['updates.channel'];
  return {
    check: check === 'off' || check === 'security-only' ? check : 'all',
    autoDownload: autoDownload !== false,
    channel: channel === 'beta' ? 'beta' : 'stable',
  };
}

export interface UpdateServiceDeps {
  updater: UpdaterPort;
  /**
   * Resolve the published severity manifest's desktop entry
   * (`versions-manifest.ts`); null when unreachable or unparseable —
   * severity then stays unknown, the feed check is unaffected.
   */
  fetchSeverity(): Promise<SeverityInfo | null>;
  currentVersion: string;
  capability: UpdateCapability;
  getPreferences(): UpdatePreferences;
  /** Fan the new state out to every open renderer (`appUpdateState`). */
  broadcast(state: AppUpdateState): void;
  now(): number;
  /** Injectable timer pair so tests drive the schedule by hand. */
  setTimer(fn: () => void, ms: number): NodeJS.Timeout;
  clearTimer(handle: NodeJS.Timeout): void;
  log: { info(msg: string): void; warn(msg: string, err?: unknown): void };
}

/** First scheduled check waits out app startup. */
const FIRST_CHECK_DELAY_MS = 2 * 60_000;
/** Steady-state cadence — the plan's "at most once a day". */
const CHECK_INTERVAL_MS = 24 * 60 * 60_000;
/** ±10min jitter so a fleet doesn't thundering-herd the feed. */
const JITTER_MS = 10 * 60_000;

export interface UpdateService {
  state(): AppUpdateState;
  /** Begin the daily schedule (no-op when unsupported or checks are off). */
  start(): void;
  /** Re-read preferences after a settings flip: reschedule or cancel. */
  preferencesChanged(): void;
  /**
   * Handle an `oh.updates.*` bridge RPC. Returns the post-action state,
   * or undefined when `type` is not an updates RPC (caller falls
   * through to the engine dispatcher).
   */
  dispatchRpc(type: unknown): Promise<AppUpdateState | undefined>;
  dispose(): void;
}

export function createUpdateService(deps: UpdateServiceDeps): UpdateService {
  let state: AppUpdateState = {
    phase: 'idle',
    currentVersion: deps.currentVersion,
    availableVersion: null,
    releaseNotesUrl: null,
    progressPercent: null,
    errorMessage: null,
    lastCheckedAt: null,
    lastCheckReason: null,
    severity: null,
    belowSafeFloor: false,
    supported: deps.capability !== 'none',
    installMethod: deps.capability === 'notify' ? 'packageManager' : 'builtin',
  };
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  // Armed by updateAndRestart when a download is (or ends up) in
  // flight: the completing download installs instead of parking in
  // `downloaded`. Cleared on failure — an error never restarts the app.
  let installAfterDownload = false;
  // Version currently staged on disk (null when nothing is). Checks
  // compare the feed's offer against it: same version → stay
  // `downloaded` without re-downloading; different or gone → the stale
  // stage is blocked from installing on quit.
  let stagedVersion: string | null = null;

  function transition(next: Partial<AppUpdateState>): AppUpdateState {
    state = { ...state, ...next };
    deps.broadcast(state);
    return state;
  }

  function cancelTimer(): void {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  }

  function scheduleNext(delayMs: number): void {
    cancelTimer();
    if (disposed || deps.capability === 'none' || deps.getPreferences().check === 'off') return;
    // Jitter is uniform in [-JITTER_MS, +JITTER_MS], floored so the
    // first check can't fire before the app settles.
    const jitter = Math.round((Math.random() * 2 - 1) * JITTER_MS);
    timer = deps.setTimer(
      () => {
        timer = null;
        void check('scheduled');
      },
      Math.max(60_000, delayMs + jitter),
    );
  }

  async function check(reason: 'scheduled' | 'manual'): Promise<AppUpdateState> {
    // A running check/download is single-flight; report current state.
    if (deps.capability === 'none' || state.phase === 'checking' || state.phase === 'downloading') return state;
    if (reason === 'scheduled' && deps.getPreferences().check === 'off') return state;
    const before = state;
    transition({ phase: 'checking', errorMessage: null, lastCheckReason: reason });
    // Severity first (same static-GET posture as the feed): the tier
    // gate below needs it, and escalation state must never lag a check.
    const severityInfo = await deps.fetchSeverity();
    if (severityInfo === null) deps.log.warn('severity manifest unreachable — severity unknown this check');
    const severity = severityInfo?.severity ?? null;
    const belowSafeFloor = severityInfo !== null && isBelowSafeFloor(severityInfo, deps.currentVersion);
    if (severity !== state.severity || belowSafeFloor !== state.belowSafeFloor) {
      transition({ severity, belowSafeFloor });
      if (belowSafeFloor) {
        deps.log.warn(`running ${deps.currentVersion} is below the security floor ${severityInfo?.minimumSafeVersion}`);
      }
    }
    // The security-only tier keys off the safe floor: a scheduled check
    // that finds no security exposure ends silently — no feed check, no
    // NEW "available" surfaces. An offer the user already saw (or a
    // staged download) survives untouched: the feed was never consulted,
    // so there is nothing to contradict it.
    if (reason === 'scheduled' && deps.getPreferences().check === 'security-only' && !belowSafeFloor) {
      const pending = before.phase === 'available' || before.phase === 'downloaded';
      transition({
        phase: pending ? before.phase : 'idle',
        availableVersion: pending ? before.availableVersion : null,
        releaseNotesUrl: pending ? before.releaseNotesUrl : null,
        lastCheckedAt: deps.now(),
      });
      scheduleNext(CHECK_INTERVAL_MS);
      return state;
    }
    try {
      const found = await deps.updater.check();
      const stillStaged = found !== null && found.version === stagedVersion;
      if (stagedVersion !== null && !stillStaged) {
        // The feed no longer offers what sits staged on disk (rollback,
        // or a newer release superseding it). Block the stale stage from
        // applying on quit; a fresh download re-enables it.
        deps.updater.setInstallOnQuit(false);
        deps.log.warn(`staged update ${stagedVersion} no longer offered — install on quit disabled`);
        stagedVersion = null;
      }
      transition({
        phase: found ? (stillStaged ? 'downloaded' : 'available') : 'idle',
        availableVersion: found?.version ?? null,
        releaseNotesUrl: found?.releaseNotesUrl ?? null,
        progressPercent: stillStaged ? 100 : null,
        lastCheckedAt: deps.now(),
      });
      if (found && !stillStaged) {
        deps.log.info(`update available: ${found.version} (current ${state.currentVersion})`);
        // Notify capability stops at `available` — the package manager
        // owns the download, so autoDownload is inert there.
        if (deps.getPreferences().autoDownload && deps.capability === 'self') await download();
      }
    } catch (err) {
      deps.log.warn('update check failed', err);
      transition({
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        lastCheckedAt: deps.now(),
      });
    }
    scheduleNext(CHECK_INTERVAL_MS);
    return state;
  }

  async function download(): Promise<AppUpdateState> {
    // Never-self-apply on deb/rpm holds structurally: without the
    // `self` capability the machine can never leave `available`.
    if (deps.capability !== 'self' || state.phase !== 'available') return state;
    transition({ phase: 'downloading', progressPercent: 0 });
    try {
      await deps.updater.download((percent) => {
        const rounded = Math.max(0, Math.min(100, Math.round(percent)));
        if (rounded !== state.progressPercent) transition({ progressPercent: rounded });
      });
      transition({ phase: 'downloaded', progressPercent: 100 });
      stagedVersion = state.availableVersion;
      deps.updater.setInstallOnQuit(true);
      deps.log.info(`update ${state.availableVersion} downloaded — installs on restart`);
      if (installAfterDownload) {
        installAfterDownload = false;
        install();
      }
    } catch (err) {
      installAfterDownload = false;
      deps.log.warn('update download failed', err);
      transition({ phase: 'error', errorMessage: err instanceof Error ? err.message : String(err) });
    }
    return state;
  }

  async function updateAndRestart(): Promise<AppUpdateState> {
    if (deps.capability !== 'self') return state;
    if (state.phase === 'downloaded') return install();
    if (state.phase === 'downloading') {
      // A download (auto or manual) is already running — arm it.
      installAfterDownload = true;
      return state;
    }
    if (state.phase !== 'available') return state;
    installAfterDownload = true;
    return download();
  }

  function install(): AppUpdateState {
    if (deps.capability !== 'self' || state.phase !== 'downloaded') return state;
    deps.log.info('restarting to install update');
    deps.updater.quitAndInstall();
    return state;
  }

  return {
    state: () => state,

    start(): void {
      scheduleNext(FIRST_CHECK_DELAY_MS);
    },

    preferencesChanged(): void {
      if (deps.getPreferences().check === 'off') {
        cancelTimer();
      } else if (timer === null && state.phase !== 'checking' && state.phase !== 'downloading') {
        scheduleNext(FIRST_CHECK_DELAY_MS);
      }
    },

    async dispatchRpc(type: unknown): Promise<AppUpdateState | undefined> {
      switch (type) {
        case 'oh.updates.getState':
          return state;
        case 'oh.updates.checkNow':
          return check('manual');
        case 'oh.updates.download':
          return download();
        case 'oh.updates.install':
          return install();
        case 'oh.updates.updateAndRestart':
          return updateAndRestart();
        default:
          return undefined;
      }
    },

    dispose(): void {
      disposed = true;
      cancelTimer();
    },
  };
}
