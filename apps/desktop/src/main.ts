/**
 * Desktop app — main-process entry point. Thin orchestrator; per-concern
 * wiring lives under `./main/bootstrap/`.
 *
 * Eval-time ordering matters:
 *   - `--mcp-stdio` branch            — decided before everything else;
 *                                       a bridge run is a pipe, not an
 *                                       app instance (no lock, no UI).
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
import { hostProcessRoots } from '@openheaders/oracle-host-node/process-reader';
import { app } from 'electron';
import { installAboutPanel } from './main/bootstrap/about-panel';
import { installAppMenuPopupHandler } from './main/bootstrap/app-menu-popup';
import { sessionDataDir } from './main/bootstrap/app-paths';
import { installApplicationMenu } from './main/bootstrap/application-menu';
import { installChromiumSwitches } from './main/bootstrap/cli-switches';
import { chooseDataDir } from './main/bootstrap/data-dir';
import { returnDataFolderFromPackage } from './main/bootstrap/data-folder-return';
import { installDownloadFeedback } from './main/bootstrap/downloads';
import { createEngineReadiness } from './main/bootstrap/engine-readiness';
import { installExternalLinkHandler } from './main/bootstrap/external-links';
import { applyHardwareAccelerationPolicy } from './main/bootstrap/hardware-acceleration';
import { installKindReading } from './main/bootstrap/install-kind';
import { installAppLifecycle, isQuitting, trackEngineBoot } from './main/bootstrap/lifecycle';
import { initMainLocale } from './main/bootstrap/locale';
import { installLogFilesHandler } from './main/bootstrap/log-files';
import { createLogger, installMainLogger } from './main/bootstrap/logger';
import { installProcessDiagnostics } from './main/bootstrap/process-diagnostics';
import { drainPendingProtocolUrls, installProtocolHandler, registerAsProtocolHandler } from './main/bootstrap/protocol';
import { installRpcQueue } from './main/bootstrap/rpc-queue';
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
} else {
  bootstrapDesktopApp();
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
  // reinstall opens the user's data and not an empty folder.
  const dataFolderReturn = userDataOverride
    ? null
    : returnDataFolderFromPackage({
        installKind: install.kind,
        ownDir: ownDataDir,
        localAppDataDir: process.env.LOCALAPPDATA,
      });
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
  if (dataFolderReturn?.outcome === 'returned') {
    logger.info(`data folder taken back from ${dataFolderReturn.from}`);
  } else if (dataFolderReturn?.outcome === 'left') {
    logger.warn(`data folder left at ${dataFolderReturn.from}: ${dataFolderReturn.why}`);
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
  installStartupDataBridge();
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
