/**
 * Whether this install may switch to the Windows package — and when it
 * may not, the one reason a person is shown beside the button.
 *
 * A switch puts the package in the classic install's place and hands it
 * the data by one rename of the classic folder into the package's. Every
 * rule here is a way that would end otherwise: an install that is not
 * the classic one has no uninstaller to run in its move mode; an older
 * Windows takes no package; a rename does not cross volumes and does not
 * follow a link; a package that is installed already is the app on this
 * account, and a folder an earlier package left would be opened in place
 * of the data; a package older than the app would open newer data.
 *
 * What is read of this PC and of the feed is handed in: the rule itself
 * reads nothing.
 */

import * as path from 'node:path';
import type { PackageSwitchBlocker, PackageSwitchVerdict } from '@openheaders/core/bridge';
import { compareCalVer } from '../versions-manifest';
import type { InstallKind } from './install-kind';

/** Windows 10 2004, the oldest build that takes the package: the floor its manifest names. */
export const PACKAGE_MINIMUM_WINDOWS_BUILD = 19041;

/** What the channel's package pointer offers this PC. */
export type PackageOffer =
  /** The feed did not answer, or answered with a pointer this app cannot read. */
  | { readonly state: 'unread' }
  /** The channel has published no package. */
  | { readonly state: 'none' }
  | {
      readonly state: 'read';
      readonly version: string;
      /** The release is held back from installs and updates alike. */
      readonly stop: boolean;
      /** Whether the pointer names a package of this PC's arch. */
      readonly forThisArch: boolean;
    };

export interface PackageSwitchFacts {
  readonly installKind: InstallKind | null;
  /** The build number of this Windows; null when it could not be read. */
  readonly windowsBuild: number | null;
  /** Whether the app's tree carries the installer program that makes the move. */
  readonly hasInstaller: boolean;
  /** The folder this run keeps its data in. */
  readonly dataDir: string;
  /** The classic install's data folder, under Roaming AppData. */
  readonly classicDir: string;
  /** A real folder lies there — not a link, not a junction. */
  readonly classicDirIsPlain: boolean;
  /** The package's data folder, under Local AppData. */
  readonly packageDir: string;
  readonly packageDirIsAbsent: boolean;
  /** Whether Windows lists a package of ours for this user; null when it did not say. */
  readonly packageInstalled: boolean | null;
  /** This app's own version. */
  readonly appVersion: string;
  readonly offer: PackageOffer;
}

/** The reasons and the verdict are the page's too: they are declared where the channel is. */
export type { PackageSwitchBlocker };
export type PackageSwitchEligibility = PackageSwitchVerdict;

/** Windows names a folder without regard to case. */
function sameFolder(a: string, b: string): boolean {
  return path.win32.normalize(a).toLowerCase() === path.win32.normalize(b).toLowerCase();
}

/** The drive or the share a path lies on. */
function sameVolume(a: string, b: string): boolean {
  return path.win32.parse(a).root.toLowerCase() === path.win32.parse(b).root.toLowerCase();
}

function blocked(blocker: PackageSwitchBlocker): PackageSwitchEligibility {
  return { eligible: false, blocker };
}

/** The first rule a switch would break decides: this PC's own before the feed's. */
export function packageSwitchEligibility(facts: PackageSwitchFacts): PackageSwitchEligibility {
  if (facts.installKind !== 'nsis') return blocked('not-classic-install');
  if (facts.windowsBuild === null || facts.windowsBuild < PACKAGE_MINIMUM_WINDOWS_BUILD) {
    return blocked('windows-too-old');
  }
  if (!facts.hasInstaller) return blocked('no-installer');
  if (!sameFolder(facts.dataDir, facts.classicDir)) return blocked('data-folder-elsewhere');
  if (!facts.classicDirIsPlain) return blocked('data-folder-not-plain');
  if (!sameVolume(facts.classicDir, facts.packageDir)) return blocked('data-on-another-volume');
  // No answer counts as installed, as it does on the way home.
  if (facts.packageInstalled !== false) return blocked('package-installed');
  if (!facts.packageDirIsAbsent) return blocked('package-data-left');
  const { offer } = facts;
  if (offer.state === 'unread') return blocked('feed-unread');
  if (offer.state === 'none' || !offer.forThisArch) return blocked('no-package-offered');
  if (offer.stop) return blocked('held-back');
  if (compareCalVer(offer.version, facts.appVersion) < 0) return blocked('package-older');
  return { eligible: true, version: offer.version };
}
