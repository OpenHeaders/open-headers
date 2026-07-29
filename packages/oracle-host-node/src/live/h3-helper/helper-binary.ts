/**
 * Helper binary resolution. Precedence: the `OPENHEADERS_H3_HELPER`
 * env var (dev / live-pass override — static-bundling law: not a
 * distribution channel; set-but-missing stays an honest failure, never
 * a silent fall-through to a bundled copy), then the host-registered
 * locator (desktop: the installer's `resources/h3-helper`; daemon: the
 * SEA payload or the dir shipped beside the bundle). `null` = no
 * helper on this install — the transport fails a `'3'` send honestly
 * PRE-wire.
 */

import { existsSync } from 'node:fs';

/**
 * Lazily resolves the host's packaged helper binary, or null when the
 * install carries none. Registered once at host boot and consulted
 * only on a `'3'` send, so a SEA host can defer its payload unpack
 * until HTTP/3 is actually used.
 */
export type H3HelperLocator = () => string | null;

let packagedLocator: H3HelperLocator | null = null;

export function registerH3HelperLocator(locator: H3HelperLocator | null): void {
  packagedLocator = locator;
}

/** The helper's file name on one platform. */
export function h3HelperBinaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'oh-h3-helper.exe' : 'oh-h3-helper';
}

/**
 * The build-matrix target name (`mac-arm64`, `win-x64`, …) the staging
 * pipeline keys per-platform helper builds by, or null off the
 * five-target matrix (mac arm64/x64, win x64, linux x64/arm64).
 */
export function h3HelperTargetName(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
): string | null {
  const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform === 'linux' ? 'linux' : null;
  if (os === null || (arch !== 'x64' && arch !== 'arm64')) return null;
  if (os === 'win' && arch === 'arm64') return null;
  return `${os}-${arch}`;
}

export function resolveH3HelperBinary(): string | null {
  const override = process.env.OPENHEADERS_H3_HELPER;
  if (override !== undefined && override !== '') return existsSync(override) ? override : null;
  if (packagedLocator !== null) {
    try {
      const packaged = packagedLocator();
      if (packaged !== null && existsSync(packaged)) return packaged;
    } catch {
      // A failed locator (e.g. a corrupt payload unpack) degrades to
      // the honest not-bundled failure; the host owns its own logging.
    }
  }
  return null;
}
