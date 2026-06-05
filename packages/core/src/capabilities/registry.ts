/**
 * Host capability registry — the seam between shared UI code and the
 * platform-specific features each shell happens to support. Conceptually
 * the same shape as the other host-neutral seams (`hostBridge`,
 * `hostLogger`, `hostStorage`): UI imports the capability accessor and
 * doesn't care which shell is running.
 *
 * **Why this exists.** The shared `@openheaders/ui` package is
 * chrome-free; it can't assume the host has a popup, a tray, a
 * declarativeNetRequest engine, or a multi-window model. Hosts (the
 * desktop renderer, the extension popup / panel / sidepanel, a future
 * web app) install only the capabilities they support at boot;
 * everything else reads as `undefined`, and shared code branches
 * cleanly off `hasCapability`.
 *
 * **Compared to `hostBridge`.** `hostBridge` is a single typed RPC
 * channel. Capabilities are a heterogeneous map of named features with
 * varying signatures (sync state readers, async one-shots, subscription
 * registrations). Anything that's universal to every host long-term
 * belongs in a dedicated seam (`hostBridge`, `hostStorage`, …);
 * anything that's optional per host belongs here.
 *
 * **What a capability is.** A typed function value. Optional in the
 * {@link Capabilities} interface (`name?: signature`) means the
 * capability is host-specific; required means every shell must
 * register it (typecheck doesn't enforce this — it's a contract).
 *
 * **Usage.**
 *
 * ```ts
 * // boot — desktop renderer
 * registerCapability('getActiveWorkspaceId', () =>
 *   hostBridge.call('getActiveWorkspaceId'));
 *
 * // shared UI
 * const probe = getCapability('getActiveWorkspaceId');
 * if (probe) {
 *   const { activeWorkspaceId } = await probe();
 *   …
 * }
 * ```
 *
 * Calling twice replaces the prior implementation — tests use this to
 * swap in fakes; production code installs once at boot.
 */

/**
 * Input to {@link Capabilities.pairWithCode}. `url` is the back-end's
 * WebSocket URL exactly as the user configured it (`backend.url`); the
 * host implementation derives the matching HTTP origin for the daemon's
 * `/pair/<code>/confirm` route, which rides the same bound socket.
 */
export interface PairWithCodeInput {
  /** The configured back-end WebSocket URL, e.g. `ws://127.0.0.1:8137`. */
  readonly url: string;
  /** The numeric pairing code the daemon displayed. */
  readonly code: string;
  /** Optional label recorded against the minted token (Known devices, A6). */
  readonly deviceLabel?: string;
}

/**
 * Result of a code→token exchange. `unknown`/`expired`/`consumed` mirror
 * the daemon's pairing-state reasons; `unreachable`/`error` are
 * client-side transport faults (back-end down, bad URL, non-JSON reply).
 */
export type PairWithCodeResult =
  | { readonly ok: true; readonly token: string; readonly tokenId: string }
  | {
      readonly ok: false;
      readonly reason: 'unknown' | 'expired' | 'consumed' | 'unreachable' | 'error';
      readonly message?: string;
    };

/**
 * The universe of capabilities. Optional members (`name?:`) are
 * host-specific; required members are universal contracts every host
 * must implement.
 *
 * Grow this interface as the migration progresses. Each entry is a
 * typed function signature; the registry stores `(...args) => unknown`
 * under the hood but the accessor preserves the declared type.
 */
export interface Capabilities {
  /**
   * Resolve the runtime-active workspace id for the current surface.
   * Used by shared eager-mirror init to pin per-workspace mirrors to
   * the right id on mount. Returns `null` when no workspace is active
   * (fresh install, no seed yet).
   */
  getActiveWorkspaceId?: () => Promise<{ activeWorkspaceId: string | null }>;

  /**
   * Open a URL outside the current surface — the user's default
   * browser on desktop, a new tab on the extension. Implementations
   * decide which schemes to allow (typically http(s) + mailto).
   * Resolves with `{ ok: false, error }` when the URL is rejected or
   * the OS handoff fails.
   */
  openExternalUrl?: (url: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Dismiss the current surface — the extension popup closes its own
   * window; the extension sidepanel can self-close. Desktop windows
   * have no equivalent (the workbench is long-lived), so the desktop
   * shell intentionally doesn't register this capability and shared
   * UI no-ops via `getCapability(...)?.()`.
   */
  closeSurface?: () => void;

  /**
   * Fire-and-forget notification that the surface just mounted and
   * would like a fresh broadcast of host state. Extension surfaces
   * use this to kick the SW into emitting current rules / connection /
   * workspaces in case the surface load raced past an earlier event.
   * Desktop doesn't need this — the mirror snapshot fetches on mount
   * already cover the resync — so it doesn't register the capability
   * and shared UI no-ops via `getCapability(...)?.()`.
   */
  announceSurfaceReady?: () => Promise<void>;

  /**
   * Tell the host that rule data changed and any out-of-band rule
   * engine (extension `declarativeNetRequest`, future native proxy
   * rebuild paths) should refresh. The sync mutation itself already
   * propagated the data — this is the secondary nudge for engines
   * that live outside the sync data plane. Desktop's header / proxy
   * pipeline reads rules live from the engine state, so it doesn't
   * register this capability and shared UI no-ops via
   * `getCapability(...)?.()`.
   */
  notifyRulesChanged?: () => Promise<void>;

  /**
   * Exchange a daemon pairing code for a long-lived auth token (WS-A2).
   * Host-specific because the wire is a localhost/LAN HTTP fetch to the
   * back-end's `/pair/<code>/confirm` route, which only a host with the
   * reachability + permission to dial that origin can perform — the
   * extension surfaces register it; the chrome-free UI calls it and
   * writes the returned token into `backend.authToken`. Hosts that pair
   * by some other gesture (or not at all) simply don't register it, and
   * the UI hides the in-app pairing affordance via `hasCapability`.
   */
  pairWithCode?: (input: PairWithCodeInput) => Promise<PairWithCodeResult>;

  /**
   * Marker capability for the opt-in request-inspection path that attaches
   * the browser's debugging protocol to tabs with their developer tools
   * open. Present only on hosts whose runtime exposes that protocol; absent
   * elsewhere (the Firefox / Safari extension surfaces), where shared UI
   * gates the master-switch row off via `hasCapability` and renders it
   * disabled. Presence is the whole signal — the boolean return is a
   * formality so the capability is a typed function like the others.
   */
  cdpInspection?: () => boolean;
}

type CapabilityName = keyof Capabilities;

// Underlying store — typed as `unknown` so we can hold heterogeneous
// signatures without per-name conditionals. The accessor below restores
// the declared type at the call site.
const installed = new Map<CapabilityName, unknown>();

/**
 * Install (or replace) a capability. Hosts call this once at boot for
 * every capability they support. Calling twice replaces the prior
 * implementation; tests use this to swap fakes.
 */
export function registerCapability<K extends CapabilityName>(name: K, impl: NonNullable<Capabilities[K]>): void {
  installed.set(name, impl);
}

/**
 * Drop a capability — primarily for test teardown so registrations
 * from one test don't bleed into the next. Production rarely needs it.
 */
export function unregisterCapability<K extends CapabilityName>(name: K): void {
  installed.delete(name);
}

/**
 * Return the installed implementation for `name`, or `undefined` when
 * the current host doesn't support that capability. Callers branch on
 * the return value; never throw.
 */
export function getCapability<K extends CapabilityName>(name: K): Capabilities[K] | undefined {
  return installed.get(name) as Capabilities[K] | undefined;
}

/** Convenience predicate — same answer as `getCapability(name) !== undefined`. */
export function hasCapability<K extends CapabilityName>(name: K): boolean {
  return installed.has(name);
}
