/**
 * HTTP/3 helper bootstrap (the request-engine H3-protocol design): where
 * the desktop finds the bundled `oh-h3-helper` binary the `'3'`
 * HTTP-version pin spawns. Packaged builds carry it under
 * `resources/h3-helper` — the per-arch copy the afterPack hook stages
 * from the cargo build matrix; a dev tree points at the crate's own
 * staged/release outputs so the live-pass recipe's local build is
 * found without any override. Pure path derivation, mirroring
 * `nm-host-install`, so the wiring stays unit-testable.
 */

import * as path from 'node:path';
import { h3HelperBinaryName, h3HelperTargetName } from '@openheaders/oracle-host-node/live/h3-helper/helper-binary';

export interface H3HelperBinaryFacts {
  /** `app.isPackaged` — extraResource vs monorepo sibling. */
  isPackaged: boolean;
  /** `process.resourcesPath` — the packaged app's resources dir. */
  resourcesPath: string;
  /** `app.getAppPath()` — `apps/desktop` in dev. */
  appPath: string;
  /** `process.platform` — picks the binary name (`.exe` on Windows). */
  platform: NodeJS.Platform;
  /** `process.arch` — picks the dev tree's staged matrix target. */
  arch: NodeJS.Architecture;
}

/**
 * Where the shipped helper binary may live, most specific first. The
 * resolver takes the first existing candidate; none existing keeps the
 * honest not-bundled failure.
 */
export function h3HelperBinaryCandidates(facts: H3HelperBinaryFacts): string[] {
  const binaryName = h3HelperBinaryName(facts.platform);
  if (facts.isPackaged) return [path.join(facts.resourcesPath, 'h3-helper', binaryName)];
  const crateRoot = path.resolve(facts.appPath, '..', '..', 'native', 'h3-helper');
  const target = h3HelperTargetName(facts.platform, facts.arch);
  return [
    ...(target !== null ? [path.join(crateRoot, 'dist', target, binaryName)] : []),
    path.join(crateRoot, 'target', 'release', binaryName),
  ];
}
