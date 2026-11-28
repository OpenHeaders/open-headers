/**
 * The one line the package-switch row shows under its button: why this
 * install may not switch, or how the last switch stopped.
 *
 * Reasons that read the same to a person share a sentence. A stop is said
 * by what the installer's exit code means for them (the codes are the
 * installer program's, `native/windows-installer/src/outcome.rs`): this
 * PC, the download, Windows' install, the package's own start, the app
 * staying open.
 */

import type { PackageSwitchBlocker } from '@openheaders/core/bridge';
import type { MessageKey } from '@openheaders/i18n';

const CANNOT_SWITCH: MessageKey = 'workbench.settings.def.updates.installType.reason.cannotSwitch';
const DATA_FOLDER: MessageKey = 'workbench.settings.def.updates.installType.reason.dataFolder';

const REASON_KEYS: Record<PackageSwitchBlocker, MessageKey> = {
  // Never shown: off a classic install the row is not there.
  'not-classic-install': CANNOT_SWITCH,
  'windows-too-old': 'workbench.settings.def.updates.installType.reason.windowsTooOld',
  'no-installer': CANNOT_SWITCH,
  'data-folder-elsewhere': CANNOT_SWITCH,
  'data-folder-not-plain': DATA_FOLDER,
  'data-on-another-volume': DATA_FOLDER,
  'package-installed': 'workbench.settings.def.updates.installType.reason.packageInstalled',
  'package-data-left': 'workbench.settings.def.updates.installType.reason.packageDataLeft',
  'feed-unread': 'workbench.settings.def.updates.installType.reason.feedUnread',
  'no-package-offered': 'workbench.settings.def.updates.installType.reason.noPackageOffered',
  'held-back': 'workbench.settings.def.updates.installType.reason.heldBack',
  'package-older': 'workbench.settings.def.updates.installType.reason.packageOlder',
};

export function packageSwitchReasonKey(blocker: PackageSwitchBlocker): MessageKey {
  return REASON_KEYS[blocker];
}

/**
 * The sentence for a switch that stopped with `code`; null where the row
 * says nothing — a package there already is said by the reason the next
 * read gives, and a cancel was the person's own. A stop without a code is
 * an installer that ended before it could say.
 */
export function packageSwitchStopKey(code: number | null): MessageKey | null {
  if (code === 35 || code === 40) return null;
  if (code === 10 || code === 11 || code === 12) return 'workbench.settings.def.updates.installType.stopped.thisPc';
  if (code !== null && code >= 20 && code <= 23) return 'workbench.settings.def.updates.installType.stopped.download';
  if (code === 30) return 'workbench.settings.def.updates.installType.stopped.install';
  if (code === 32) return 'workbench.settings.def.updates.installType.stopped.packageStart';
  if (code === 33) return 'workbench.settings.def.updates.installType.stopped.appStayed';
  return 'workbench.settings.def.updates.installType.stopped.other';
}
