/**
 * Desktop app — main-process entry point. Thin orchestrator; per-concern
 * wiring lives under `./main/bootstrap/`.
 *
 * Eval-time ordering matters:
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
 *   - `installProtocolHandler`        — registers `open-url` BEFORE
 *                                       `whenReady` to catch the very
 *                                       first macOS deep link.
 *
 * Inside `whenReady`:
 *   - `registerAsProtocolHandler`     — claim the `openheaders://` scheme.
 *   - `createMainWindow + installTray` — UI surfaces; window paints
 *                                       immediately while the engine boots
 *                                       in parallel.
 *   - `installRpcHost`                — engine bootstrap; `signalEngineReady`
 *                                       drains the RPC queue on completion.
 */

import { app } from 'electron';
import { installAboutPanel } from './main/bootstrap/about-panel';
import { installApplicationMenu } from './main/bootstrap/application-menu';
import { installChromiumSwitches } from './main/bootstrap/cli-switches';
import { installExternalLinkHandler } from './main/bootstrap/external-links';
import { createLogger, installMainLogger } from './main/bootstrap/logger';
import { installProcessDiagnostics } from './main/bootstrap/process-diagnostics';
import { drainPendingProtocolUrls, installProtocolHandler, registerAsProtocolHandler } from './main/bootstrap/protocol';
import { markQuitting } from './main/bootstrap/quit-state';
import { installRpcQueue } from './main/bootstrap/rpc-queue';
import { enforceSingleInstanceLock } from './main/bootstrap/single-instance';
import { installStartupDataBridge } from './main/bootstrap/startup-data-bridge';
import { installTray } from './main/bootstrap/tray';
import { createMainWindow, showMainWindow } from './main/bootstrap/window-manager';
import { installRpcHost } from './main/install-rpc-host';

const APP_DISPLAY_NAME = 'Open Headers';

const logger = createLogger('main');

// ── Eval-time wiring ──────────────────────────────────────────────

// userData override — must land before ANY consumer of
// `app.getPath('userData')`: the logger writes there, storage/persistence
// key off it, and the single-instance lock is scoped to it (so an
// overridden instance never races a real install). E2E harnesses point
// this at a temp dir to run a fully isolated app.
const userDataOverride = process.env.OPENHEADERS_USER_DATA_DIR;
if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}

// Chromium command-line switches must precede `app` initialization —
// they're consumed once at network-stack construction.
installChromiumSwitches();

// Logger next so every subsequent bootstrap call lands in
// `<userData>/logs/main.log`.
installMainLogger();

// Then process diagnostics — any throw in later bootstrap calls
// surfaces in the same log file.
installProcessDiagnostics();

// Must precede any UI surface that reads `app.getName()` — notably the
// macOS application menu's app-menu label and the About panel.
app.setName(APP_DISPLAY_NAME);

enforceSingleInstanceLock();
installStartupDataBridge();
const { signalEngineReady } = installRpcQueue();
installExternalLinkHandler();
installProtocolHandler();

void app.whenReady().then(() => {
  registerAsProtocolHandler();
  installAboutPanel();
  installApplicationMenu();

  createMainWindow();
  installTray();
  drainPendingProtocolUrls();

  // macOS: dock click re-shows the existing (hidden) window.
  app.on('activate', showMainWindow);

  installRpcHost()
    .catch((err) => {
      logger.error('installRpcHost failed', err);
    })
    .finally(signalEngineReady);
});

app.on('before-quit', markQuitting);

// Tray-resident: explicit `app.quit()` (tray menu / `Cmd+Q`) is the only exit.
app.on('window-all-closed', () => {});

export type { StartupData } from './main/bootstrap/startup-data-bridge';
