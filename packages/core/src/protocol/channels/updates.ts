/**
 * App-update bridge RPCs — the check-and-notify surface
 * (`docs/UPDATES_PLAN.md`). Desktop-only today: the renderer drives
 * the main process's updater and mirrors its state.
 *
 * Consent model is structural: `checkNow` only looks, `download` only
 * fetches, `install` restarts into the staged update — no RPC does
 * more than its name, so no caller can accidentally self-install.
 */

/** Where the updater currently is. One phase at a time, no overlap. */
export type AppUpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface AppUpdateState {
  phase: AppUpdatePhase;
  /** Version the running app reports (CalVer). */
  currentVersion: string;
  /** Newer version the feed offered; null outside available/downloading/downloaded. */
  availableVersion: string | null;
  /** Release notes URL for {@link availableVersion} when the feed carries one. */
  releaseNotesUrl: string | null;
  /** Download progress 0–100 while `downloading`; null otherwise. */
  progressPercent: number | null;
  /** Human-readable failure while `error`; null otherwise. */
  errorMessage: string | null;
  /** Epoch ms of the last completed check (success or failure); null before the first. */
  lastCheckedAt: number | null;
  /**
   * False where no updater can run: dev builds, unpackaged runs, and
   * install channels that own updates themselves (Linux deb/rpm). The
   * UI hides update affordances entirely when unsupported.
   */
  supported: boolean;
}

export interface UpdatesRpc {
  /** Current updater state — UI hydrates from this at mount. */
  'oh.updates.getState': { req: Record<string, never>; res: AppUpdateState };
  /** User-triggered check ("Check now"). Resolves once the check settles. */
  'oh.updates.checkNow': { req: Record<string, never>; res: AppUpdateState };
  /** Start downloading the available update. Progress arrives via broadcast. */
  'oh.updates.download': { req: Record<string, never>; res: AppUpdateState };
  /** Quit and install the downloaded update. Resolves before the restart. */
  'oh.updates.install': { req: Record<string, never>; res: AppUpdateState };
}
