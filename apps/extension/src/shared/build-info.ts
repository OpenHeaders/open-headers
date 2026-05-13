/**
 * Build metadata accessor.
 *
 * The shape is injected at build time by Vite (`__BUILD_INFO__`, see
 * `vite.config.ts`) and also written to `dist/<browser>/build-info.json`
 * for external tooling that wants to read the manifest without parsing
 * the bundle.
 */

export interface BuildInfo {
  /** Free-text label, e.g. "2026.5.0" or "2026.5.0-beta.1". */
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

export function getBuildInfo(): BuildInfo {
  return __BUILD_INFO__;
}
