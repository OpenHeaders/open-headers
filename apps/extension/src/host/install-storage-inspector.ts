/**
 * Boot-time wiring: route the DevTools panel's storage inspector through
 * the SW-side handlers (`background/modules/storage-inspector/`).
 *
 * The panel page can't enumerate frames (`chrome.webNavigation`) or
 * inject readers (`chrome.scripting`) — both are background-only APIs —
 * so every method is an RPC to the SW.
 *
 * Imported once from `apps/extension/src/panel/index.tsx` at panel boot.
 */

import type { DomStorageArea, DomStorageSnapshot, StorageScope } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';

logger.info('StorageInspectorHost', 'installed');

setStorageInspectorHost({
  async listScopes(tabId: number): Promise<readonly StorageScope[] | null> {
    try {
      const res = await call('listStorageScopes', { tabId });
      return res?.scopes ?? null;
    } catch (err) {
      logger.info('StorageInspectorHost', `listScopes ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async readDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<DomStorageSnapshot | null> {
    try {
      const res = await call('getDomStorageEntries', { tabId, frameId, area });
      if (!res?.entries) return null;
      return { entries: res.entries, truncated: res.truncated ?? false };
    } catch (err) {
      logger.info('StorageInspectorHost', `readDomStorage ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
});
