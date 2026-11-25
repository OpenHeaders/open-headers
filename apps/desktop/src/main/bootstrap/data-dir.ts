/**
 * Which folder holds this install's data — the root `app.setPath('userData')`
 * is given, and so the root of everything in `bootstrap/app-paths`, of the
 * log file and of the single-instance lock.
 *
 * A Windows package keeps its data in a folder of its own under Local
 * AppData, never in the classic install's: a plain uninstall of the
 * classic app deletes that one. Every other install keeps the folder it
 * always had.
 */

import * as path from 'node:path';
import { PACKAGE_DATA_DIR_NAME } from './data-folder-return';
import type { InstallKind } from './install-kind';

/**
 * Canonical data-directory name — TitleCase, space-free, identical on
 * every platform (macOS `~/Library/Application Support/OpenHeaders`,
 * Windows `%APPDATA%\OpenHeaders`, Linux `~/.config/OpenHeaders`), the
 * Electron-ecosystem convention (Postman, Slack, Code). Set explicitly
 * because the derived default is whatever the packaged `package.json`
 * `name` happens to be — and `app.setName` never re-points userData.
 * Must stay in step with the log dir's pinned name (bootstrap/logger).
 */
export const APP_DATA_DIR_NAME = 'OpenHeaders';

export interface DataDirFacts {
  readonly installKind: InstallKind | null;
  /** `app.isPackaged` — a development run gets a suffixed folder of its own. */
  readonly isPackaged: boolean;
  /** `app.getPath('appData')`. */
  readonly appDataDir: string;
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string | undefined;
  /** `os.homedir()` — where Local AppData is looked for when the variable is unset. */
  readonly homeDir: string;
}

/** The folder every install but a Windows package keeps its data in. */
export function classicDataDir(facts: Pick<DataDirFacts, 'isPackaged' | 'appDataDir'>): string {
  return path.join(facts.appDataDir, facts.isPackaged ? APP_DATA_DIR_NAME : `${APP_DATA_DIR_NAME}-Dev`);
}

/** The Windows package's own data folder. */
export function packageDataDir(facts: Pick<DataDirFacts, 'localAppDataDir' | 'homeDir'>): string {
  return path.join(facts.localAppDataDir || path.join(facts.homeDir, 'AppData', 'Local'), PACKAGE_DATA_DIR_NAME);
}

export function chooseDataDir(facts: DataDirFacts): string {
  return facts.installKind === 'msix' ? packageDataDir(facts) : classicDataDir(facts);
}
