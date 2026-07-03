import { storage } from '@utils/browser-api';
import { applyExternalSnapshot as applyRequestScriptsReviewSnapshot } from '@openheaders/oracle/entity/request-scripts-review-store';
import { getActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { debouncedUpdateBadge } from './badge-update';

interface InstallStorageListenersOpts {
  isExtensionInitialized: () => boolean;
}

export function installStorageListeners({ isExtensionInitialized }: InstallStorageListenersOpts): void {
  storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !isExtensionInitialized()) return;
    const activeKey = `oh.ws.${getActiveWorkspaceId()}.pauseMarkers`;
    if (changes[activeKey]) {
      debouncedUpdateBadge();
    }
    const scriptsReviewKey = `oh.ws.${getActiveWorkspaceId()}.requestScriptsReviewPending`;
    if (changes[scriptsReviewKey]) {
      const next = changes[scriptsReviewKey].newValue;
      const uids = Array.isArray(next) ? next.filter((v): v is string => typeof v === 'string') : [];
      applyRequestScriptsReviewSnapshot(uids);
    }
  });
}
