/**
 * Desktop app — main-process entry point. Thin orchestrator; per-concern
 * wiring lives under `./main/bootstrap/`.
 *
 * Eval-time ordering matters:
 *   - `--mcp-stdio` branch            — decided before everything else;
 *                                       a bridge run is a pipe, not an
 *                                       app instance (no lock, no UI).
 *   - `--check-package-start` branch  — the same: the check a move to the
 *                                       Windows package makes opens no
 *                                       data folder at all.
 *   - `--remove-local-data` branch    — the same again: the start a
 *                                       Windows package deletes its data
 *                                       folder from must hold no file
 *                                       in it.
 *   - `installChromiumSwitches`       — must precede `app` init; Chromium
 *                                       reads switches once at network-stack
 *                                       construction.
 *   - `enforceSingleInstanceLock`     — must come first among app-level calls;
 *                                       lost races quit.
 *   - `installStartupDataBridge`      — sync IPC must be registered before
 *                                       the preload's `sendSync` fires
 *                                       (preload runs on window load).
 *   - `installRpcQueue`               — registers `oh:rpc` queueing handler
 *                                       so eager-mirror RPCs queue while
 *                                       the engine boots in parallel.
 *   - `installLifelineServer`         — registers the lifeline wire on the
 *                                       same engine-readiness gate, so a
 *                                       port opened during boot is held
 *                                       and admitted once acceptors exist;
 *                                       a closed window's view channels
 *                                       are held there too.
 *   - `installProtocolHandler`        — registers `open-url` BEFORE
 *                                       `whenReady` to catch the very
 *                                       first macOS deep link.
 *
 * Inside `whenReady`:
 *   - `registerAsProtocolHandler`     — claim the `openheaders://` scheme.
 *   - `createMainWindow + installTray` — UI surfaces; window paints
 *                                       immediately while the engine boots
 *                                       in parallel.
 *   - `installRpcHost`                — engine bootstrap; the readiness gate
 *                                       releases the held RPCs and lifeline
 *                                       opens when it settles.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { hostProcessRoots } from '@openheaders/oracle-host-node/process-reader';
import { app, dialog } from 'electron';
import { installAboutPanel } from './main/bootstrap/about-panel';
import { installAppMenuPopupHandler } from './main/bootstrap/app-menu-popup';
import { sessionDataDir } from './main/bootstrap/app-paths';
import { installApplicationMenu } from './main/bootstrap/application-menu';
import { installChromiumSwitches } from './main/bootstrap/cli-switches';
import { chooseDataDir, classicDataDir } from './main/bootstrap/data-dir';
import {
  type DataFolderMove,
  dataLeftByMove,
  FINISH_MOVE_EXIT,
  FINISH_MOVE_SWITCH,
  moveDataFolderToPackage,
  withdrawLeftMoveRequest,
} from './main/bootstrap/data-folder-move';
import {
  claimDataFolder,
  type DataFolderReturn,
  returnDataFolderFromPackage,
} from './main/bootstrap/data-folder-return';
import { installDownloadFeedback } from './main/bootstrap/downloads';
import { createEngineReadiness } from './main/bootstrap/engine-readiness';
import { installExternalLinkHandler } from './main/bootstrap/external-links';
import { applyHardwareAccelerationPolicy } from './main/bootstrap/hardware-acceleration';
import { installKindReading } from './main/bootstrap/install-kind';
import { installAppLifecycle, isQuitting, trackEngineBoot } from './main/bootstrap/lifecycle';
import {
  localDataRemovalTarget,
  REMOVE_LOCAL_DATA_SWITCH,
  runLocalDataRemoval,
  withdrawRemovalRequest,
} from './main/bootstrap/local-data-removal';
import { initMainLocale, mainTranslator } from './main/bootstrap/locale';
import { installLogFilesHandler } from './main/bootstrap/log-files';
import { createLogger, installMainLogger } from './main/bootstrap/logger';
import { installPackageAliasHandlers } from './main/bootstrap/package-alias-bridge';
import { missingPackageAliases } from './main/bootstrap/package-aliases';
import { handOverToPackage } from './main/bootstrap/package-hand-over';
import { CHECK_PACKAGE_START_SWITCH, runPackageStartCheck } from './main/bootstrap/package-start-check';
import { installProcessDiagnostics } from './main/bootstrap/process-diagnostics';
import {
  drainPendingProtocolUrls,
  installProtocolHandler,
  PROTOCOL_SCHEME,
  registerAsProtocolHandler,
} from './main/bootstrap/protocol';
import { installRpcQueue } from './main/bootstrap/rpc-queue';
import { startOnScratchProfile } from './main/bootstrap/scratch-profile';
import { installPermissionPolicy } from './main/bootstrap/security';
import { installSessionSentinel } from './main/bootstrap/session-sentinel';
import { enforceSingleInstanceLock } from './main/bootstrap/single-instance';
import { installStartupDataBridge } from './main/bootstrap/startup-data-bridge';
import { installTray } from './main/bootstrap/tray';
import { installWindowChromeHandler } from './main/bootstrap/window-chrome';
import { createMainWindow, showMainWindow } from './main/bootstrap/window-manager';
import { installLifelineServer } from './main/install-lifeline-server';
import { installRpcHost } from './main/install-rpc-host';
import { installTerminalHost } from './main/install-terminal-host';
import { surfaceViewers } from './main/lifeline/surface-viewers';
import { desktopProcessReader } from './main/process-reader';
import { runMcpStdioBridge } from './mcp-stdio';

const APP_DISPLAY_NAME = 'Open Headers';

// ── Eval-time wiring ──────────────────────────────────────────────

// `--mcp-stdio` runs the protocol bridge INSTEAD of the app — decided
// before any app-level bootstrap so a bridge run never requests the
// single-instance lock (it must coexist with the running instance it
// pipes to) and never creates windows or a tray. The bridge exits the
// process itself when the client closes the pipe.
if (process.argv.includes('--mcp-stdio')) {
  runMcpStdioBridge();
} else if (process.argv.includes(CHECK_PACKAGE_START_SWITCH)) {
  // The check a move to the Windows package makes is not an app instance
  // either: it opens no data folder and asks for no lock.
  runPackageStartCheck();
} else if (process.argv.includes(REMOVE_LOCAL_DATA_SWITCH)) {
  // Nor is the start a Windows package deletes its data folder from: the
  // app that asked has quit, and this one opens nothing in the folder.
  runLocalDataRemoval(APP_DISPLAY_NAME);
} else {
  bootstrapDesktopApp();
}

/**
 * A Windows package that cannot take in the data a move handed over ends
 * the start before a data folder is chosen: started on an empty folder of
 * its own, it would leave the user's data behind. Returns whether the
 * start ends here.
 */
function endStartBeforeDataFolder(move: DataFolderMove | null, finishingMove: boolean): boolean {
  if (move?.outcome === 'classic-still-installed' && finishingMove) {
    startOnScratchProfile();
    app.exit(FINISH_MOVE_EXIT.classicStillInstalled);
    return true;
  }
  if (move?.outcome === 'held') {
    startOnScratchProfile();
    const dataDir = move.from;
    void app.whenReady().then(() => {
      initMainLocale();
      const t = mainTranslator();
      dialog.showErrorBox(
        t('desktop.dialog.dataMoveHeld.title'),
        t('desktop.dialog.dataMoveHeld.message', { path: dataDir }),
      );
      app.exit(FINISH_MOVE_EXIT.dataHeld);
    });
    return true;
  }
  return false;
}

/**
 * A classic app with no data of its own does not start on a fresh folder
 * while the user's data may sit with a Windows package. Where a package is
 * installed, the start is handed over to it. Where a package's folder was
 * left behind and could not be taken back, the person chooses: ask again
 * at a new start, or start empty — the folder claimed here is what makes
 * the next start an ordinary one. Returns whether the start ends here.
 */
function endStartForPackageData(result: DataFolderReturn | null, ownDataDir: string): boolean {
  if (result?.outcome === 'package-installed') {
    startOnScratchProfile();
    const link = process.argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    void handOverToPackage({
      localAppDataDir: process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      args: link === undefined ? [] : [link],
    }).then(async (started) => {
      if (started) {
        app.exit(0);
        return;
      }
      await app.whenReady();
      initMainLocale();
      const t = mainTranslator();
      dialog.showErrorBox(
        t('desktop.dialog.packageRuns.title', { name: APP_DISPLAY_NAME }),
        t('desktop.dialog.packageRuns.message'),
      );
      app.exit(1);
    });
    return true;
  }
  if (result?.outcome === 'left') {
    startOnScratchProfile();
    const { from, reason } = result;
    void app.whenReady().then(() => {
      initMainLocale();
      const t = mainTranslator();
      const startEmpty = 1;
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        title: t('desktop.dialog.dataLeft.title'),
        message: t('desktop.dialog.dataLeft.message', { path: from, reason }),
        buttons: [t('desktop.dialog.dataLeft.tryAgain'), t('desktop.dialog.dataLeft.startEmpty')],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (choice === startEmpty) {
        try {
          claimDataFolder(ownDataDir);
        } catch {
          // The next start finds no folder and asks again.
        }
      }
      app.relaunch();
      app.exit(0);
    });
    return true;
  }
  return false;
}

function bootstrapDesktopApp(): void {
  // userData — must land before ANY consumer of `app.getPath('userData')`:
  // the logger writes there, storage/persistence key off it, and the
  // single-instance lock is scoped to it (so an overridden instance never
  // races a real install). E2E harnesses point OPENHEADERS_USER_DATA_DIR
  // at a temp dir to run a fully isolated app; otherwise the canonical
  // name replaces the package.json-derived default (`open-headers`
  // packaged, `@openheaders/desktop` in dev). Dev runs get their own
  // suffixed dir so `pnpm dev` never shares data — or the userData-scoped
  // single-instance lock — with an installed copy, and a Windows package
  // gets a folder of its own (bootstrap/data-dir).
  const install = installKindReading();
  const userDataOverride = process.env.OPENHEADERS_USER_DATA_DIR;
  const ownDataDir = chooseDataDir({
    installKind: install.kind,
    isPackaged: app.isPackaged,
    appDataDir: app.getPath('appData'),
    localAppDataDir: process.env.LOCALAPPDATA,
    homeDir: homedir(),
  });
  // An installed classic app on Windows takes its data back from the
  // Windows package's folder when a move left it there and the package
  // is gone — before the folder is chosen, so the first start after a
  // reinstall opens the user's data and not an empty folder. It never
  // makes that empty folder by itself while the data may be a package's.
  const dataFolderReturn = userDataOverride
    ? null
    : returnDataFolderFromPackage({
        installKind: install.kind,
        ownDir: ownDataDir,
        localAppDataDir: process.env.LOCALAPPDATA,
      });
  if (endStartForPackageData(dataFolderReturn, ownDataDir)) return;
  // A Windows package takes in the data a move from the classic app
  // handed over — before the folder is chosen as well, so the first
  // start after a move opens the user's data.
  const finishingMove = process.argv.includes(FINISH_MOVE_SWITCH);
  const classicDir = classicDataDir({ isPackaged: app.isPackaged, appDataDir: app.getPath('appData') });
  const dataFolderMove = userDataOverride
    ? null
    : moveDataFolderToPackage({
        installKind: install.kind,
        ownDir: ownDataDir,
        classicDir,
        awaitClassicUninstall: finishingMove,
      });
  if (endStartBeforeDataFolder(dataFolderMove, finishingMove)) return;
  // A package that starts on a folder of its own while a move's data is
  // still in the classic folder says so at every start, until that folder
  // is dealt with.
  const dataLeftAt = userDataOverride ? null : dataLeftByMove({ installKind: install.kind, classicDir });
  // A removal the person asked for and no start took up is withdrawn by
  // the next ordinary start: the request never waits in the folder.
  const removalTarget = localDataRemovalTarget({
    installKind: install.kind,
    userDataOverride,
    localAppDataDir: process.env.LOCALAPPDATA,
    homeDir: homedir(),
  });
  if (removalTarget !== null) withdrawRemovalRequest(removalTarget);
  app.setPath('userData', userDataOverride || ownDataDir);

  // Chromium's profile noise (caches, GPU blobs, Local Storage, service
  // workers) lands under `chromium/` instead of littering the userData
  // root. Must follow the userData override and precede anything that
  // touches the default session — Chromium resolves sessionData once at
  // session construction.
  app.setPath('sessionData', sessionDataDir());

  // Chromium command-line switches must precede `app` initialization —
  // they're consumed once at network-stack construction.
  installChromiumSwitches();

  // Persisted hardware-acceleration choice (app-menu toggle). Same
  // pre-ready constraint: Chromium reads it once at GPU-process
  // construction. Must follow the userData override — the marker file
  // lives there.
  applyHardwareAccelerationPolicy();

  // Logger next so every subsequent bootstrap call lands in
  // `<userData>/logs/main.log`.
  installMainLogger();
  const logger = createLogger('main');
  if (install.kind !== null) logger.info(`install kind: ${install.kind}`);
  if (install.lonePackageSign !== null) {
    logger.warn(`a Windows package by one sign only: ${install.lonePackageSign}`);
  }
  for (const alias of missingPackageAliases({
    installKind: install.kind,
    localAppDataDir: process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
  })) {
    logger.warn(`the launch alias ${alias} is switched off in Windows Settings`);
  }
  if (dataFolderMove?.outcome === 'moved') {
    logger.info(`data folder taken in from ${dataFolderMove.from}`);
    if (dataFolderMove.sharedFilesLeft.length > 0) {
      logger.warn(`not put back in ${dataFolderMove.from}: ${dataFolderMove.sharedFilesLeft.join(', ')}`);
    }
  } else if (dataFolderMove?.outcome === 'ineligible') {
    logger.warn(`data folder left at ${dataFolderMove.from}: it cannot be moved (${dataFolderMove.code})`);
  } else if (dataFolderMove?.outcome === 'classic-still-installed') {
    logger.warn(`data folder left at ${dataFolderMove.from}: the classic app is still installed`);
  }
  if (dataFolderReturn?.outcome === 'returned') {
    logger.info(`data folder taken back from ${dataFolderReturn.from}`);
  }
  // A classic app that starts is not being moved: a request a switch left
  // behind goes. One young enough to be a switch under way stays.
  if (install.kind === 'nsis' && !userDataOverride && withdrawLeftMoveRequest(ownDataDir)) {
    logger.info('a request to move to the Windows package was left in the data folder: removed');
  }

  // Then process diagnostics — any throw in later bootstrap calls
  // surfaces in the same log file.
  installProcessDiagnostics();

  // Must precede any UI surface that reads `app.getName()` — notably the
  // macOS application menu's app-menu label and the About panel.
  app.setName(APP_DISPLAY_NAME);

  enforceSingleInstanceLock();
  // Single quit owner (bootstrap/lifecycle.ts) — after the lock check
  // so a lost race's `app.quit()` still routes through the machine.
  installAppLifecycle();
  installStartupDataBridge({ packageDataTakenIn: dataFolderMove?.outcome === 'moved', packageDataLeftAt: dataLeftAt });
  // The renderer's two doors into main share one gate: the window mounts
  // while the engine boots, and whatever it says first is held, then
  // released in arrival order when the boot settles.
  const engineReadiness = createEngineReadiness();
  installRpcQueue(engineReadiness);
  installLifelineServer(engineReadiness, surfaceViewers);
  installExternalLinkHandler();
  installLogFilesHandler();
  installAppMenuPopupHandler();
  installWindowChromeHandler();
  installPackageAliasHandlers(install.kind);
  installProtocolHandler();

  void app.whenReady().then(() => {
    // A quit already committed (lost single-instance race, instant
    // Cmd+Q) must not grow windows, a tray, or an engine mid-teardown.
    if (isQuitting()) return;
    // The clean-exit sentinel: after the quitting guard, so a lost
    // single-instance race never touches the winner's lock.
    installSessionSentinel();
    // Saved-download feedback: main alone sees the native save dialog's outcome.
    installDownloadFeedback();
    // Default-session permission policy before any window exists.
    installPermissionPolicy();
    registerAsProtocolHandler(install.kind);
    installAboutPanel();
    // OS-resolved locale default before the first menu build; the
    // persisted setting lands via `installLocaleSubscription` once the
    // engine's host storage exists and rebuilds the menus if it differs.
    initMainLocale();
    installApplicationMenu();

    createMainWindow();
    installTray();
    // The registry of roots reads through the host's one reader, and is
    // handed it before anything is spawned — the terminal host and the
    // engine both register what they start.
    const processReader = desktopProcessReader();
    hostProcessRoots.attachReader(processReader);
    installTerminalHost({ processReader, processRoots: hostProcessRoots });
    drainPendingProtocolUrls();

    // macOS: dock click re-shows the existing (hidden) window.
    app.on('activate', showMainWindow);

    // The lifecycle machine serializes quit-vs-boot on this promise: a
    // quit requested mid-boot waits for it to settle before disposing.
    const engineBoot = installRpcHost();
    trackEngineBoot(engineBoot);
    engineBoot
      .catch((err) => {
        logger.error('installRpcHost failed', err);
      })
      .finally(engineReadiness.signalReady);
  });

  // Tray-resident: explicit `app.quit()` (tray menu / `Cmd+Q`) is the only exit.
  app.on('window-all-closed', () => {});
}

export type { StartupData } from './main/bootstrap/startup-data-bridge';
