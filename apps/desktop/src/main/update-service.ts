/**
 * Check-and-notify update orchestrator (`docs/UPDATES_PLAN.md`).
 *
 * Pure state machine over an injected {@link UpdaterPort} — the
 * electron-updater wiring lives in `electron-updater-port.ts`; this
 * module never imports Electron so the machine is unit-testable with a
 * fake port.
 *
 * Consent model, enforced structurally:
 *   - a CHECK only looks (nothing downloads),
 *   - a DOWNLOAD only stages (nothing installs),
 *   - an INSTALL happens only through the explicit action (or the next
 *     natural app quit applying an already-staged download).
 * `updates.autoDownload` collapses check→download into one step when
 * the user opted in; it never touches the install step.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';

/** What a check found. `null` — already on the latest. */
export interface AvailableUpdate {
  version: string;
  releaseNotesUrl: string | null;
}

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
}

export interface UpdatePreferences {
  check: 'all' | 'security-only' | 'off';
  autoDownload: boolean;
}

/** `updates.*` reader over the raw user-settings record. */
export function readUpdatePreferences(settings: Record<string, unknown> | undefined): UpdatePreferences {
  const check = settings?.['updates.check'];
  const autoDownload = settings?.['updates.autoDownload'];
  return {
    check: check === 'off' || check === 'security-only' ? check : 'all',
    autoDownload: autoDownload === true,
  };
}

export interface UpdateServiceDeps {
  updater: UpdaterPort;
  currentVersion: string;
  /** False on dev/unpackaged builds and channels that own updates (deb/rpm). */
  supported: boolean;
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
    supported: deps.supported,
  };
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;

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
    if (disposed || !deps.supported || deps.getPreferences().check === 'off') return;
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
    if (!deps.supported || state.phase === 'checking' || state.phase === 'downloading') return state;
    if (reason === 'scheduled' && deps.getPreferences().check === 'off') return state;
    transition({ phase: 'checking', errorMessage: null });
    try {
      const found = await deps.updater.check();
      transition({
        phase: found ? 'available' : 'idle',
        availableVersion: found?.version ?? null,
        releaseNotesUrl: found?.releaseNotesUrl ?? null,
        lastCheckedAt: deps.now(),
      });
      if (found) {
        deps.log.info(`update available: ${found.version} (current ${state.currentVersion})`);
        if (deps.getPreferences().autoDownload) await download();
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
    if (state.phase !== 'available') return state;
    transition({ phase: 'downloading', progressPercent: 0 });
    try {
      await deps.updater.download((percent) => {
        const rounded = Math.max(0, Math.min(100, Math.round(percent)));
        if (rounded !== state.progressPercent) transition({ progressPercent: rounded });
      });
      transition({ phase: 'downloaded', progressPercent: 100 });
      deps.log.info(`update ${state.availableVersion} downloaded — installs on restart`);
    } catch (err) {
      deps.log.warn('update download failed', err);
      transition({ phase: 'error', errorMessage: err instanceof Error ? err.message : String(err) });
    }
    return state;
  }

  function install(): AppUpdateState {
    if (state.phase !== 'downloaded') return state;
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
