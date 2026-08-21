/**
 * App-update bridge RPCs — the check-and-notify surface
 * (the updates plan). Desktop-only today: the renderer drives
 * the main process's updater and mirrors its state.
 *
 * Consent model is structural: `checkNow` only looks, `download` only
 * fetches, `install` restarts into the staged update, and
 * `updateAndRestart` is the one-click compound (download if needed,
 * then restart to install) behind every "Update & Restart" affordance.
 */

import type { ChangelogIndexRow } from '../../changelog-feed';

/** Where the updater currently is. One phase at a time, no overlap. */
export type AppUpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

/**
 * Severity of the latest published release, from the static
 * `versions.json` manifest (the updates plan §4). Authored by a
 * human before tagging, never inferred.
 */
export type AppUpdateSeverity = 'normal' | 'security';

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
   * Who initiated the in-flight/most-recent check. UI surfaces speak up
   * about MANUAL check outcomes ("you're up to date", failures) and stay
   * silent about scheduled ones; null before the first check.
   */
  lastCheckReason: 'manual' | 'scheduled' | null;
  /**
   * Severity of the latest release per the manifest; null before a
   * check has seen it (or when the manifest is unreachable).
   */
  severity: AppUpdateSeverity | null;
  /**
   * True when a `security` release names a `minimumSafeVersion` above
   * the running version — the escalation trigger: timeline entry turns
   * warning, gear dot turns red, and the entry banner names the fix.
   */
  belowSafeFloor: boolean;
  /**
   * False where the update service cannot run at all: dev builds and
   * unpackaged runs. The UI hides update affordances entirely when
   * unsupported.
   */
  supported: boolean;
  /**
   * How an offered update gets installed. `builtin` — the in-app
   * updater downloads and applies it. `packageManager` — the install
   * channel owns updates (Linux deb/rpm): the service only checks and
   * notifies (never downloads or installs), and the UI points at the
   * system package manager instead of offering download/install
   * actions.
   */
  installMethod: 'builtin' | 'packageManager';
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
  /**
   * Update & Restart: download the available update if it is not staged
   * yet, then quit and install. From `downloaded` it installs
   * immediately; during `downloading` it arms the install for when the
   * running download completes.
   */
  'oh.updates.updateAndRestart': { req: Record<string, never>; res: AppUpdateState };

  // ── What's New online history (the changelog plan §4.3) ────────────
  //
  // The renderer's CSP forbids dialing the changelog feed directly, so
  // the main process performs the enhancement-only static GETs and the
  // renderer's `whatsNewHistory` capability rides these. Failure is
  // in-band null — the history section hides, never errors.

  /** The desktop stream's index rows (`changelog/desktop.json`); null = unreachable. */
  'oh.whatsNew.history': { req: Record<string, never>; res: { rows: ReadonlyArray<ChangelogIndexRow> | null } };
  /** One release's prose body, asset URLs absolute; null = absent/unreachable. */
  'oh.whatsNew.historyEntry': { req: { version: string }; res: { body: string | null } };
}
