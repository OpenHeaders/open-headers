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
import { applyHardwareAccelerationPolicy } from './main/bootstrap/hardware-acceleration';
import { installAppLifecycle, isQuitting, trackEngineBoot } from './main/bootstrap/lifecycle';
import { initMainLocale } from './main/bootstrap/locale';
import { createLogger, installMainLogger } from './main/bootstrap/logger';
import { installProcessDiagnostics } from './main/bootstrap/process-diagnostics';
import { drainPendingProtocolUrls, installProtocolHandler, registerAsProtocolHandler } from './main/bootstrap/protocol';
import { installRpcQueue } from './main/bootstrap/rpc-queue';
import { enforceSingleInstanceLock } from './main/bootstrap/single-instance';
import { installStartupDataBridge } from './main/bootstrap/startup-data-bridge';
import { installTray } from './main/bootstrap/tray';
import { createMainWindow, showMainWindow } from './main/bootstrap/window-manager';
import { installRpcHost } from './main/install-rpc-host';
import { installTerminalHost } from './main/install-terminal-host';
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

  // Persisted hardware-acceleration choice (app-menu toggle). Same
  // pre-ready constraint: Chromium reads it once at GPU-process
  // construction. Must follow the userData override — the marker file
  // lives there.
  applyHardwareAccelerationPolicy();

  // Logger next so every subsequent bootstrap call lands in
  // `<userData>/logs/main.log`.
  installMainLogger();
  const logger = createLogger('main');

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
  const { signalEngineReady } = installRpcQueue();
  installExternalLinkHandler();
  installProtocolHandler();

  void app.whenReady().then(() => {
    // A quit already committed (lost single-instance race, instant
    // Cmd+Q) must not grow windows, a tray, or an engine mid-teardown.
    if (isQuitting()) return;
    registerAsProtocolHandler();
    installAboutPanel();
    // OS-resolved locale default before the first menu build; the
    // persisted setting lands via `installLocaleSubscription` once the
    // engine's host storage exists and rebuilds the menus if it differs.
    initMainLocale();
    installApplicationMenu();

    createMainWindow();
    installTray();
    installTerminalHost();
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
      .finally(signalEngineReady);
  });

  // Tray-resident: explicit `app.quit()` (tray menu / `Cmd+Q`) is the only exit.
  app.on('window-all-closed', () => {});
}

export type { StartupData } from './main/bootstrap/startup-data-bridge';
