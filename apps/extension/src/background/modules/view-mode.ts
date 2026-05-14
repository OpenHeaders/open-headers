/**
 * Background-side view-mode wiring.
 *
 * `chrome.action.setPopup` and `chrome.sidePanel.setPanelBehavior` are
 * runtime calls that don't survive service-worker eviction in a fresh
 * profile — Chrome resets the action button to the manifest's
 * `default_popup` on cold start. So we re-apply the persisted mode on
 * every SW boot, and listen for storage changes from the UI to re-apply
 * mid-session when the user flips the toggle.
 */

import { logger } from '@utils/logger';
import { applyViewMode } from '@/host/view-mode-applier';
import { getViewMode, onViewModeChanged } from '@/host/view-mode-storage';

let initialized = false;

export async function initializeViewMode(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const mode = await getViewMode();
    await applyViewMode(mode);
    logger.info('ViewMode', `Applied stored view mode on startup: ${mode}`);
  } catch (error) {
    logger.info('ViewMode', 'initial apply failed:', (error as Error).message);
  }

  onViewModeChanged((next) => {
    void applyViewMode(next).catch((error: Error) => {
      logger.info('ViewMode', 'reapply on change failed:', error.message);
    });
  });
}
