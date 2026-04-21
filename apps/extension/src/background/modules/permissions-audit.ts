/**
 * Permissions audit — one-shot SW-startup check that `<all_urls>` is
 * still granted, with a Status pill fallback if the user has narrowed
 * host permissions via `chrome://extensions`.
 *
 * Covers ARCHITECTURE.md §12's silent-failure edge case: DNR workbench on
 * a revoked host silently no-op. Without this audit, a user whose
 * permissions were narrowed would never get a hint.
 *
 * Runs off `chrome.permissions.contains({ origins: ['<all_urls>'] })`.
 * Called from `initializeExtension()` after the first workspace
 * hydration; re-running later is cheap, but there's no observer API
 * for permission changes in MV3 Chromium so this is a poll-on-wake.
 */

import { logger } from '@utils/logger';
import { report as reportStatus } from '@/shared/status';
import { recordLog } from './observability-log';

export async function auditHostPermissions(): Promise<void> {
  try {
    const granted = await new Promise<boolean>((resolve) => {
      // chrome.permissions.contains accepts a callback OR returns a Promise;
      // the callback form works in every MV3 browser.
      chrome.permissions.contains({ origins: ['<all_urls>'] }, (has) => {
        resolve(Boolean(has));
      });
    });

    if (granted) {
      reportStatus({
        subsystem: 'permissions',
        state: 'green',
        message: 'All host permissions granted',
      });
      return;
    }

    // User has narrowed permissions. DNR + content scripts on
    // revoked hosts silently no-op — surface this so they don't debug
    // a rule for 30 minutes before realizing they denied the host.
    reportStatus({
      subsystem: 'permissions',
      state: 'red',
      message: 'Host permissions narrowed — some workbench will silently no-op on revoked hosts',
    });
    recordLog({
      subsystem: 'permissions',
      op: 'audit',
      level: 'warn',
      message: 'Host permissions check failed: <all_urls> not granted',
      context: {},
    });
    logger.warn('PermissionsAudit', '<all_urls> not granted at SW startup');
  } catch (err) {
    // `chrome.permissions` unavailable (shouldn't happen on MV3 browsers,
    // but handle anyway). Mark as yellow — unknown state, not "broken".
    const message = err instanceof Error ? err.message : String(err);
    reportStatus({
      subsystem: 'permissions',
      state: 'yellow',
      message: `Could not audit host permissions: ${message}`,
    });
  }
}
