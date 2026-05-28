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
export function registerCapability<K extends CapabilityName>(
  name: K,
  impl: NonNullable<Capabilities[K]>,
): void {
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
