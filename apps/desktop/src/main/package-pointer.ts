/**
 * The channel's Windows package pointer —
 * `desktop/<channel>/windows-package.json` on the update feed, written by
 * the release workflow. An installed package reads it to learn of an
 * update (`msix-updater-port.ts`); a classic install reads it to learn
 * whether it may switch to the package (`package-switch-facts.ts`).
 */

import { type UpdateChannel, windowsPackagePointerUrl } from './update-feed';
import { isVersionString } from './versions-manifest';

export interface PackagePointer {
  version: string;
  /** The release is held back from installs and updates alike. */
  stop: boolean;
  /** The asked arch's link; null when the pointer names no package for it. */
  url: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What this install reads from a fetched pointer. Null on a shape it
 * cannot act on. Fields it does not read are passed by: the pointer is a
 * wire contract, and an older app reads newer ones.
 */
export function readPackagePointer(raw: unknown, arch: string): PackagePointer | null {
  if (!isRecord(raw)) return null;
  const { version, stop, packages } = raw;
  if (!isVersionString(version) || typeof stop !== 'boolean' || !isRecord(packages)) return null;
  const entry = packages[arch];
  if (entry === undefined) return { version, stop, url: null };
  if (!isRecord(entry) || typeof entry.url !== 'string' || !entry.url.startsWith('https://')) return null;
  return { version, stop, url: entry.url };
}

/**
 * The channel's pointer, as it is now. Null where there is none: the
 * channel has published no package. Any other failure throws — a feed
 * that could not be read is never "nothing published".
 */
export async function fetchPackagePointer(
  fetchFn: typeof fetch,
  channel: UpdateChannel,
  arch: string,
): Promise<PackagePointer | null> {
  const response = await fetchFn(windowsPackagePointerUrl(channel), { cache: 'no-store', redirect: 'follow' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`update feed returned ${response.status}`);
  const pointer = readPackagePointer(await response.json(), arch);
  if (pointer === null) throw new Error('update feed returned an unreadable package pointer');
  return pointer;
}
