/**
 * Main-process half of the `oh.desktop.localData.remove` channel: a
 * Windows package removing its own data and capture trust
 * (`bootstrap/local-data-removal`). This plane hands the rule the
 * process's own edges — the launch alias as Windows keeps it, the
 * browsers' keys, the quit through the lifecycle and the new start
 * through the alias. The trust teardown is the engine's and is handed in.
 *
 * An install with no removal answers nothing here: no other install
 * gains a channel.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import { app, dialog } from 'electron';
import { requestQuit } from './bootstrap/lifecycle';
import {
  type LocalDataRemovalRequestSeams,
  REMOVE_LOCAL_DATA_SWITCH,
  requestLocalDataRemoval,
  withdrawRemovalRequest,
} from './bootstrap/local-data-removal';
import { mainTranslator } from './bootstrap/locale';
import { packageAliasStates } from './bootstrap/package-aliases';
import { handOverToPackage } from './bootstrap/package-hand-over';
import { removeWindowsNmRegistryKeys, windowsNmManifestTargets } from './nm-host-install';

export interface LocalDataRemovalRpcOptions {
  /** The folder a removal deletes; null in an install that has no removal. */
  readonly target: string | null;
  /** `oh.daemon.proxy.trust.remove` with the authority's key dropped, through the engine. */
  readonly undoTrust: () => Promise<BridgeRpcResponse<'oh.daemon.proxy.trust.remove'>>;
  readonly log: { info(message: string): void; warn(message: string): void };
  /** Test seams; default to this process's own edges. */
  readonly seams?: Partial<Omit<LocalDataRemovalRequestSeams, 'undoTrust'>>;
}

export interface LocalDataRemovalRpc {
  /** Answers `oh.desktop.localData.remove`; undefined for any other type, and in an install with no removal. */
  dispatch(type: unknown, message: Record<string, unknown>): Promise<unknown> | undefined;
}

/**
 * The app's last act before its folder goes: it starts itself again to
 * delete it, and ends. A start Windows refuses leaves everything as it
 * is — the request is withdrawn and the person is told.
 */
function quitToRemove(target: string, localAppDataDir: string): void {
  requestQuit({
    reason: 'remove-local-data',
    finish: () => {
      void handOverToPackage({ localAppDataDir, args: [REMOVE_LOCAL_DATA_SWITCH] }).then((started) => {
        if (!started) {
          withdrawRemovalRequest(target);
          dialog.showMessageBoxSync({
            type: 'error',
            title: app.getName(),
            message: mainTranslator()('desktop.dialog.dataRemoval.notStarted'),
          });
        }
        app.quit();
      });
    },
  });
}

export function createLocalDataRemovalRpc(options: LocalDataRemovalRpcOptions): LocalDataRemovalRpc {
  const localAppDataDir = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const seams: LocalDataRemovalRequestSeams = {
    appAlias: () => packageAliasStates({ localAppDataDir }).app,
    undoTrust: options.undoTrust,
    removeBrowserKeys: async (dataDir) => {
      const removals = await removeWindowsNmRegistryKeys({
        dataDir,
        targets: windowsNmManifestTargets(
          localAppDataDir,
          process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
        ),
      });
      for (const removal of removals) {
        const line = `NM key ${removal.action}: ${removal.browser} → ${removal.registryKey}`;
        if (removal.action === 'failed') options.log.warn(line);
        else options.log.info(line);
      }
    },
    // On the next tick, so the caller's answer leaves before the windows go.
    quitToRemove: (target) => void setImmediate(() => quitToRemove(target, localAppDataDir)),
    ...options.seams,
  };
  return {
    dispatch(type, message) {
      if (type !== 'oh.desktop.localData.remove' || options.target === null) return undefined;
      return requestLocalDataRemoval({ target: options.target, force: message.force === true }, seams);
    },
  };
}
