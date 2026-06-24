/**
 * Build metadata — install seam.
 *
 * The shape (version, commit, build counter, channel) is host-build
 * specific: the browser-extension build injects it via a Vite `define`
 * and also writes `dist/<browser>/build-info.json` for external tooling;
 * a desktop build would read it from its packaged manifest. Lives in
 * `@openheaders/ui` so every host's UI bundle reads build metadata the
 * same way — the host supplies the values once at boot via
 * {@link setBuildInfo}, mirroring the `setHostBridge` / `setCurrentHost`
 * install seams.
 *
 * Until a host wires the seam, {@link getBuildInfo} returns a clearly-
 * unset placeholder so UI render paths never crash.
 */

export interface BuildInfo {
  /** Free-text label, e.g. "2026.6.0" or "2026.6.0-beta.1". */
  version: string;
  /** 7-char git SHA. */
  commit: string;
  /** Full 40-char git SHA. */
  commitFull: string;
  /** `git rev-list --count HEAD` — monotonic, reflects code progress. */
  build: number;
  /** ISO-8601 UTC build time. */
  date: string;
  /** Release channel. */
  channel: 'stable' | 'beta';
}

const UNSET_BUILD_INFO: BuildInfo = {
  version: '0.0.0',
  commit: 'unknown',
  commitFull: 'unknown',
  build: 0,
  date: '',
  channel: 'stable',
};

let installed: BuildInfo = UNSET_BUILD_INFO;

/** Install the host's build metadata. Called once per entry point at boot. */
export function setBuildInfo(info: BuildInfo): void {
  installed = info;
}

/** The running host's build metadata, or an unset placeholder pre-install. */
export function getBuildInfo(): BuildInfo {
  return installed;
}
