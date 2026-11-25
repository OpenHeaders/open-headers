/**
 * The Windows package's two launch aliases.
 *
 * A program outside the package cannot start a file in the package's
 * folder by its path, and that folder's name changes with every update.
 * Windows keeps a launch alias per user for each program the package's
 * manifest names one for; the alias is the only path to the package the
 * app may hand to anything outside it — a browser, an MCP client, a
 * person's shell.
 *
 * The names are permanent: they are written into browsers' manifests and
 * into client configurations people keep.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InstallKind } from './install-kind';

/** The app's alias — the name a person types. */
export const PACKAGE_APP_ALIAS = 'openheaders.exe';

/** The browser helper's alias — the path a browser's manifest names. */
export const PACKAGE_HOST_ALIAS = 'openheaders-nm-host.exe';

/** Where Windows keeps this user's alias of that name. */
export function packageAliasPath(localAppDataDir: string, alias: string): string {
  return path.join(localAppDataDir, 'Microsoft', 'WindowsApps', alias);
}

export interface PackageAliasFacts {
  readonly installKind: InstallKind | null;
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string;
}

export interface PackageAliasSeams {
  /** Whether Windows keeps an alias at that path. Defaults to looking, without following it. */
  readonly aliasExists?: (aliasPath: string) => boolean;
}

/** An alias is a link Windows resolves at start; it is looked at, never followed. One that cannot be read counts as there. */
function aliasIsThere(aliasPath: string): boolean {
  try {
    return fs.lstatSync(aliasPath, { throwIfNoEntry: false }) !== undefined;
  } catch {
    return true;
  }
}

/**
 * The package's aliases Windows no longer keeps for this user. A person
 * can switch an alias off in Windows Settings; browsers then fail to
 * start the helper, and a client configured with the app's alias fails
 * to start the app, both without a word. Empty outside a Windows package.
 */
export function missingPackageAliases(facts: PackageAliasFacts, seams: PackageAliasSeams = {}): string[] {
  if (facts.installKind !== 'msix') return [];
  const aliasExists = seams.aliasExists ?? aliasIsThere;
  return [PACKAGE_APP_ALIAS, PACKAGE_HOST_ALIAS].filter(
    (alias) => !aliasExists(packageAliasPath(facts.localAppDataDir, alias)),
  );
}

export interface McpClientCommandFacts {
  readonly installKind: InstallKind | null;
  /** `process.execPath` — the app's own program. */
  readonly executablePath: string;
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string;
}

/**
 * The command an MCP client is told to run to reach this app: the app's
 * alias in a Windows package, the program itself in a classic Windows
 * install — the installer and the MSI put it in different folders. Null
 * everywhere else: the client configuration row keeps the platform's
 * standard install location.
 */
export function mcpClientCommand(facts: McpClientCommandFacts): string | null {
  if (facts.installKind === 'msix') return packageAliasPath(facts.localAppDataDir, PACKAGE_APP_ALIAS);
  if (facts.installKind === 'nsis' || facts.installKind === 'msi') return facts.executablePath;
  return null;
}
