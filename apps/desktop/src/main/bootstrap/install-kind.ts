/**
 * How this copy of the app was installed on Windows — read once, and the
 * one fact every Windows-package behaviour is gated on.
 *
 * The classic installer, the MSI and the Windows package wrap the same
 * signed tree, so nothing inside the tree tells them apart. Each wrapper
 * is known by the one file only it adds: the package's manifest above the
 * program's folder, the classic installer's uninstaller beside the
 * program. An install with neither is the MSI.
 *
 * A package has a second sign, the identity Windows gives its process.
 * Either sign means a package: a start that lost one of them (a program
 * the app started itself may not carry the identity) must still open the
 * package's data and never register the package folder's path.
 *
 * Off Windows nothing is read and there is no kind.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

export type InstallKind = 'nsis' | 'msi' | 'msix' | 'dev';

/** The package's manifest, in the folder above the program's (`app\`). */
export const PACKAGE_MANIFEST_FILE_NAME = 'AppxManifest.xml';

/** The classic installer's uninstaller, beside the program. */
export const CLASSIC_UNINSTALLER_FILE_NAME = 'Uninstall OpenHeaders.exe';

export interface InstallKindFacts {
  /** `process.platform`. */
  readonly platform: NodeJS.Platform;
  /** `app.isPackaged`. */
  readonly isPackaged: boolean;
  /** `process.windowsStore` — the process carries a Windows package's identity. */
  readonly hasPackageIdentity: boolean;
  /** `process.execPath` — the app's own program. */
  readonly executablePath: string;
}

export interface InstallKindSeams {
  /** Defaults to `fs.existsSync`. */
  readonly fileExists?: (target: string) => boolean;
}

export interface InstallKindReading {
  /** Null off Windows. */
  readonly kind: InstallKind | null;
  /** The one sign of a package that spoke when the other did not; null when they agree. */
  readonly lonePackageSign: 'identity' | 'manifest' | null;
}

export function deriveInstallKind(facts: InstallKindFacts, seams: InstallKindSeams = {}): InstallKindReading {
  if (facts.platform !== 'win32') return { kind: null, lonePackageSign: null };
  const fileExists = seams.fileExists ?? fs.existsSync;
  const programDir = path.dirname(facts.executablePath);
  const hasManifest = fileExists(path.join(path.dirname(programDir), PACKAGE_MANIFEST_FILE_NAME));
  if (facts.hasPackageIdentity || hasManifest) {
    const lonePackageSign = facts.hasPackageIdentity === hasManifest ? null : hasManifest ? 'manifest' : 'identity';
    return { kind: 'msix', lonePackageSign };
  }
  if (!facts.isPackaged) return { kind: 'dev', lonePackageSign: null };
  const kind = fileExists(path.join(programDir, CLASSIC_UNINSTALLER_FILE_NAME)) ? 'nsis' : 'msi';
  return { kind, lonePackageSign: null };
}

let reading: InstallKindReading | null = null;

/** This process's install kind, with what the two package signs said. */
export function installKindReading(): InstallKindReading {
  reading ??= deriveInstallKind({
    platform: process.platform,
    isPackaged: app.isPackaged,
    hasPackageIdentity: process.windowsStore === true,
    executablePath: process.execPath,
  });
  return reading;
}

export function installKind(): InstallKind | null {
  return installKindReading().kind;
}
