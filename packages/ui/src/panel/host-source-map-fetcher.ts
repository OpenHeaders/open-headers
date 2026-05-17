/**
 * Public installation seam for the DevTools panel's source-map fetcher.
 *
 * Hosts (extension, web app, electron) call `setSourceMapFetcher(fn)`
 * once at boot to register their platform-specific fetch path. Without
 * an installed fetcher the cache silently returns null maps and the
 * call-stack view falls back to raw V8 names.
 *
 * Mirrors the `@openheaders/ui/shared/build-info` seam pattern — a tiny
 * file in `src/panel/` with an explicit export-map entry, so host code
 * gets a stable importable path without reaching into `panel/data/`.
 */

export { setSourceMapFetcher } from './data/source-map-cache';
export type { SourceMapFetcher } from './data/source-map-cache';
