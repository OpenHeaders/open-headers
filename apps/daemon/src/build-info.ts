/**
 * Typed access to the bundle's build metadata (`__BUILD_INFO__`,
 * injected by Vite — see `vite.config.ts`). Unbundled runs (vitest,
 * in-tree tsx) have no define and answer null; callers then print the
 * package version alone. Same field shape as the UI shells'
 * `@openheaders/ui/shared/build-info`, kept local because the daemon
 * ships no UI bundle.
 */

export interface DaemonBuildInfo {
  version: string;
  commit: string;
  commitFull: string;
  build: number;
  date: string;
  channel: 'stable' | 'beta';
}

export function getBuildInfo(): DaemonBuildInfo | null {
  return typeof __BUILD_INFO__ === 'undefined' ? null : __BUILD_INFO__;
}

/**
 * ` (commit abc1234 · build 4523 · 2026-07-09)` — appended after a
 * version string in `--version` output and the daemon boot line; empty
 * when the build carries no metadata.
 */
export function formatBuildStamp(info: DaemonBuildInfo | null): string {
  if (info === null) return '';
  const day = info.date.slice(0, 10);
  return ` (commit ${info.commit} · build ${info.build}${day ? ` · ${day}` : ''})`;
}
