/**
 * Host-logger contract — the seam between UI code that emits log lines
 * and the platform-specific sink that actually records them.
 *
 * Each app installs its own implementation of {@link HostLogger} once at
 * boot via {@link setHostLogger}:
 *
 *   - **Browser extension** — the console logger from
 *     `@openheaders/core/utils` (the default adapter; no chrome coupling
 *     of its own).
 *   - **Electron desktop** — a file-backed logger later.
 *   - **Web app** — console plus an optional remote sink later.
 *
 * UI code reads through the {@link hostLogger} delegating proxy and uses
 * it identically across platforms — `hostLogger.info('Scope', '…')` —
 * without owning where the line ends up.
 *
 * The four methods mirror the shape every existing call site already
 * uses (`(scope, ...args)`); level filtering + level config stay on the
 * concrete adapter, wired by the host at boot.
 */

/**
 * The runtime contract every host's log sink must satisfy. UI code only
 * sees this interface — never the concrete adapter.
 */
export interface HostLogger {
  /** Operation failures and exceptions. */
  error(scope: string, ...args: unknown[]): void;
  /** Anomalies, retries, and fallbacks. */
  warn(scope: string, ...args: unknown[]): void;
  /** Operational events and state changes. */
  info(scope: string, ...args: unknown[]): void;
  /** Detailed internals for troubleshooting. */
  debug(scope: string, ...args: unknown[]): void;
}

let installed: HostLogger | null = null;

/**
 * Install (or replace) the host-logger adapter. Hosts call this once at
 * boot before any UI code emits a log line. Calling twice replaces the
 * prior implementation — tests use this to swap in a fake.
 */
export function setHostLogger(impl: HostLogger): void {
  installed = impl;
}

/** Returns the installed adapter, or null when no host has wired one yet. */
export function getHostLogger(): HostLogger | null {
  return installed;
}

/** Returns the installed adapter or throws if no host has wired one. */
export function requireHostLogger(): HostLogger {
  if (!installed) {
    throw new Error('HostLogger: no host adapter installed. Call setHostLogger at app boot.');
  }
  return installed;
}

/**
 * Delegating proxy — every call is forwarded to the currently-installed
 * host adapter. UI code imports this and uses it exactly like a concrete
 * logger; the indirection lets each host plug in its own sink without
 * consumers caring.
 */
export const hostLogger: HostLogger = new Proxy({} as HostLogger, {
  get(_target, prop): unknown {
    const impl = requireHostLogger();
    const value = (impl as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(impl) : value;
  },
});
