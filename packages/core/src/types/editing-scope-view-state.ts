/**
 * Per-tab view state — type vocabulary.
 *
 * Used by the editing-scope-view-state subsystem: a tab-uid keyed
 * sessionStorage snapshot plus an opt-in `chrome.storage.local` donor
 * record that survives browser restart. Generic over the surface
 * snapshot type.
 */

export type SurfaceType = 'workbench' | 'panel';

/** sessionStorage payload — dies with the tab. */
export interface EditingScopeViewStateEnvelope<T> {
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

export interface UseEditingScopeViewStateOptions<T> {
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
   * current workspace.
   */
  resolveSnapshot?: (raw: T) => Promise<T>;
}

export interface EditingScopeViewStateApi<T> {
  /** Resolved snapshot to feed downstream hooks. Stable once `ready === true`. */
  initial: T;
  /**
   * Update view state. Setter form (matches React's `useState`
   * convention) to avoid stale-closure bugs when multiple sub-pieces
   * of the snapshot persist independently. Writes sessionStorage
   * synchronously and (if this tab is focused + visible) schedules a
   * debounced publish to the donor record.
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
   * `factoryDefault`, then reload the page so downstream hooks
   * re-initialize from the wiped state.
   */
  resetToDefaults: () => void;
}
