import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

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
export type InspectorTab = RequestInspectorTab | IdbRecordInspectorTab;

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
}

/** Per-tab view state callers patch in place (request tabs only today). */
export type InspectorTabPatch = Partial<Pick<RequestInspectorTab, 'activeSection'>>;

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

export function buildIdbRecordTab(input: BuildIdbRecordTabInput): IdbRecordInspectorTab {
  return {
    kind: 'idb-record',
    // Record identity IS the tab identity — re-opening the same record
    // activates the existing tab instead of spawning a duplicate.
    id: `idb:${input.frameId}:${input.database}:${input.store}:${input.primaryKeyWire}`,
    label: input.keyPreview,
    frameId: input.frameId,
    database: input.database,
    store: input.store,
    primaryKeyWire: input.primaryKeyWire,
    keyPreview: input.keyPreview,
    timestamp: input.timestamp,
  };
}

/** Full-detail hover title for a tab pill. */
export function tabTitle(tab: InspectorTab): string {
  return tab.kind === 'request' ? tab.url : `${tab.database} › ${tab.store} › ${tab.keyPreview}`;
}

/** The pill's short label (request labels drop their method prefix). */
export function tabPillLabel(tab: InspectorTab): string {
  return tab.kind === 'request' ? tab.label.replace(/^[A-Z]+ /, '') : tab.label;
}

/** Haystack the tab-search dropdown matches against. */
export function tabSearchText(tab: InspectorTab): string {
  return tab.kind === 'request' ? tab.url : `${tab.database} ${tab.store} ${tab.keyPreview}`;
}
