import type { FSWatcher } from 'node:fs';
import { errorMessage } from '@openheaders/core';
import httpRequestHandlers from '@/main/modules/ipc/handlers/httpRequestHandlers';
import type { CliApiService } from '@/services/cli/CliApiService';
import { AppStateMachine } from '@/services/core/AppStateMachine';
import serviceRegistry from '@/services/core/ServiceRegistry';
import { HttpRequestService } from '@/services/http/HttpRequestService';
import totpCooldownTracker from '@/services/http/TotpCooldownTracker';
import networkService from '@/services/network/NetworkService';
import webSocketService from '@/services/websocket/ws-service';
import GitSyncService from '@/services/workspace/git/GitSyncService';
import WorkspaceSettingsService from '@/services/workspace/WorkspaceSettingsService';
import workspaceStateService from '@/services/workspace/WorkspaceStateService';
import mainLogger from '@/utils/mainLogger';
import '../../../services/video/video-export-manager'; // Side-effect: registers IPC handlers in constructor

const { createLogger } = mainLogger;
const log = createLogger('AppLifecycle');

class AppLifecycle {
  isQuitting: boolean;
  _cleanupDone: boolean;
  fileWatchers: Map<string, FSWatcher>;
  private _gitSyncService: GitSyncService | null = null;
  private _workspaceSettingsService: WorkspaceSettingsService | null = null;
  private _cliApiService: CliApiService | null = null;

  constructor() {
    this.isQuitting = false;
    this._cleanupDone = false;
    this.fileWatchers = new Map();
  }

  async initializeApp() {
    await AppStateMachine.initialize();

    log.info(`Process argv: ${JSON.stringify(process.argv)}`);
    log.info(`Executable path: ${process.execPath}`);

    AppStateMachine.settingsLoaded({});
    AppStateMachine.settingsReady();
    await this.initializeServices();
  }

  async initializeServices() {
    try {
      const gitSyncService = new GitSyncService();
      const workspaceSettingsService = new WorkspaceSettingsService();

      this._gitSyncService = gitSyncService;
      this._workspaceSettingsService = workspaceSettingsService;

      // Register services with proper dependency order
      serviceRegistry.register('networkService', networkService, []);
      serviceRegistry.register('gitSyncService', gitSyncService, []);
      serviceRegistry.register('workspaceSettingsService', workspaceSettingsService, []);
      serviceRegistry.register('webSocketService', webSocketService, []);

      await serviceRegistry.initializeAll();
      log.info('All services initialized successfully');

      // Create HttpRequestService for manual request execution
      const httpRequestService = new HttpRequestService(webSocketService.environmentHandler, totpCooldownTracker);
      httpRequestHandlers.configure(httpRequestService, totpCooldownTracker);

      // Configure WorkspaceStateService — the single owner of workspace state.
      workspaceStateService.configure({
        webSocketService,
      });

      serviceRegistry.registerInitialized('workspaceStateService', workspaceStateService);

      // Initialize: loads workspaces + active workspace data, starts auto-save,
      // broadcasts to WS. App is operational even without a renderer window.
      await workspaceStateService.initialize();
      webSocketService.markStateReady();
      log.info('WorkspaceStateService initialized — app is operational');

      AppStateMachine.servicesReady(serviceRegistry.getAllServices());

      // Start CLI API server (non-blocking — app works without it)
      try {
        const { CliApiService } = await import('../../../services/cli/CliApiService');
        const { CliSetupHandler } = await import('../../../services/cli/CliSetupHandler');
        const cliApiService = new CliApiService();
        const cliSetupHandler = new CliSetupHandler();
        cliApiService.setSetupHandler(cliSetupHandler);
        this._cliApiService = cliApiService;
        await cliApiService.start();

        serviceRegistry.registerInitialized('cliApiService', cliApiService);
      } catch (error: unknown) {
        log.warn('CLI API server failed to start (non-critical):', errorMessage(error));
      }
    } catch (error) {
      log.error('Failed to initialize services:', error);
      throw error;
    }
  }

  async beforeQuit() {
    if (this._cleanupDone) return;
    this._cleanupDone = true;
    this.isQuitting = true;
    AppStateMachine.shutdown();

    await Promise.race([
      this._performCleanup(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          log.warn('Shutdown cleanup timed out after 5s, proceeding with exit');
          resolve();
        }, 5000),
      ),
    ]);
  }

  async _performCleanup() {
    for (const watcher of this.fileWatchers.values()) {
      try {
        watcher.close();
      } catch (_e) {
        /* ignore */
      }
    }

    try {
      await serviceRegistry.shutdownAll();
      log.info('All services shut down successfully');
      AppStateMachine.terminate();
    } catch (error) {
      log.error('Error shutting down services:', error);
      AppStateMachine.error(error);
    }
  }

  getGitSyncService(): GitSyncService | null {
    return this._gitSyncService;
  }

  getWorkspaceSettingsService(): WorkspaceSettingsService | null {
    return this._workspaceSettingsService;
  }

  getCliApiService(): CliApiService | null {
    return this._cliApiService;
  }

  isCleanupDone() {
    return this._cleanupDone;
  }

  isQuittingApp() {
    return this.isQuitting;
  }

  setQuitting(value: boolean) {
    this.isQuitting = value;
  }

  getFileWatchers() {
    return this.fileWatchers;
  }
}

const appLifecycle = new AppLifecycle();

export { AppLifecycle };
export default appLifecycle;
