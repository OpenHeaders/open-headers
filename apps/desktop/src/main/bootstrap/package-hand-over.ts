/**
 * A classic app hands its start over to the Windows package.
 *
 * Where a package of ours is installed and the classic app has no data
 * folder of its own, the package is the app on this account: the classic
 * app starts it through its launch alias and ends, before it has chosen
 * or made a folder. The alias is the only way in — Windows keeps none
 * when the person has switched it off, and the start is then refused.
 */

import { spawn } from 'node:child_process';
import { PACKAGE_APP_ALIAS, packageAliasPath } from './package-aliases';

export interface PackageHandOverFacts {
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string;
  /** What this start was asked to open, passed on as it came. */
  readonly args: readonly string[];
}

export interface PackageHandOverSeams {
  /** Starts a program that outlives this one; false when Windows refuses. Defaults to a detached start. */
  readonly start?: (file: string, args: readonly string[]) => Promise<boolean>;
}

function startDetached(file: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(file, [...args], { detached: true, stdio: 'ignore' });
      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Starts the package's app. False when it could not be started: its alias is off, or Windows refused. */
export function handOverToPackage(facts: PackageHandOverFacts, seams: PackageHandOverSeams = {}): Promise<boolean> {
  return (seams.start ?? startDetached)(packageAliasPath(facts.localAppDataDir, PACKAGE_APP_ALIAS), facts.args);
}
