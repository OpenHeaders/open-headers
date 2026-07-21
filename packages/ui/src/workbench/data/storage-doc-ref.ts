/**
 * Shared identity helpers for `live-storage-doc-inspect` tabs — the
 * document's panel-side inspector-tab id, reused by the opener (tab
 * dedup) and the Traffic Monitor's storage pane (active-row highlight),
 * so both always agree with the shared StoragePanel's own vocabulary.
 */

import { cacheEntryTabId, cookieTabId, domStorageEntryTabId, idbRecordTabId } from '../../panel/data/inspector-tab';
import type { LiveStorageDocRef } from '../types';

export function storageDocInnerId(doc: LiveStorageDocRef): string {
  switch (doc.kind) {
    case 'cookie':
      return cookieTabId(doc.cookieKey);
    case 'dom':
      return domStorageEntryTabId(doc.frameId, doc.area, doc.entryKey);
    case 'idb':
      return idbRecordTabId(doc.frameId, doc.database, doc.store, doc.primaryKeyWire);
    case 'cache':
      return cacheEntryTabId(doc.frameId, doc.cache, doc.url, doc.method);
  }
}
