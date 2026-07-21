/**
 * LiveStorageDocInspectTab — a watched browser tab's storage document
 * (cookie / DOM storage entry / IndexedDB record / cache entry) opened
 * as a main editor tab (mode `live-storage-doc-inspect`). Thin binding
 * of the shared storage editor components to the storage relay: the
 * mount provides the pair's LOCAL HANDLE as the inspected tab
 * (`InspectedTabContext`), so every re-fetch and write the document
 * makes routes to the owning peer — even while the Traffic Monitor's
 * rail selection sits elsewhere.
 *
 * "Reveal in Storage" posts a reveal intent the workbench shell answers
 * by activating the Traffic Monitor; the mounted panel consumes it.
 */

import type React from 'react';
import { useEffect, useMemo } from 'react';
import { CacheEntryEditorTab } from '../../../panel/components/storage/CacheEntryEditorTab';
import { CookieEditorTab } from '../../../panel/components/storage/CookieEditorTab';
import { DomStorageEntryEditorTab } from '../../../panel/components/storage/DomStorageEntryEditorTab';
import { IdbRecordEditorTab } from '../../../panel/components/storage/IdbRecordEditorTab';
import { InspectedTabContext } from '../../../panel/data/inspected-tab-context';
import {
  buildCacheEntryTab,
  buildCookieTab,
  buildDomStorageEntryTab,
  buildIdbRecordTab,
} from '../../../panel/data/inspector-tab';
import { installTrafficStorageHost, trafficStorageHandle } from '../../data/traffic-storage-host';
import { postTrafficStorageReveal } from '../../data/traffic-storage-reveal';
import type { LiveStorageDocRef } from '../../types';

export interface LiveStorageDocInspectTabProps {
  nodeId: string;
  tabId: number;
  doc: LiveStorageDocRef;
  onDirtyChange?: (dirty: boolean) => void;
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
}

// Seam install is module-load, idempotent — a storage-document tab can
// mount before the Traffic Monitor ever did (session restore).
installTrafficStorageHost();

const LiveStorageDocInspectTab: React.FC<LiveStorageDocInspectTabProps> = ({
  nodeId,
  tabId,
  doc,
  onDirtyChange,
  registerSave,
}) => {
  const handle = trafficStorageHandle(nodeId, tabId);
  // Frozen document identity — the shared components key their fetch
  // loops on it, and the tab id already pins one document per tab.
  const openedAt = useMemo(() => Date.now(), []);

  // A closed tab must not leave a stale save registered on the guard.
  useEffect(() => () => registerSave?.(null), [registerSave]);

  const body = (() => {
    switch (doc.kind) {
      case 'cookie':
        return (
          <CookieEditorTab
            tab={buildCookieTab({ cookieKey: doc.cookieKey, scopeUrl: doc.scopeUrl, timestamp: openedAt })}
            onRevealInStorage={() => postTrafficStorageReveal({ nodeId, tabId, reveal: { kind: 'cookies' } })}
            onDirtyChange={onDirtyChange}
            registerSave={registerSave}
            isActiveDocument
          />
        );
      case 'dom':
        return (
          <DomStorageEntryEditorTab
            tab={buildDomStorageEntryTab({
              frameId: doc.frameId,
              area: doc.area,
              entryKey: doc.entryKey,
              timestamp: openedAt,
            })}
            onRevealInStorage={(area) =>
              postTrafficStorageReveal({ nodeId, tabId, reveal: { kind: 'dom', area, row: doc.entryKey } })
            }
            onDirtyChange={onDirtyChange}
            registerSave={registerSave}
            isActiveDocument
          />
        );
      case 'idb':
        return (
          <IdbRecordEditorTab
            tab={buildIdbRecordTab({
              frameId: doc.frameId,
              database: doc.database,
              store: doc.store,
              primaryKeyWire: doc.primaryKeyWire,
              keyPreview: doc.keyPreview,
              timestamp: openedAt,
            })}
            onRevealInStorage={(database, store) =>
              postTrafficStorageReveal({
                nodeId,
                tabId,
                reveal: { kind: 'idb', database, store, row: doc.primaryKeyWire },
              })
            }
            onDirtyChange={onDirtyChange}
            registerSave={registerSave}
            isActiveDocument
          />
        );
      case 'cache':
        return (
          <CacheEntryEditorTab
            tab={buildCacheEntryTab({
              frameId: doc.frameId,
              cache: doc.cache,
              url: doc.url,
              method: doc.method,
              timestamp: openedAt,
            })}
            onRevealInStorage={(cache) =>
              postTrafficStorageReveal({
                nodeId,
                tabId,
                reveal: { kind: 'cache', cache, row: `${doc.method} ${doc.url}` },
              })
            }
          />
        );
    }
  })();

  return (
    <InspectedTabContext.Provider value={handle}>
      <div className="dt-capture-surface">{body}</div>
    </InspectedTabContext.Provider>
  );
};

export default LiveStorageDocInspectTab;
