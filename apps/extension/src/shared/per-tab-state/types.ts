/**
 * Per-tab view state — type vocabulary.
 *
 * See `docs/PER_TAB_VIEW_STATE_DESIGN.md` § 5 (vocabulary) and § 8
 * (storage shape). The hook is generic over the surface's snapshot
 * type; v1 ships with `WorkbenchViewState` / `PanelViewState` thin
 * wrappers around `ToolLayoutState`.
 */

export type SurfaceType = 'workbench' | 'panel';

/** sessionStorage payload — dies with the tab. */
export interface PerTabViewState<T> {
  tabUid: string;
  schemaVersion: number;
  snapshot: T;
}

/** chrome.storage.local payload — one per surface, persists across browser restart. */
export interface DonorRecord<T> {
  donorTabUid: string;
  schemaVersion: number;
  snapshot: T;
  publishedAt: number;
}

export interface UsePerTabStateOptions<T> {
  surface: SurfaceType;
  schemaVersion: number;
  factoryDefault: T;
  /** Optional normalizer — drops orphan ids etc. Run on every load. */
  normalize?: (raw: T) => T;
  /**
   * Optional async resolver — runs on every loaded snapshot
   * (sessionStorage, donor record, factoryDefault) AFTER `normalize`,
   * BEFORE exposing through `initial`. Use this to drop or replace
   * workspace-scoped fields whose stored workspace doesn't match the
   * current workspace. See `workspace-aware-loader.ts`.
   */
  resolveSnapshot?: (raw: T) => Promise<T>;
}

export interface PerTabStateApi<T> {
  /** Resolved snapshot to feed downstream hooks. Stable once `ready === true`. */
  initial: T;
  /**
   * Update view state. Setter form (matches React's useState convention)
   * to avoid stale-closure bugs when multiple sub-pieces of the snapshot
   * persist independently. Writes sessionStorage synchronously and (if
   * this tab is focused + visible) schedules a debounced 500ms publish
   * to the donor record.
   */
  onPersist: (updater: (prev: T) => T) => void;
  /** True once the load resolved (sessionStorage hit, or donor record async resolved). */
  ready: boolean;
  /** True when this tab is currently the donor (drives the footer pill). */
  isDonor: boolean;
  /** Force-claim donor role. Reserved for explicit user action. */
  claimDonor: () => void;
  /**
   * Reset this tab's snapshot AND the surface's donor record back to
   * factoryDefault, then reload the page so downstream hooks
   * re-initialize from the wiped state. See design § 11.1.
   */
  resetToDefaults: () => void;
}
