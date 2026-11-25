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

import * as path from 'node:path';

/** The app's alias — the name a person types. */
export const PACKAGE_APP_ALIAS = 'openheaders.exe';

/** The browser helper's alias — the path a browser's manifest names. */
export const PACKAGE_HOST_ALIAS = 'openheaders-nm-host.exe';

/** Where Windows keeps this user's alias of that name. */
export function packageAliasPath(localAppDataDir: string, alias: string): string {
  return path.join(localAppDataDir, 'Microsoft', 'WindowsApps', alias);
}
