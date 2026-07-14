/**
 * host-os — classify the Node host's own operating system as a core
 * {@link PlatformKind}, distro-aware on Linux via `/etc/os-release`.
 * Stamped onto the home Org row at boot so joiners can render the OS
 * identity mark for a server they never touch.
 */

import { readFileSync } from 'node:fs';
import os from 'node:os';
import type { PlatformKind } from '@openheaders/core/utils';

/**
 * Resolve a `PlatformKind` from `/etc/os-release` content: the `ID`
 * field first, then the `ID_LIKE` chain (e.g. Mint reads as ubuntu,
 * CentOS/RHEL as fedora), else plain `linux`.
 */
export function parseOsRelease(content: string): PlatformKind {
  const fields = new Map<string, string>();
  for (const line of content.split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, '');
    fields.set(key, value.toLowerCase());
  }
  const candidates = [fields.get('ID') ?? '', ...(fields.get('ID_LIKE') ?? '').split(/\s+/)];
  for (const candidate of candidates) {
    if (candidate === 'ubuntu') return 'ubuntu';
    if (candidate === 'debian') return 'debian';
    if (candidate === 'fedora') return 'fedora';
  }
  return 'linux';
}

/**
 * The running Node process's platform. `undefined` for platforms
 * without a mark of their own (the BSDs, illumos) — the Org row then
 * carries no `hostOs` and consumers keep the generic glyph.
 */
export function detectNodeHostOs(): PlatformKind | undefined {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      try {
        return parseOsRelease(readFileSync('/etc/os-release', 'utf8'));
      } catch {
        return 'linux';
      }
    default:
      return undefined;
  }
}

/**
 * The machine's hostname, first label, lower-cased — how this host is
 * named when it answers work on a peer's behalf (the executed-run
 * `executedOn` attribution). Mirrors the mDNS instance label so the
 * name a user discovers the host by is the name their runs credit.
 */
export function hostDisplayLabel(): string {
  let raw: string;
  try {
    raw = os.hostname();
  } catch {
    raw = '';
  }
  const label = raw.split('.')[0]?.trim().toLowerCase() ?? '';
  return label !== '' ? label : 'openheaders-daemon';
}
