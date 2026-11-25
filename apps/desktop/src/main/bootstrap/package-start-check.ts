/**
 * The check a move to the Windows package makes before the classic
 * install is removed: does the package start on this machine?
 *
 * The classic app starts the package through its launch alias with
 * {@link CHECK_PACKAGE_START_SWITCH} and reads how the process ends. The
 * check starts the app's runtime, proves the parts a start cannot do
 * without, and ends. It is not an app instance: it opens neither data
 * folder, asks for no lock, binds no port, and writes nothing a browser
 * or the system reads.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openSqliteDatabase } from '@openheaders/oracle-host-node/sync/sqlite-database';
import { app } from 'electron';
import { nmHostBinaryCandidate } from '../nm-host-install';
import { type InstallKind, installKind } from './install-kind';
import { missingPackageAliases } from './package-aliases';
import { startOnScratchProfile } from './scratch-profile';

/** The switch the classic app starts the package with. Permanent: an older classic app starts a newer package. */
export const CHECK_PACKAGE_START_SWITCH = '--check-package-start';

/** How the check ends. Permanent, as the switch is. */
export const PACKAGE_START_CHECK_EXIT = { starts: 0, notAPackage: 3, partDidNotLoad: 4, timedOut: 5 } as const;

/** The check ends by itself well before its caller stops waiting. */
const CHECK_DEADLINE_MS = 30_000;

export interface PackageStartCheckFacts {
  readonly installKind: InstallKind | null;
  /** Whether the browser helper lies in the tree. */
  readonly helperPresent: boolean;
  /** The package's launch aliases Windows does not keep for this user. */
  readonly missingAliases: readonly string[];
}

export interface PackageStartCheckSeams {
  /** Opens the data engine without a file; throws when its native part does not load. */
  readonly openDataEngine: () => void;
}

export interface PackageStartCheck {
  readonly exitCode: number;
  /** What failed, for the caller's log; null when the package starts. */
  readonly why: string | null;
}

export function checkPackageStart(facts: PackageStartCheckFacts, seams: PackageStartCheckSeams): PackageStartCheck {
  if (facts.installKind !== 'msix') {
    return {
      exitCode: PACKAGE_START_CHECK_EXIT.notAPackage,
      why: `started as ${facts.installKind ?? 'no Windows install'}`,
    };
  }
  if (!facts.helperPresent) {
    return { exitCode: PACKAGE_START_CHECK_EXIT.partDidNotLoad, why: 'the browser helper is not in the package' };
  }
  if (facts.missingAliases.length > 0) {
    return {
      exitCode: PACKAGE_START_CHECK_EXIT.partDidNotLoad,
      why: `Windows keeps no launch alias ${facts.missingAliases.join(', ')}`,
    };
  }
  try {
    seams.openDataEngine();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { exitCode: PACKAGE_START_CHECK_EXIT.partDidNotLoad, why: `the data engine did not load: ${detail}` };
  }
  return { exitCode: PACKAGE_START_CHECK_EXIT.starts, why: null };
}

function end(check: PackageStartCheck): void {
  if (check.why !== null) process.stderr.write(`${check.why}\n`);
  app.exit(check.exitCode);
}

/** Runs the check INSTEAD of the app. Ends the process itself. */
export function runPackageStartCheck(): void {
  startOnScratchProfile();
  const helperBinaryPath = nmHostBinaryCandidate({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    platform: process.platform,
  });
  const deadline = setTimeout(() => {
    end({ exitCode: PACKAGE_START_CHECK_EXIT.timedOut, why: 'the check did not finish in time' });
  }, CHECK_DEADLINE_MS);
  void app.whenReady().then(() => {
    clearTimeout(deadline);
    const kind = installKind();
    end(
      checkPackageStart(
        {
          installKind: kind,
          helperPresent: existsSync(helperBinaryPath),
          missingAliases: missingPackageAliases({
            installKind: kind,
            localAppDataDir: process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
          }),
        },
        { openDataEngine: () => openSqliteDatabase(':memory:').close() },
      ),
    );
  });
}
