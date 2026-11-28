/**
 * Package-switch bridge RPCs — a classic Windows install switching to
 * the Windows package. Desktop-shell answered, by the Electron main
 * process of a classic install alone: it judges whether this install may
 * switch, and on the person's word starts the installer program it
 * carries, which makes the move. No other host answers; the surface gates
 * on the `packageSwitch` capability.
 */

/** Why this install may not switch: the first rule a switch would break, this PC's own before the feed's. */
export type PackageSwitchBlocker =
  | 'not-classic-install'
  | 'windows-too-old'
  | 'no-installer'
  | 'data-folder-elsewhere'
  | 'data-folder-not-plain'
  | 'data-on-another-volume'
  | 'package-installed'
  | 'package-data-left'
  | 'feed-unread'
  | 'no-package-offered'
  | 'held-back'
  | 'package-older';

export type PackageSwitchVerdict =
  /** `version` is the package the switch would install. */
  | { readonly eligible: true; readonly version: string }
  | { readonly eligible: false; readonly blocker: PackageSwitchBlocker };

export type PackageSwitchState =
  | {
      readonly phase: 'idle';
      readonly verdict: PackageSwitchVerdict;
      /** The update channel the verdict was read on: the one a switch installs from. */
      readonly channel: 'stable' | 'beta';
      /** The package that channel offers; null where none was read. */
      readonly offeredVersion: string | null;
      /** The package's own data folder: what an earlier package may have left behind. */
      readonly packageDataDir: string;
      /**
       * How the last switch this app started ended with the install as it
       * was: the installer's exit code, null where it ended without saying.
       * Null while none has.
       */
      readonly lastStop: { readonly code: number | null } | null;
    }
  /** The installer is at work; the app closes when it says so. */
  | { readonly phase: 'working' };

export interface PackageSwitchRpc {
  /** Reads this PC and the feed, and answers whether a switch may begin. While one is at work, answers that. */
  'oh.desktop.packageSwitch.getState': { req: Record<string, never>; res: PackageSwitchState };
  /**
   * Reads again — the page's answer is never trusted — and starts the
   * installer where a switch may begin. Resolves once it is started, or
   * with the reason it was not. One switch at a time.
   */
  'oh.desktop.packageSwitch.start': { req: Record<string, never>; res: PackageSwitchState };
}
