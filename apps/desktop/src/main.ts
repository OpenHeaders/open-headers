/**
 * Desktop app — main-process entry point. Thin orchestrator; per-concern
 * wiring lives under `./main/bootstrap/`.
 *
 * Eval-time ordering matters:
 *   - `enforceSingleInstanceLock`     — must come first; lost races quit.
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
import { installRpcHost } from './main/install-rpc-host';
import { installApplicationMenu } from './main/bootstrap/application-menu';
import {
  drainPendingProtocolUrls,
  installProtocolHandler,
  registerAsProtocolHandler,
} from './main/bootstrap/protocol';
import { createLogger, installMainLogger } from './main/bootstrap/logger';
import { installProcessDiagnostics } from './main/bootstrap/process-diagnostics';
import { markQuitting } from './main/bootstrap/quit-state';
import { installRpcQueue } from './main/bootstrap/rpc-queue';
import { enforceSingleInstanceLock } from './main/bootstrap/single-instance';
import { installStartupDataBridge } from './main/bootstrap/startup-data-bridge';
import { installTray } from './main/bootstrap/tray';
import { createMainWindow, showMainWindow } from './main/bootstrap/window-manager';

const APP_DISPLAY_NAME = 'Open Headers';

const logger = createLogger('main');

// ── Eval-time wiring ──────────────────────────────────────────────

// Logger first so every subsequent bootstrap call lands in
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
installProtocolHandler();

void app.whenReady().then(() => {
  registerAsProtocolHandler();
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
