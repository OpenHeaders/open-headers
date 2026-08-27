/**
 * The operating system's trust store as a third trust scope (the
 * Trusted Roots plan, S9): the corporate root an IT profile installed
 * in the macOS Keychain / Windows store / Linux bundle, read from the
 * runtime with `tls.getCACertificates('system')` (Node ≥ 22.15) and
 * seated ADDITIVELY beside the bundled roots by `caOptionFor` — never
 * copied into a record, never synced. The read walks the OS store, so
 * it is cached for the process and refreshed only when the device
 * opts in again; a runtime without the API reads as unsupported and
 * the switch stays off there.
 */

import * as tls from 'node:tls';

/** `tls` as a runtime that may predate the store reader (Node < 22.15) sees it. */
interface TlsWithStoreReader {
  rootCertificates: readonly string[];
  getCACertificates?: (type: 'system') => string[];
}

const runtime: TlsWithStoreReader = tls;

let cache: readonly string[] | null = null;

export function isSystemTrustSupported(): boolean {
  return typeof runtime.getCACertificates === 'function';
}

/** The system store's certificates, PEM — empty on a runtime without the API. */
export function getSystemCaCertificates(): readonly string[] {
  const read = runtime.getCACertificates;
  if (read === undefined) return [];
  if (cache === null) cache = read('system');
  return cache;
}

/** Re-read the OS store on the next dial (a root installed since boot). */
export function refreshSystemCaCertificates(): void {
  cache = null;
}
