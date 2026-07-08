import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { DomStorageArea } from './storage/storage-inspector-host';

export type DetailSection =
  | 'headers'
  | 'payload'
  | 'preview'
  | 'response'
  | 'initiator'
  | 'timing'
  | 'cookies'
  | 'messages'
  | 'eventstream'
  | 'rawdata';

export type TabSource = 'network' | 'rules';

/**
 * The editor hosts more than network requests: a tab is a discriminated
 * union, one arm per document kind. Every arm carries what its body
 * needs to render (and re-fetch) independently of the tool window it
 * was opened from.
 */
export type InspectorTab = RequestInspectorTab | IdbRecordInspectorTab | DomStorageEntryInspectorTab;

export interface RequestInspectorTab {
  kind: 'request';
  id: string;
  label: string;
  method: string;
  statusCode?: number;
  url: string;
  activeSection: DetailSection;
  requestId: string;
  timestamp: number;
  source: TabSource;
  displayId: number;
}

/** One IndexedDB record opened as a full-editor document. */
export interface IdbRecordInspectorTab {
  kind: 'idb-record';
  id: string;
  label: string;
  frameId: number;
  database: string;
  store: string;
  /** The record's lossless key encoding — the fetch identity. */
  primaryKeyWire: string;
  keyPreview: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One localStorage / sessionStorage entry opened as a full-editor document. */
export interface DomStorageEntryInspectorTab {
  kind: 'dom-storage-entry';
  id: string;
  label: string;
  frameId: number;
  area: DomStorageArea;
  /** The entry's storage key — the fetch identity. A committed rename
   *  patches it (and the id) in place via `entryKey`. */
  entryKey: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** Per-tab view state callers patch in place. Each field applies to
 *  matching tab kinds only (`activeSection` → request, `dirty` →
 *  document kinds, `entryKey` → dom-storage-entry); the tree transform
 *  drops fields foreign to the tab's kind. */
export interface InspectorTabPatch {
  activeSection?: DetailSection;
  dirty?: boolean;
  /** Committed rename: rewrites the entry key AND the identity-derived
   *  id/label so re-opens and row highlights keep matching. */
  entryKey?: string;
}

/** Does this tab carry an unsaved editor draft? (Request tabs never do.) */
export function tabIsDirty(tab: InspectorTab): boolean {
  return tab.kind !== 'request' && tab.dirty === true;
}

export interface ClosedTab {
  tab: InspectorTab;
  closedAt: number;
}

export interface BuildInspectorTabInput {
  lifecycle: RequestLifecycle;
  displayId: number;
}

export function buildInspectorTab(input: BuildInspectorTabInput, source: TabSource = 'network'): RequestInspectorTab {
  const lc = input.lifecycle;
  let hostname: string;
  let path: string;
  try {
    const parsed = new URL(lc.url);
    hostname = parsed.hostname;
    // Don't show trailing "/" for root URLs — matches the native Network tab.
    path = parsed.pathname === '/' ? '' : parsed.pathname;
  } catch {
    hostname = '';
    path = lc.url;
  }

  const domainPart = hostname.length > 20 ? `…${hostname.slice(-17)}` : hostname;
  const pathPart = path.length > 24 ? `…${path.slice(-21)}` : path;
  const label = `#${input.displayId} ${domainPart}${pathPart}`;

  return {
    kind: 'request',
    id: lc.requestId,
    label,
    method: lc.method,
    ...(lc.statusCode != null ? { statusCode: lc.statusCode } : {}),
    url: lc.url,
    activeSection: 'headers',
    requestId: lc.requestId,
    timestamp: lc.startedAtMs,
    source,
    displayId: input.displayId,
  };
}

export interface BuildIdbRecordTabInput {
  frameId: number;
  database: string;
  store: string;
  primaryKeyWire: string;
  keyPreview: string;
  timestamp: number;
}

/** Record identity IS the tab identity — shared with the Storage window
 *  so an open record's row can light up in the store's record list. */
export function idbRecordTabId(frameId: number, database: string, store: string, primaryKeyWire: string): string {
  return `idb:${frameId}:${database}:${store}:${primaryKeyWire}`;
}

export function buildIdbRecordTab(input: BuildIdbRecordTabInput): IdbRecordInspectorTab {
  return {
    kind: 'idb-record',
    // Re-opening the same record activates the existing tab instead of
    // spawning a duplicate.
    id: idbRecordTabId(input.frameId, input.database, input.store, input.primaryKeyWire),
    label: input.keyPreview,
    frameId: input.frameId,
    database: input.database,
    store: input.store,
    primaryKeyWire: input.primaryKeyWire,
    keyPreview: input.keyPreview,
    timestamp: input.timestamp,
  };
}

export interface BuildDomStorageEntryTabInput {
  frameId: number;
  area: DomStorageArea;
  entryKey: string;
  timestamp: number;
}

/** Entry identity IS the tab identity — shared with the Storage window
 *  so an open entry's row can light up in the grid. */
export function domStorageEntryTabId(frameId: number, area: DomStorageArea, entryKey: string): string {
  return `dom:${frameId}:${area}:${entryKey}`;
}

export function buildDomStorageEntryTab(input: BuildDomStorageEntryTabInput): DomStorageEntryInspectorTab {
  return {
    kind: 'dom-storage-entry',
    // Re-opening the same entry activates the existing tab instead of
    // spawning a duplicate.
    id: domStorageEntryTabId(input.frameId, input.area, input.entryKey),
    label: input.entryKey,
    frameId: input.frameId,
    area: input.area,
    entryKey: input.entryKey,
    timestamp: input.timestamp,
  };
}

/** The DOM storage area's display name (`localStorage` / `sessionStorage`). */
export function domStorageAreaName(area: DomStorageArea): string {
  return area === 'session' ? 'sessionStorage' : 'localStorage';
}

/** Full-detail hover title for a tab pill. */
export function tabTitle(tab: InspectorTab): string {
  if (tab.kind === 'request') return tab.url;
  if (tab.kind === 'idb-record') return `${tab.database} › ${tab.store} › ${tab.keyPreview}`;
  return `${domStorageAreaName(tab.area)} › ${tab.entryKey}`;
}

/** The pill's short label (request labels drop their method prefix). */
export function tabPillLabel(tab: InspectorTab): string {
  return tab.kind === 'request' ? tab.label.replace(/^[A-Z]+ /, '') : tab.label;
}

/** Haystack the tab-search dropdown matches against. */
export function tabSearchText(tab: InspectorTab): string {
  if (tab.kind === 'request') return tab.url;
  if (tab.kind === 'idb-record') return `${tab.database} ${tab.store} ${tab.keyPreview}`;
  return `${domStorageAreaName(tab.area)} ${tab.entryKey}`;
}
