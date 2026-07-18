import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import type { HeaderDirection } from '@openheaders/core/utils';
import type { DetectedValue } from '@openheaders/ui/shared/value-detection';
import type { JarCookieKey } from './cookies/cookie-jar-cache';
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
export type InspectorTab =
  | RequestInspectorTab
  | IdbRecordInspectorTab
  | DomStorageEntryInspectorTab
  | CookieInspectorTab
  | CacheEntryInspectorTab
  | RuleValueInspectorTab
  | RuleEditorInspectorTab
  | ValueViewInspectorTab;

export interface RequestInspectorTab {
  kind: 'request';
  id: string;
  label: string;
  method: string;
  statusCode?: number;
  /** The lifecycle's resource type at open time — lets the pill carry
   *  the same type icon as the request's network row. Correlator vocab
   *  (`websocket` vs `ws`) — never compare raw without both spellings. */
  resourceType?: string;
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

/** One browser-jar cookie opened as a full-editor document. */
export interface CookieInspectorTab {
  kind: 'cookie';
  id: string;
  label: string;
  /** The cookie's jar identity — the fetch key. A committed identity
   *  change (name / domain / path) patches it (and the id) in place via
   *  `cookieKey`. */
  cookieKey: JarCookieKey;
  /** Site-jar lookup URL captured at open time — the re-fetch scope. */
  scopeUrl: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One Cache Storage entry's stored response opened as a read-only
 *  editor document. No draft, no dirty — Cache Storage has no write
 *  seam; delete is the only mutation. */
export interface CacheEntryInspectorTab {
  kind: 'cache-entry';
  id: string;
  label: string;
  frameId: number;
  /** The entry's fetch identity: cache name + request URL + method. */
  cache: string;
  url: string;
  method: string;
  timestamp: number;
}

/** One rule field's detected value (JWT, big JSON, …) opened as a
 *  full-editor document — the popover-bound compact editor's
 *  escalation. Keys on the rule uid + the modification's persisted uid
 *  (never a list index — rows reorder), reads the CANONICAL rule
 *  through the live sync mirror, and saves through the rule mutator.
 *  Header-rule values today; the arm is named for the general case. */
export interface RuleValueInspectorTab {
  kind: 'rule-value';
  id: string;
  label: string;
  ruleUid: string;
  direction: HeaderDirection;
  /** Persisted uid of the header modification the value belongs to —
   *  with the direction, the field's durable identity inside the rule. */
  modUid: string;
  /** Header name at open time — label/crumb seed (the live name may
   *  drift; the document body renders the live one). */
  headerName: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** Popover hand-off riding a rule-editor tab open: the quick editor's
 *  unsaved form state, pre-applied as the document's draft so escalating
 *  mid-edit loses nothing. The body is WIRE text — the popover encodes
 *  its formatted view through `encodeBodyForWire` before handing off. */
export interface RuleEditorHandOff {
  statusCode: number;
  contentType: string;
  responseBody: string;
  /** Present only when the popover's conditions row was dirty. */
  conditions?: RuleCondition[];
}

/** One response-override rule opened as a full editor-tab document —
 *  the quick popover's in-panel escalation (the workspace link's
 *  stay-in-DevTools sibling). Named for the general case; response
 *  rules today. */
export interface RuleEditorInspectorTab {
  kind: 'rule-editor';
  id: string;
  /** Rule name at open time — pill/crumb seed (the live name may
   *  drift; the document body renders the live one). */
  label: string;
  /** Edit mode: the rule's uid — the document reads the CANONICAL rule
   *  through the live sync mirror. Create mode: null until the first
   *  Save mints the rule and a `ruleUid` patch re-keys the tab. */
  ruleUid: string | null;
  /** Create mode: the captured draft the first Save mints from. Tabs
   *  are in-memory state (nothing survives a reload), so the draft
   *  travels with its tab. Dropped on re-key. */
  draft?: ResponseRuleDraft;
  /** Create mode: pre-filled rule name (editable in the document). */
  draftName?: string;
  /** Create mode: conditions carried from the popover's edited row —
   *  absent means the document derives them from the draft. */
  draftConditions?: RuleCondition[];
  /** Edit mode: popover hand-off (see `RuleEditorHandOff`). Dropped on
   *  the post-save re-key. */
  handOff?: RuleEditorHandOff;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One detected value opened as a read-only snapshot document — the
 *  eye glance's tab escalation. Pure SNAPSHOT at open: the source row
 *  may scroll away, refilter, or change; the document decodes from the
 *  captured hit and never live-binds the surface it came from. Tabs are
 *  in-memory state, so carrying the hit itself is safe (nothing
 *  survives a reload — same as rule-editor drafts). */
export interface ValueViewInspectorTab {
  kind: 'value-view';
  id: string;
  label: string;
  /** The registry hit captured when the glance escalated. */
  detected: DetectedValue;
  /** The opening surface's name for the value (header / cookie / param
   *  name) — absent for anonymous buffers. */
  sourceLabel?: string;
  timestamp: number;
}

/** Per-tab view state callers patch in place. Each field applies to
 *  matching tab kinds only (`activeSection` → request, `dirty` →
 *  document kinds, `entryKey` → dom-storage-entry, `cookieKey` →
 *  cookie, `ruleUid`/`label` → rule-editor); the tree transform drops
 *  fields foreign to the tab's kind. */
export interface InspectorTabPatch {
  activeSection?: DetailSection;
  dirty?: boolean;
  /** Committed rename: rewrites the entry key AND the identity-derived
   *  id/label so re-opens and row highlights keep matching. */
  entryKey?: string;
  /** Committed cookie identity change — same identity-move semantics
   *  as `entryKey`, over the jar key. */
  cookieKey?: JarCookieKey;
  /** Committed rule binding (rule-editor): first Save minted the rule —
   *  re-key a draft tab to the uid and drop the seed payloads. */
  ruleUid?: string;
  /** Rule-editor re-key only: the minted rule's final name. */
  label?: string;
}

/** Does this tab carry an unsaved editor draft? (Request tabs never do,
 *  and cache-entry / value-view documents are read-only.) */
export function tabIsDirty(tab: InspectorTab): boolean {
  return tab.kind !== 'request' && tab.kind !== 'cache-entry' && tab.kind !== 'value-view' && tab.dirty === true;
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
    ...(lc.resourceType ? { resourceType: lc.resourceType } : {}),
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

export interface BuildCookieTabInput {
  cookieKey: JarCookieKey;
  scopeUrl: string;
  timestamp: number;
}

/** Cookie identity IS the tab identity — shared with the Storage window
 *  so an open cookie's row can light up in the Cookies section. */
export function cookieTabId(key: JarCookieKey): string {
  return `cookie:${key.name}:${key.domain}:${key.path}:${key.partitionKey ?? ''}`;
}

export function buildCookieTab(input: BuildCookieTabInput): CookieInspectorTab {
  return {
    kind: 'cookie',
    // Re-opening the same cookie activates the existing tab instead of
    // spawning a duplicate.
    id: cookieTabId(input.cookieKey),
    label: input.cookieKey.name,
    cookieKey: input.cookieKey,
    scopeUrl: input.scopeUrl,
    timestamp: input.timestamp,
  };
}

export interface BuildCacheEntryTabInput {
  frameId: number;
  cache: string;
  url: string;
  method: string;
  timestamp: number;
}

/** Entry identity IS the tab identity — shared with the Storage window
 *  so an open entry's row can light up in the cache's entry grid. */
export function cacheEntryTabId(frameId: number, cache: string, url: string, method: string): string {
  return `cacheentry:${frameId}:${cache}:${method}:${url}`;
}

/** The pill label for a cache entry — the URL's last path segment,
 *  falling back to the hostname for root URLs. */
export function cacheEntryLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    const last = segments[segments.length - 1];
    return last !== undefined ? `${last}${parsed.search}` : parsed.hostname;
  } catch {
    return url;
  }
}

export function buildCacheEntryTab(input: BuildCacheEntryTabInput): CacheEntryInspectorTab {
  return {
    kind: 'cache-entry',
    // Re-opening the same entry activates the existing tab instead of
    // spawning a duplicate.
    id: cacheEntryTabId(input.frameId, input.cache, input.url, input.method),
    label: cacheEntryLabel(input.url),
    frameId: input.frameId,
    cache: input.cache,
    url: input.url,
    method: input.method,
    timestamp: input.timestamp,
  };
}

export interface BuildRuleValueTabInput {
  ruleUid: string;
  direction: HeaderDirection;
  modUid: string;
  headerName: string;
  timestamp: number;
}

/** Field identity IS the tab identity — re-opening the same rule field
 *  activates the existing tab instead of spawning a duplicate. */
export function ruleValueTabId(ruleUid: string, direction: HeaderDirection, modUid: string): string {
  return `rulevalue:${ruleUid}:${direction}:${modUid}`;
}

export function buildRuleValueTab(input: BuildRuleValueTabInput): RuleValueInspectorTab {
  return {
    kind: 'rule-value',
    id: ruleValueTabId(input.ruleUid, input.direction, input.modUid),
    label: input.headerName,
    ruleUid: input.ruleUid,
    direction: input.direction,
    modUid: input.modUid,
    headerName: input.headerName,
    timestamp: input.timestamp,
  };
}

/** Rule identity IS the tab identity — re-opening the same rule
 *  activates the existing tab instead of spawning a duplicate. */
export function ruleEditorTabId(ruleUid: string): string {
  return `ruleeditor:${ruleUid}`;
}

/** Create-mode identity: every capture escalation is its own document
 *  (there is no rule to dedupe against until Save mints one). */
export function ruleEditorDraftTabId(nonce: string): string {
  return `ruleeditor:draft:${nonce}`;
}

export interface BuildRuleEditorTabInput {
  ruleUid: string;
  ruleName: string;
  handOff?: RuleEditorHandOff;
  timestamp: number;
}

export function buildRuleEditorTab(input: BuildRuleEditorTabInput): RuleEditorInspectorTab {
  return {
    kind: 'rule-editor',
    id: ruleEditorTabId(input.ruleUid),
    label: input.ruleName,
    ruleUid: input.ruleUid,
    ...(input.handOff !== undefined ? { handOff: input.handOff } : {}),
    timestamp: input.timestamp,
  };
}

export interface BuildRuleEditorDraftTabInput {
  nonce: string;
  name: string;
  draft: ResponseRuleDraft;
  conditions?: RuleCondition[];
  timestamp: number;
}

export function buildRuleEditorDraftTab(input: BuildRuleEditorDraftTabInput): RuleEditorInspectorTab {
  return {
    kind: 'rule-editor',
    id: ruleEditorDraftTabId(input.nonce),
    label: input.name,
    ruleUid: null,
    draft: input.draft,
    draftName: input.name,
    ...(input.conditions !== undefined ? { draftConditions: input.conditions } : {}),
    timestamp: input.timestamp,
  };
}

/** Every glance escalation is its own snapshot document — there is no
 *  durable identity to dedupe against (same as rule-editor drafts). */
export function valueViewTabId(nonce: string): string {
  return `valueview:${nonce}`;
}

export interface BuildValueViewTabInput {
  nonce: string;
  detected: DetectedValue;
  /** Localized per-type title (e.g. "Base64 value") — the label
   *  fallback for anonymous buffers; resolved by the caller (this
   *  module has no translator). */
  typeTitle: string;
  sourceLabel?: string;
  timestamp: number;
}

export function buildValueViewTab(input: BuildValueViewTabInput): ValueViewInspectorTab {
  return {
    kind: 'value-view',
    id: valueViewTabId(input.nonce),
    label: input.sourceLabel ?? input.typeTitle,
    detected: input.detected,
    ...(input.sourceLabel !== undefined ? { sourceLabel: input.sourceLabel } : {}),
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
  if (tab.kind === 'cookie') return `${tab.cookieKey.domain}${tab.cookieKey.path} › ${tab.cookieKey.name}`;
  if (tab.kind === 'cache-entry') return `${tab.cache} › ${tab.url}`;
  if (tab.kind === 'rule-value') return `${tab.headerName} › ${tab.direction} header value`;
  if (tab.kind === 'rule-editor') return `${tab.label} › response override rule`;
  if (tab.kind === 'value-view') return `${tab.label} › value snapshot`;
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
  if (tab.kind === 'cookie') return `${tab.cookieKey.name} ${tab.cookieKey.domain} ${tab.cookieKey.path}`;
  if (tab.kind === 'cache-entry') return `${tab.cache} ${tab.url} ${tab.method}`;
  if (tab.kind === 'rule-value') return `${tab.headerName} ${tab.direction} header value`;
  if (tab.kind === 'rule-editor') return `${tab.label} response override rule`;
  if (tab.kind === 'value-view') return `${tab.label} ${tab.detected.type} value snapshot`;
  return `${domStorageAreaName(tab.area)} ${tab.entryKey}`;
}
