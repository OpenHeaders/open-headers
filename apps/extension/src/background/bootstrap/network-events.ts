import { logger } from '@utils/logger';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { kickActiveContextRefresh, reconcileLiveSchedules } from '../modules/live-refresh-scheduler';
import { reconcileOAuthSchedules } from '../modules/oauth-refresh-scheduler';
import { getActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { backgroundReady } from './background-ready';

export function installNetworkEventHandlers(): void {
  self.addEventListener('online', () => {
    logger.info('Background', 'Network online — reconciling live + OAuth schedulers + catching up stale workflows');
    void backgroundReady.then(async () => {
      await Promise.all([
        reconcileLiveSchedules().catch((err: unknown) => {
          logger.warn('Background', 'Live reconcile after online event failed', err);
        }),
        reconcileOAuthSchedules().catch((err: unknown) => {
          logger.warn('Background', 'OAuth reconcile after online event failed', err);
        }),
      ]);
      await kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
        logger.warn('Background', 'Wake-up catch-up after online event failed', err);
      });
    });
  });

  self.addEventListener('offline', () => {
    logger.info('Background', 'Network offline — refreshes in flight will likely fail and enter backoff');
  });
}
