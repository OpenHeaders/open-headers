/**
 * Inspector Store — the panel's reactive model of the inspected tab's
 * request activity.
 *
 * ## Design goal
 *
 * The traffic list must be 1:1 with Chrome's native Network tab. No
 * phantom rows from background observations, no "half-joined" states,
 * no duplicate entries for the same underlying request. The only
 * source of truth for the list is HAR entries forwarded from the
 * devtools_page. Everything else is augmentation.
 *
 * ## Augmentation
 *
 *   - Rule fires (from the background's subscribeFires + onRuleMatchedDebug
 *     paths) are correlated to HAR entries by the host-attached
 *     `requestId`, which the background attaches to every HAR row by popping the
 *     oldest in-flight observation for that URL. This is the deterministic
 *     primary join: a fire's `requestId` always finds the right HAR row,
 *     regardless of how many concurrent requests target the same URL.
 *
 *   - URL + a recency window is retained as a fallback for HAR entries
 *     that arrived without a `chromeRequestId` — typically very early
 *     requests on a cold tab, or non-webRequest fetches the background
 *     never saw.
 *
 *   - Fires that don't match any HAR entry within the window land in
 *     `danglingFires`. The Rule Activity view surfaces these so the
 *     user sees rule behavior even when the underlying request didn't
 *     produce a HAR entry (blocked / cached / service worker / fired
 *     before the panel was open).
 *
 *   - When a new HAR entry arrives, the store sweeps recent
 *     `danglingFires` for matches (requestId first, URL+window second)
 *     and promotes them to attached fires on the new entry. This handles
 *     the common ordering where the fire arrives before the HAR entry.
 *
 *   - Fires are deduped per entry by `(ruleUid, requestId)` so the
 *     authoritative `onRuleMatchedDebug` path and the inferred
 *     URL-matching path do not both render as separate badges.
 *
 * ## Clear-on-navigation
 *
 * Matches Chrome's Network tab default: by default, entries are
 * cleared when the inspected window navigates. A "Preserve log"
 * toggle (surfaced in the panel toolbar) disables the clear.
 */

import type {
  InspectorHarBody,
  InspectorHarEntry,
  InspectorNavTiming,
  InspectorRequestCompleted,
  InspectorRequestError,
  InspectorRequestRedirect,
  InspectorRequestStarted,
  RequestRecord,
} from '@openheaders/core/types';
import { lookupErrorCode } from './chromium-error-codes';
import { resolveInitiatorRootUrl } from './initiator-graph';
import { type InspectorPage, PageTracker } from './pages';
import { type DanglingFire, type InspectorFire, type InspectorRequest, mergeFireEvidence } from './types';

/** Window for promoting a URL+window dangling fire to a newly-arrived HAR entry. */
const FIRE_TO_HAR_WINDOW_MS = 5_000;

/** Window for attaching a URL+window arriving fire to a recent HAR entry. */
const HAR_TO_FIRE_WINDOW_MS = 5_000;

/**
 * Window within which two `onErrorOccurred` events for the same
 * `(method, url)` are treated as retries of one logical user-visible
 * request rather than two distinct rows.
 *
 * Chrome's net stack can fire the event multiple times on different
 * `requestId`s for a single logical request — e.g. an initial attempt
 * trips `ERR_FAILED`, the stack retries, the retry then trips
 * `ERR_BLOCKED_BY_CLIENT`. Chrome's own Network tab consolidates these
 * to one row; we mirror that by replacing the existing error row in
 * place (preserving `displayId` / `arrivalIndex`) with the latest
 * attempt's data, so the user sees the most authoritative error code
 * for that URL.
 *
 * The window is generous (5 s) because retry backoff can push the
 * second attempt that far out; outside the window, two errors on the
 * same URL are genuinely separate user-visible requests.
 */
const ERROR_DEDUP_WINDOW_MS = 5_000;

/** Maximum dangling fires retained — bounded so a rule loop can't OOM the panel. */
const MAX_DANGLING_FIRES = 5_000;

function harStartTime(entry: InspectorHarEntry): number {
  const t = Date.parse(entry.startedDateTime);
  return Number.isFinite(t) ? t : Date.now();
}

function harKey(method: string, url: string, startedDateTime: string): string {
  return `${method}|${url}|${startedDateTime}`;
}

/** Mint a unique entry id from a `harKey`. The first entry for a given
 *  key uses the bare key; subsequent entries (true concurrent fetches
 *  starting in the same ms) get disambiguated by requestId or the
 *  store's arrival counter so React `key` collisions don't occur. */
function mintEntryId(key: string, existingCount: number, chromeRequestId: string | undefined, arrivalIndex: number): string {
  if (existingCount === 0) return key;
  if (chromeRequestId) return `${key}|${chromeRequestId}`;
  return `${key}#${arrivalIndex}`;
}

/** Identity key for error-row dedup — drops `startedDateTime` so
 *  multiple webRequest retries (each with their own timestamp) collapse
 *  onto one row. See `ERROR_DEDUP_WINDOW_MS`. */
function errorUrlKey(method: string, url: string): string {
  return `${method}|${url}`;
}

/** Build the minimal `InspectorHarEntry` shell for an error row. No
 *  `response` — the request never produced one. Carries enough request
 *  detail that components reading `harEntry.request.{method,url}` don't
 *  need to branch on `error`. */
function synthesizeErrorHarEntry(err: InspectorRequestError, startedDateTime: string): InspectorHarEntry {
  return {
    startedDateTime,
    time: 0,
    request: {
      method: err.method,
      url: err.url,
      httpVersion: '',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    _resourceType: err.resourceType,
    ...(err.initiator ? { _initiator: { type: 'other', url: err.initiator } } : {}),
  };
}

/** Build the minimal `InspectorHarEntry` shell for a pending row.
 *  Shape mirrors the error shell: no response, no timings — the
 *  request just started, nothing else is known yet. */
function synthesizePendingHarEntry(event: InspectorRequestStarted, startedDateTime: string): InspectorHarEntry {
  return {
    startedDateTime,
    time: 0,
    request: {
      method: event.method,
      url: event.url,
      httpVersion: '',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    _resourceType: event.resourceType,
    ...(event.initiator ? { _initiator: { type: 'other', url: event.initiator } } : {}),
  };
}

/** Canonical reason phrase for the 3xx statuses we synthesize from
 *  `chrome.webRequest.onBeforeRedirect`. Matches what Chrome's HAR
 *  exporter writes for the same status, so the row visually agrees
 *  with neighbours when a HAR row does land. */
const STATUS_TEXT_3XX: Record<number, string> = {
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
};

function fireDedupKey(ruleUid: string, requestId: string | undefined, t: number): string {
  // Fires without a requestId (scriptable-only) are deduped by `(ruleUid, t)`
  // so the same in-page report doesn't double-attach. Two different scriptable
  // fires from the same rule will differ on `t` because tab-telemetry stamps
  // each one with its own arrival timestamp.
  return requestId ? `${ruleUid}:${requestId}` : `${ruleUid}:t:${t}`;
}

export interface InspectorSnapshot {
  entries: readonly InspectorRequest[];
  danglingFires: readonly DanglingFire[];
  navTiming: InspectorNavTiming | null;
  /**
   * Parent-URL → child-entry-ids map. Built incrementally in
   * `ingestHarEntry` by inverting each entry's `_initiator` attribution
   * (see `resolveInitiatorRootUrl`). Used by the Initiator detail view
   * to render Chrome-style downstream initiator trees without scanning
   * the full entries list on each render. Reference identity changes
   * whenever the map's contents change, so useMemo/useSyncExternalStore
   * consumers correctly invalidate.
   */
  initiatorChildren: ReadonlyMap<string, readonly string[]>;
  /**
   * Tracked navigations, in arrival order. Each `InspectorPage` mirrors
   * the HAR 1.2 `log.pages[i]` shape and is referenced from
   * `InspectorRequest.pageref`. Used by the HAR exporter to emit a
   * proper page-grouped HAR (matching Chrome's wire format).
   */
  pages: readonly InspectorPage[];
  version: number;
}

export class InspectorStore {
  private entries: InspectorRequest[] = [];
  private danglingFires: DanglingFire[] = [];
  /**
   * Index by `harKey` (= `method|url|startedDateTime`). Stores a list
   * of entry indices per key rather than a single index because two
   * genuinely-different concurrent fetches can share the same
   * millisecond-precision `startedDateTime` — Chrome's own HAR exports
   * occasionally contain such pairs (see e.g. parallel polling on
   * `price-api.crypto.com/meta/v2/all-tokens`). `chromeRequestId` is
   * the unique-per-request join key; we only treat a new HAR as a
   * replay-dup when the existing entry shares that id too.
   *
   * Order within a list is arrival order — `ingestHarBody` picks the
   * oldest entry without a body (FIFO) when multiple entries share a
   * key. har-body messages identify their entry only by
   * `(method, url, startedDateTime)`, so the body→entry attachment in
   * the rare collision case isn't disambiguated by the bridge; FIFO
   * is the best we can do without changing the devtools_page protocol.
   */
  private byHarKey: Map<string, number[]> = new Map();
  /**
   * Reverse index for the requestId → entry-index join.
   *
   * Multiple HAR entries can share the same `chromeRequestId` in a
   * redirect chain — Chrome reuses the requestId across hops while
   * emitting a separate `onRequestFinished` per hop. The list is in
   * arrival order; the primary fire-join walks it and prefers the
   * entry whose URL also matches, so a fire for `https://a/` doesn't
   * mis-attach to the `https://b/` redirect target hop.
   */
  private byRequestId: Map<string, number[]> = new Map();
  /**
   * Secondary index for error-row dedup: `${method}|${url}` → idx of
   * the most-recent error row for that URL. Lets `ingestRequestError`
   * detect Chrome's retry-on-new-requestId pattern without a linear
   * scan, and replace in place so the user sees one row per logical
   * request. Pruned when the row's window expires or when the row is
   * superseded by a real HAR entry. See `ERROR_DEDUP_WINDOW_MS`.
   */
  private errorRowByUrl: Map<string, number> = new Map();
  /**
   * Inverted initiator index: parent URL → entry ids whose `_initiator`
   * attributes them to that URL. Clone-on-write per parent so snapshot
   * consumers that captured a previous array don't observe mutation.
   */
  private initiatorChildren: Map<string, readonly string[]> = new Map();
  /** Per-entry fire dedup, keyed by entry id → set of fire dedup keys. */
  private firesByEntry: Map<string, Set<string>> = new Map();
  /** Dedup for dangling fires so port-buffer replays don't duplicate them. */
  private danglingFireKeys: Set<string> = new Set();
  private version = 0;
  private listeners: Set<() => void> = new Set();
  private arrivalCounter = 0;
  private displayCounter = 1;
  /** Cached snapshot — rebuilt only on bump() so useSyncExternalStore is stable. */
  private navTiming: InspectorNavTiming | null = null;
  private pageTracker = new PageTracker();
  private snapshot: InspectorSnapshot = {
    entries: [],
    danglingFires: [],
    navTiming: null,
    initiatorChildren: new Map(),
    pages: [],
    version: 0,
  };
  /**
   * Preserve-log toggle. Defaults to `true` for power-user workflows
   * where losing history on every refresh is the opposite of helpful.
   * User can flip it off in the toolbar to match Chrome's Network tab
   * default behavior.
   */
  private preserveLog = true;
  private recording = true;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): InspectorSnapshot => this.snapshot;

  setPreserveLog = (value: boolean): void => {
    this.preserveLog = value;
    // Toggling is a user action — bump so UI re-renders toolbar state.
    this.bump();
  };

  getPreserveLog = (): boolean => this.preserveLog;

  setRecording = (value: boolean): void => {
    this.recording = value;
    this.bump();
  };

  getRecording = (): boolean => this.recording;

  clear = (): void => {
    this.clearInternal();
    this.bump();
  };

  /** Inner clear without bump — composed by `clear` and `onNavigated`
   *  (which needs to clear + start a new page + bump exactly once). */
  private clearInternal(): void {
    this.entries = [];
    this.danglingFires = [];
    this.byHarKey.clear();
    this.byRequestId.clear();
    this.errorRowByUrl.clear();
    this.initiatorChildren.clear();
    this.firesByEntry.clear();
    this.danglingFireKeys.clear();
    this.displayCounter = 1;
    this.pageTracker.reset();
  }

  /** Called when the inspected window navigates. Respects preserve-log. */
  onNavigated = (url?: string): void => {
    // Nav timing is scoped to the *current* page; reset regardless of
    // preserve-log so the status bar doesn't keep showing DCL/Load
    // numbers from a previous navigation.
    this.navTiming = null;
    if (!this.preserveLog) {
      this.clearInternal();
    } else {
      // Pending rows that didn't resolve before the navigation killed
      // them flip to a terminal "(unknown)" state — Chrome's UX for
      // requests it acknowledged starting but never saw finish. Only
      // runs when log is preserved; otherwise `clearInternal` drops
      // them outright.
      this.promotePendingToUnknown();
    }
    this.pageTracker.startPage(new Date().toISOString(), url ?? null);
    this.bump();
  };

  setNavTiming = (timing: InspectorNavTiming): void => {
    this.navTiming = timing;
    this.pageTracker.attachNavTiming(timing);
    this.bump();
  };

  getNavTiming = (): InspectorNavTiming | null => this.navTiming;

  ingestHarEntry(har: InspectorHarEntry, chromeRequestId?: string): void {
    if (!this.recording) return;

    const method = har.request?.method ?? '';
    const url = har.request?.url ?? '';
    const ts = harStartTime(har);
    const key = harKey(method, url, har.startedDateTime);

    // De-dupe: Chrome forwards a HAR entry exactly once per request,
    // but the port's flush-on-connect can replay a HAR that already
    // landed via a live broadcast. A true replay is one where the
    // existing entry shares the same `chromeRequestId` (or both lack
    // one). Entries that share only `(method, url, startedDateTime)`
    // — two genuine concurrent fetches starting in the same ms — are
    // NOT duplicates; they must each get their own row.
    const existingForKey = this.byHarKey.get(key);
    if (existingForKey) {
      for (const existingIdx of existingForKey) {
        const existing = this.entries[existingIdx];
        if (!existing) continue;
        if (chromeRequestId && existing.chromeRequestId === chromeRequestId) return;
        if (!chromeRequestId && !existing.chromeRequestId) return;
      }
    }

    // HAR-supersedes-pending / HAR-supersedes-error: if a placeholder
    // row (pending from `onBeforeRequest`, or error from
    // `onErrorOccurred`) was previously created for this requestId,
    // the real HAR entry is the authoritative resolution. Replace the
    // placeholder in place so its `displayId` and `arrivalIndex` are
    // preserved (no visual jump).
    if (chromeRequestId) {
      const existingList = this.byRequestId.get(chromeRequestId);
      if (existingList) {
        for (const existingIdx of existingList) {
          const existing = this.entries[existingIdx];
          if (!existing) continue;
          if (existing.error || existing.pending) {
            this.supersedeWithHar(existingIdx, har, chromeRequestId);
            return;
          }
          // Redirect-source row previously stamped by
          // `ingestRequestRedirect`. The HAR is for this same hop —
          // identifiable by matching URL on the same requestId.
          // `supersedeWithHar` preserves the captured 3xx status via
          // its `wasRedirect` guard, so the row gets HAR augmentation
          // (real headers, timing) without losing the authoritative
          // status. Without this branch, the HAR would be appended as
          // a duplicate row.
          if (
            existing.url === url &&
            typeof existing.statusCode === 'number' &&
            existing.statusCode >= 300 &&
            existing.statusCode < 400 &&
            !!existing.harEntry.response?.redirectURL
          ) {
            this.supersedeWithHar(existingIdx, har, chromeRequestId);
            return;
          }
        }
      }
    }

    const pageref = this.pageTracker.ensurePage(har.startedDateTime);
    // The document fetch is the closest proxy for "actual nav start":
    // its `startedDateTime` is set by Chrome at request-start, which
    // beats our nav-message arrival timestamp by ~100ms. Pin the
    // page's start to it so exports line up with Chrome's HAR.
    if (har._resourceType === 'document') {
      this.pageTracker.adoptEarliestStart(har.startedDateTime);
    }
    const arrivalIndex = this.arrivalCounter++;
    const entryId = mintEntryId(key, existingForKey?.length ?? 0, chromeRequestId, arrivalIndex);
    // Chromium tags failed requests with `response._error` (net-stack code)
    // and `response.status: 0`. Lift that onto `entry.error` so the
    // classifier + UI see the same shape as the `ingestRequestError` path,
    // instead of an opaque status-0 row with no reason.
    const harError = har.response?._error;
    const harErrorInfo = harError && har.response?.status === 0 ? lookupErrorCode(harError) : null;
    const entry: InspectorRequest = {
      id: entryId,
      harEntry: har,
      chromeRequestId,
      method,
      url,
      timestamp: ts,
      statusCode: har.response?.status,
      statusText: har.response?.statusText,
      mimeType: har.response?.content?.mimeType,
      responseSize: har.response?.content?.size,
      duration: har.time,
      resourceType: har._resourceType,
      fires: [],
      arrivalIndex,
      displayId: this.displayCounter++,
      pageref,
      ...(harError && harErrorInfo ? { error: { code: harError, reason: harErrorInfo.reason } } : {}),
    };

    // Sweep dangling fires that should attach to this new entry.
    // Match precedence per dangling fire:
    //   1. If both sides have a requestId AND URLs match, attach. The
    //      URL clause disambiguates redirect chains where multiple HAR
    //      rows share one requestId — a fire on the source URL must
    //      not attach to the redirect-target row.
    //   2. Otherwise (either side lacks a requestId, or requestIds
    //      match but URLs differ — rare canonicalization edge), attach
    //      on URL + the ±FIRE_TO_HAR_WINDOW_MS recency window. Covers
    //      scriptable fires with no requestId and HAR rows the
    //      background never observed.
    //   3. If both sides have requestIds AND they differ, no match —
    //      definitely a different request, never URL-fall-through.
    const promoted: InspectorFire[] = [];
    const kept: DanglingFire[] = [];
    const seenForThisEntry = new Set<string>();
    for (const f of this.danglingFires) {
      const bothHaveId = chromeRequestId != null && f.requestId != null;
      const matchById = bothHaveId && f.requestId === chromeRequestId && f.url === url;
      const idMismatch = bothHaveId && f.requestId !== chromeRequestId;
      const matchByUrlWindow =
        !idMismatch && !matchById && f.url === url && Math.abs(f.t - ts) <= FIRE_TO_HAR_WINDOW_MS;
      if (!matchById && !matchByUrlWindow) {
        kept.push(f);
        continue;
      }
      const dedup = fireDedupKey(f.ruleUid, f.requestId, f.t);
      if (seenForThisEntry.has(dedup)) {
        // Already promoted a duplicate fire onto this entry — drop the
        // dangling copy. `danglingFireKeys` is also pruned below so we
        // accept fresh fires for this same key in the future.
        this.danglingFireKeys.delete(dedup);
        continue;
      }
      seenForThisEntry.add(dedup);
      this.danglingFireKeys.delete(dedup);
      promoted.push({
        ruleUid: f.ruleUid,
        t: f.t,
        pattern: f.pattern,
        authoritative: f.authoritative,
        requestId: f.requestId,
        shadowedBy: f.shadowedBy,
        evidence: f.evidence,
        ...(f.ruleSnapshot ? { ruleSnapshot: f.ruleSnapshot } : {}),
      });
    }
    this.danglingFires = kept;
    entry.fires = promoted;
    this.firesByEntry.set(entryId, seenForThisEntry);

    const idx = this.entries.push(entry) - 1;
    if (existingForKey) existingForKey.push(idx);
    else this.byHarKey.set(key, [idx]);
    if (chromeRequestId) {
      const list = this.byRequestId.get(chromeRequestId);
      if (list) list.push(idx);
      else this.byRequestId.set(chromeRequestId, [idx]);
    }

    // Invert the entry's `_initiator` attribution into the parent → children
    // index. Self-loops are silently dropped (a request shouldn't be its
    // own initiator, but malformed HARs occasionally claim it).
    const parentUrl = resolveInitiatorRootUrl(har);
    if (parentUrl && parentUrl !== url) {
      const prev = this.initiatorChildren.get(parentUrl);
      this.initiatorChildren.set(parentUrl, prev ? [...prev, entryId] : [entryId]);
    }

    this.bump();
  }

  /**
   * Ingest a blocked / canceled / failed request reported by
   * `chrome.webRequest.onErrorOccurred`. Synthesizes a minimal
   * `InspectorHarEntry` shell (no `response`, `statusCode: 0`,
   * `statusText: <error code>`) so the existing request-state
   * classifier naturally bins the row as `blocked`/`failed`, and
   * stamps `entry.error` so the detail pane + HAR exporter can
   * branch on it.
   *
   * Dedup precedence:
   *   1. If a real HAR row already exists for this `requestId`, drop —
   *      the HAR pipeline already accounted for the request.
   *   2. If an error row already exists for the same `(method, url)`
   *      within `ERROR_DEDUP_WINDOW_MS`, treat the incoming event as a
   *      retry of the same logical request and replace in place
   *      (keeping `displayId` / `arrivalIndex` stable). This is the
   *      common case where Chrome's net stack retries a blocked
   *      request internally and fires the event on a new `requestId`.
   *   3. Otherwise append a new row.
   */
  ingestRequestError(err: InspectorRequestError): void {
    if (!this.recording) return;

    // 1a. HAR already present for this requestId → HAR wins, drop.
    // 1b. Pending row present, OR a row promoted to `(unknown)` on the
    //     last nav (`oh:abandoned`) → upgrade in place with the real
    //     error code. The nav-promotion runs synchronously on the `nav`
    //     event, but webRequest's `onErrorOccurred` for the
    //     subresources Chrome canceled often arrives a beat later; we
    //     keep the row at its original arrival position rather than
    //     letting the lagging error event append a duplicate after the
    //     new page's rows.
    if (err.requestId) {
      const existing = this.byRequestId.get(err.requestId);
      if (existing) {
        for (const idx of existing) {
          const e = this.entries[idx];
          if (!e) continue;
          if (e.pending || e.error?.code === 'oh:abandoned') {
            this.supersedePendingWithError(idx, err);
            return;
          }
          if (!e.error) return;
        }
      }
    }

    const info = lookupErrorCode(err.error);
    const ts = Date.parse(err.timestamp);
    const safeTs = Number.isFinite(ts) ? ts : Date.now();
    const startedDateTime = Number.isFinite(ts) ? err.timestamp : new Date(safeTs).toISOString();
    const urlKey = errorUrlKey(err.method, err.url);

    // 2. Retry consolidation. Chrome's UI does this too — without it
    //    our count overshoots Chrome's by the number of internally-
    //    retried failures (gtm.js → ERR_FAILED then ERR_BLOCKED_BY_CLIENT
    //    is the canonical example).
    const recentIdx = this.errorRowByUrl.get(urlKey);
    if (recentIdx != null) {
      const recent = this.entries[recentIdx];
      if (recent?.error && Math.abs(safeTs - recent.timestamp) <= ERROR_DEDUP_WINDOW_MS) {
        this.replaceErrorRow(recentIdx, err, info, safeTs, startedDateTime);
        return;
      }
      // Stale — outside the window. Drop the index entry so the next
      // error for this URL is treated as a fresh row.
      this.errorRowByUrl.delete(urlKey);
    }

    // 3. New row.
    const key = harKey(err.method, err.url, startedDateTime);
    const existingForKey = this.byHarKey.get(key);
    const pageref = this.pageTracker.ensurePage(startedDateTime);
    const arrivalIndex = this.arrivalCounter++;
    const entryId = mintEntryId(key, existingForKey?.length ?? 0, err.requestId || undefined, arrivalIndex);
    const entry: InspectorRequest = {
      id: entryId,
      harEntry: synthesizeErrorHarEntry(err, startedDateTime),
      chromeRequestId: err.requestId || undefined,
      method: err.method,
      url: err.url,
      timestamp: safeTs,
      statusCode: 0,
      statusText: err.error,
      resourceType: err.resourceType,
      fires: [],
      arrivalIndex,
      displayId: this.displayCounter++,
      pageref,
      error: { code: err.error, reason: info.reason },
    };

    const idx = this.entries.push(entry) - 1;
    if (existingForKey) existingForKey.push(idx);
    else this.byHarKey.set(key, [idx]);
    this.errorRowByUrl.set(urlKey, idx);
    if (err.requestId) {
      const list = this.byRequestId.get(err.requestId);
      if (list) list.push(idx);
      else this.byRequestId.set(err.requestId, [idx]);
    }
    this.bump();
  }

  /** Remove `idx` from `byHarKey[key]`'s list; drop the key entirely
   *  when the list goes empty. */
  private removeFromHarKey(key: string, idx: number): void {
    const list = this.byHarKey.get(key);
    if (!list) return;
    const pos = list.indexOf(idx);
    if (pos >= 0) list.splice(pos, 1);
    if (list.length === 0) this.byHarKey.delete(key);
  }

  /** Append `idx` to `byHarKey[key]`'s list, creating the list when
   *  absent. Order within the list is arrival order. */
  private addToHarKey(key: string, idx: number): void {
    const list = this.byHarKey.get(key);
    if (list) list.push(idx);
    else this.byHarKey.set(key, [idx]);
  }

  /**
   * Replace an existing error row in place with a fresh error event
   * for the same logical request. Preserves `arrivalIndex`, `displayId`,
   * and `pageref` so the UI doesn't reflow. Re-keys `byHarKey` (since
   * `startedDateTime` is part of the id) and updates `byRequestId` if
   * the retry surfaced on a new `requestId`.
   */
  private replaceErrorRow(
    idx: number,
    err: InspectorRequestError,
    info: ReturnType<typeof lookupErrorCode>,
    safeTs: number,
    startedDateTime: string,
  ): void {
    const existing = this.entries[idx];
    const oldHarKey = harKey(existing.method, existing.url, existing.harEntry.startedDateTime);
    const newHarKey = harKey(err.method, err.url, startedDateTime);

    // Re-key `byHarKey` only when the bare key actually changed.
    if (newHarKey !== oldHarKey) {
      this.removeFromHarKey(oldHarKey, idx);
      this.addToHarKey(newHarKey, idx);
    }

    // Entry id may also need to change — if we just took the spot of
    // the first entry under the new key, the bare key is fine; otherwise
    // a disambiguating suffix is added.
    const newList = this.byHarKey.get(newHarKey);
    const positionInNewList = newList ? newList.indexOf(idx) : 0;
    const newId = mintEntryId(newHarKey, positionInNewList, err.requestId || undefined, existing.arrivalIndex);
    if (newId !== existing.id) {
      // `firesByEntry` is keyed by entry id — migrate the dedup set so
      // a fire that already attached to this row stays deduped.
      const fires = this.firesByEntry.get(existing.id);
      if (fires) {
        this.firesByEntry.delete(existing.id);
        this.firesByEntry.set(newId, fires);
      }
    }

    if (err.requestId !== existing.chromeRequestId) {
      if (existing.chromeRequestId) {
        const oldList = this.byRequestId.get(existing.chromeRequestId);
        if (oldList) {
          const pos = oldList.indexOf(idx);
          if (pos >= 0) oldList.splice(pos, 1);
          if (oldList.length === 0) this.byRequestId.delete(existing.chromeRequestId);
        }
      }
      if (err.requestId) {
        const list = this.byRequestId.get(err.requestId);
        if (list) list.push(idx);
        else this.byRequestId.set(err.requestId, [idx]);
      }
    }

    this.entries[idx] = {
      ...existing,
      id: newId,
      harEntry: synthesizeErrorHarEntry(err, startedDateTime),
      chromeRequestId: err.requestId || undefined,
      timestamp: safeTs,
      statusText: err.error,
      resourceType: err.resourceType,
      error: { code: err.error, reason: info.reason },
    };
    this.bump();
  }

  /**
   * Promote a pending row in place to an error row. Used when
   * `onErrorOccurred` arrives for a request whose start we already
   * observed via `onBeforeRequest`. Preserves `arrivalIndex`,
   * `displayId`, `pageref`; clears the `pending` marker; populates
   * `error` + status fields the same way `ingestRequestError`'s new-
   * row path would. Also writes the row into `errorRowByUrl` so a
   * subsequent retry (different `requestId`, same URL) consolidates
   * onto it via the existing `replaceErrorRow` path.
   */
  private supersedePendingWithError(idx: number, err: InspectorRequestError): void {
    const existing = this.entries[idx];
    const info = lookupErrorCode(err.error);

    // Preserve the original request-start instant (from `onBeforeRequest`)
    // rather than adopting the error event's timestamp. The two clocks
    // drift apart for cancellations triggered by navigation — the
    // request started in the past, but `onErrorOccurred` fires "now",
    // after the nav. Using the start time keeps the row sorting where
    // Chrome's own Network panel places it (with the previous page's
    // activity, not after the new nav row).
    const startedDateTime = existing.harEntry.startedDateTime;
    const safeTs = existing.timestamp;

    const oldHarKey = harKey(existing.method, existing.url, startedDateTime);
    const newHarKey = harKey(err.method, err.url, startedDateTime);
    if (newHarKey !== oldHarKey) {
      this.removeFromHarKey(oldHarKey, idx);
      this.addToHarKey(newHarKey, idx);
    }
    const newList = this.byHarKey.get(newHarKey);
    const positionInNewList = newList ? newList.indexOf(idx) : 0;
    const newId = mintEntryId(newHarKey, positionInNewList, err.requestId || undefined, existing.arrivalIndex);
    if (newId !== existing.id) {
      const fires = this.firesByEntry.get(existing.id);
      if (fires) {
        this.firesByEntry.delete(existing.id);
        this.firesByEntry.set(newId, fires);
      }
    }

    const { pending: _drop, ...rest } = existing;
    void _drop;
    // If `onCompleted` already stamped a real HTTP status on this
    // pending row (headers arrived before the body aborted — the
    // canonical abort-mid-body shape), preserve it. The error event
    // describes the body failure; the response line is still valid
    // and Chrome's panel shows both.
    const hadStatus = typeof existing.statusCode === 'number' && existing.statusCode > 0;
    this.entries[idx] = {
      ...rest,
      id: newId,
      harEntry: synthesizeErrorHarEntry(err, startedDateTime),
      timestamp: safeTs,
      statusCode: hadStatus ? existing.statusCode : 0,
      statusText: hadStatus ? (existing.statusText ?? err.error) : err.error,
      resourceType: err.resourceType,
      error: { code: err.error, reason: info.reason },
    };
    this.errorRowByUrl.set(errorUrlKey(err.method, err.url), idx);
    this.bump();
  }

  /**
   * Replace a placeholder row (pending from `onBeforeRequest`, or
   * error from `onErrorOccurred`) in place with a real HAR entry. The
   * pending case is the common one: the panel mints a row at request
   * start and now upgrades it to the resolved HAR. The error case
   * covers the rarer race where `onErrorOccurred` fired first but a
   * HAR landed later. Either way, the row's display position is
   * preserved and the `error` / `pending` markers are cleared.
   */
  private supersedeWithHar(idx: number, har: InspectorHarEntry, chromeRequestId: string): void {
    const existing = this.entries[idx];
    const method = har.request?.method ?? existing.method;
    const url = har.request?.url ?? existing.url;
    const ts = harStartTime(har);
    const oldHarKey = harKey(existing.method, existing.url, existing.harEntry.startedDateTime);
    const newHarKey = harKey(method, url, har.startedDateTime);

    if (newHarKey !== oldHarKey) {
      this.removeFromHarKey(oldHarKey, idx);
      this.addToHarKey(newHarKey, idx);
    }
    const newList = this.byHarKey.get(newHarKey);
    const positionInNewList = newList ? newList.indexOf(idx) : 0;
    const newId = mintEntryId(newHarKey, positionInNewList, chromeRequestId, existing.arrivalIndex);
    if (newId !== existing.id) {
      const fires = this.firesByEntry.get(existing.id);
      if (fires) {
        this.firesByEntry.delete(existing.id);
        this.firesByEntry.set(newId, fires);
      }
    }

    // Drop from the error-dedup map — this row is no longer an error.
    this.errorRowByUrl.delete(errorUrlKey(existing.method, existing.url));

    // The error row may have been stored under a different requestId
    // (or none) when it was synthesized; ensure the HAR's requestId is
    // mapped to this idx without duplicating.
    if (existing.chromeRequestId && existing.chromeRequestId !== chromeRequestId) {
      const oldList = this.byRequestId.get(existing.chromeRequestId);
      if (oldList) {
        const pos = oldList.indexOf(idx);
        if (pos >= 0) oldList.splice(pos, 1);
        if (oldList.length === 0) this.byRequestId.delete(existing.chromeRequestId);
      }
    }
    const list = this.byRequestId.get(chromeRequestId);
    if (list) {
      if (!list.includes(idx)) list.push(idx);
    } else {
      this.byRequestId.set(chromeRequestId, [idx]);
    }

    const { error: _dropError, pending: _dropPending, ...rest } = existing;
    void _dropError;
    void _dropPending;
    // Preserve / re-derive `error` from the HAR's `response._error`
    // (Chromium net-stack code on failed requests). Without this, a
    // pending row superseded by a status-0 HAR ends up with no error
    // info at all.
    const harError = har.response?._error;
    const harStatus = har.response?.status;
    const harErrorInfo = harError && harStatus === 0 ? lookupErrorCode(harError) : null;
    // If `onCompleted` already stamped a real HTTP status on this row
    // (e.g. the response landed before an unread body stream was later
    // aborted on page close), prefer that over a status-0 HAR. The
    // HAR's _error stays attached as auxiliary context, mirroring how
    // Chrome's panel shows both the response and the body-abort.
    //
    // Same defence covers the redirect-source case: when this row was
    // stamped by `ingestRequestRedirect` with an authoritative 3xx,
    // Chrome's HAR sometimes shows up later carrying the *follow-up's*
    // 2xx as the status. The captured 3xx wins; the HAR is treated as
    // augmentation only. We detect a redirect-source row by the
    // `Location` carrier on its existing response (`redirectURL` set).
    const existingStatus = existing.statusCode;
    const wasRedirect =
      typeof existingStatus === 'number' &&
      existingStatus >= 300 &&
      existingStatus < 400 &&
      !!existing.harEntry.response?.redirectURL;
    const preserveStatus =
      (typeof existingStatus === 'number' && existingStatus > 0 && harStatus === 0) ||
      (wasRedirect && harStatus !== existingStatus);
    // When we're preserving a redirect-source status, patch the
    // *replacement* HAR's response shell too so the detail pane / HAR
    // export reflect the captured 3xx, not the HAR's wrong follow-up
    // status. Other response fields (headers, cookies, timings) ride
    // along from the HAR — they're still legitimate augmentation.
    const harForRow: InspectorHarEntry =
      wasRedirect && preserveStatus
        ? {
            ...har,
            response: {
              ...(har.response ?? {
                status: 0,
                statusText: '',
                headers: [],
                content: { size: 0, mimeType: '' },
              }),
              status: existingStatus as number,
              statusText: existing.statusText ?? har.response?.statusText ?? '',
              redirectURL: existing.harEntry.response?.redirectURL ?? har.response?.redirectURL,
            },
          }
        : har;
    this.entries[idx] = {
      ...rest,
      id: newId,
      harEntry: harForRow,
      chromeRequestId,
      method,
      url,
      timestamp: ts,
      statusCode: preserveStatus ? existingStatus : harStatus,
      statusText: preserveStatus ? (existing.statusText ?? har.response?.statusText) : har.response?.statusText,
      mimeType: har.response?.content?.mimeType,
      responseSize: har.response?.content?.size,
      duration: har.time,
      resourceType: har._resourceType ?? existing.resourceType,
      ...(harError && harErrorInfo ? { error: { code: harError, reason: harErrorInfo.reason } } : {}),
    };
    this.bump();
  }

  /**
   * Mint a pending row from a `chrome.webRequest.onBeforeRequest`
   * observation. The row carries a synthetic `harEntry` shell (no
   * response) and `pending: true`; the existing request-state
   * classifier returns `pending`, so the table renders "(pending)"
   * with no further branching. A later HAR or error event supersedes
   * this row in place; if neither arrives before the next navigation,
   * `promotePendingToUnknown` converts it to an `(unknown)` placeholder
   * — matching Chrome's "abandoned mid-flight" UX, which the extension
   * APIs would otherwise miss.
   *
   * Dedup: if a row (HAR, error, or another pending) already exists
   * for this `requestId`, drop the start event. The downstream events
   * are more authoritative.
   */
  ingestRequestStarted(event: InspectorRequestStarted): void {
    if (!this.recording) return;
    if (!event.requestId) return;
    const existing = this.byRequestId.get(event.requestId);
    if (existing && existing.length > 0) return;

    const ts = Date.parse(event.timestamp);
    const safeTs = Number.isFinite(ts) ? ts : Date.now();
    const startedDateTime = Number.isFinite(ts) ? event.timestamp : new Date(safeTs).toISOString();
    const key = harKey(event.method, event.url, startedDateTime);
    const existingForKey = this.byHarKey.get(key);
    const arrivalIndex = this.arrivalCounter++;
    const entryId = mintEntryId(key, existingForKey?.length ?? 0, event.requestId, arrivalIndex);
    const pageref = this.pageTracker.ensurePage(startedDateTime);

    const entry: InspectorRequest = {
      id: entryId,
      harEntry: synthesizePendingHarEntry(event, startedDateTime),
      chromeRequestId: event.requestId,
      method: event.method,
      url: event.url,
      timestamp: safeTs,
      resourceType: event.resourceType,
      fires: [],
      arrivalIndex,
      displayId: this.displayCounter++,
      pageref,
      pending: true,
    };

    const idx = this.entries.push(entry) - 1;
    if (existingForKey) existingForKey.push(idx);
    else this.byHarKey.set(key, [idx]);
    const list = this.byRequestId.get(event.requestId);
    if (list) list.push(idx);
    else this.byRequestId.set(event.requestId, [idx]);
    this.bump();
  }

  /**
   * Resolve a pending row using a `chrome.webRequest.onCompleted`
   * event as a secondary completion signal.
   *
   * `chrome.devtools.network.onRequestFinished` has documented coverage
   * gaps (lazy-loaded modulepreload chunks, speculation rules) where
   * Chrome's own Network panel still surfaces the request — via CDP —
   * but the extension API silently drops the HAR. Without a backup
   * signal those rows stay forever pending; webRequest's `onCompleted`
   * fires for every observed completion and gives us a real status
   * code to populate the row with.
   *
   * If the row was already resolved by a HAR or an error, this event
   * is a no-op. If it's still pending, we stamp the synthetic harEntry
   * with a minimal `response` (status + statusLine + fromCache marker)
   * and clear `pending` so the panel renders the real status and HAR
   * export includes the row.
   */
  ingestRequestCompleted(event: InspectorRequestCompleted): void {
    if (!this.recording) return;
    if (!event.requestId) return;
    const list = this.byRequestId.get(event.requestId);
    if (!list || list.length === 0) return;

    let target = -1;
    for (const idx of list) {
      if (this.entries[idx]?.pending) {
        target = idx;
        break;
      }
    }
    if (target === -1) return;

    const existing = this.entries[target];
    // Statusline parser: webRequest emits "HTTP/1.1 200 OK" — split off
    // the reason phrase for the HAR shell's `statusText`.
    const reasonMatch = /^\S+\s+\d+\s+(.*)$/.exec(event.statusLine);
    const statusText = reasonMatch?.[1] ?? '';
    const synthHar: InspectorHarEntry = {
      ...existing.harEntry,
      response: {
        status: event.statusCode,
        statusText,
        httpVersion: '',
        headers: [],
        cookies: [],
        content: { size: -1, mimeType: '' },
        headersSize: -1,
        bodySize: -1,
      },
      ...(event.fromCache ? { _fromCache: 'memory' as const } : {}),
    };

    // Keep `pending: true` set — the row is *resolved* (we now know the
    // status code) but still *synthetic*: a later HAR carries authoritative
    // headers, cookies, body, and timing. Leaving `pending` on means the
    // HAR-supersession check in `ingestHarEntry` still recognises this row
    // as upgradable. The classifier already returns `success` (not
    // `pending`) once `statusCode` is set, so the UI renders 200 — only
    // `isPendingRequest()` keeps treating it as a placeholder until the
    // real HAR lands.
    this.entries[target] = {
      ...existing,
      harEntry: synthHar,
      statusCode: event.statusCode,
      statusText,
    };
    this.bump();
  }

  /**
   * Stamp the source hop of a redirect with its authoritative 3xx
   * status, sourced from `chrome.webRequest.onBeforeRedirect`. Chrome's
   * `chrome.devtools.network.onRequestFinished` is unreliable for
   * redirect source rows — drops some statuses entirely, mis-attributes
   * others to the follow-up's 2xx — so this event is the source of
   * truth for the row's response line.
   *
   * Three paths:
   *
   *   1. A pending row for `(requestId, sourceUrl)` exists (typical):
   *      promote it in place to a resolved 3xx row. `displayId` and
   *      `arrivalIndex` are preserved.
   *   2. A row for `(requestId, sourceUrl)` already has this 3xx
   *      status: dedup, no-op.
   *   3. No matching row: mint a free-standing resolved 3xx row.
   *
   * A subsequent HAR for the same source hop is *not* allowed to
   * downgrade the status — see `supersedeWithHar` and the
   * `redirectURL` guard on the response shell.
   */
  ingestRequestRedirect(event: InspectorRequestRedirect): void {
    if (!this.recording) return;
    if (!event.requestId) return;

    const ts = Date.parse(event.timestamp);
    const safeTs = Number.isFinite(ts) ? ts : Date.now();
    const startedDateTime = Number.isFinite(ts) ? event.timestamp : new Date(safeTs).toISOString();
    const statusText = STATUS_TEXT_3XX[event.statusCode] ?? 'Redirect';

    const list = this.byRequestId.get(event.requestId);
    if (list && list.length > 0) {
      for (const idx of list) {
        const existing = this.entries[idx];
        if (!existing || existing.url !== event.sourceUrl) continue;
        // Dedup: already stamped with this exact status.
        if (existing.statusCode === event.statusCode && existing.harEntry.response?.redirectURL === event.redirectUrl) {
          return;
        }
        // Supersede in place. Preserve displayId/arrivalIndex/pageref.
        const synthHar: InspectorHarEntry = {
          ...existing.harEntry,
          response: {
            status: event.statusCode,
            statusText,
            httpVersion: '',
            headers: [{ name: 'Location', value: event.redirectUrl }],
            cookies: [],
            content: { size: 0, mimeType: '' },
            redirectURL: event.redirectUrl,
            headersSize: -1,
            bodySize: 0,
          },
        };
        const { pending: _drop, ...rest } = existing;
        void _drop;
        this.entries[idx] = {
          ...rest,
          harEntry: synthHar,
          statusCode: event.statusCode,
          statusText,
        };
        this.bump();
        return;
      }
    }

    // No matching row — mint a free-standing resolved 3xx row. Happens
    // when the redirect event arrives before the corresponding
    // `request-started` (rare; the inspector port flushes started rows
    // first, but a live race is possible on a slow first connection).
    const key = harKey(event.method, event.sourceUrl, startedDateTime);
    const existingForKey = this.byHarKey.get(key);
    const arrivalIndex = this.arrivalCounter++;
    const entryId = mintEntryId(key, existingForKey?.length ?? 0, event.requestId, arrivalIndex);
    const pageref = this.pageTracker.ensurePage(startedDateTime);
    const synthHar: InspectorHarEntry = {
      startedDateTime,
      time: 0,
      request: {
        method: event.method,
        url: event.sourceUrl,
        httpVersion: '',
        headers: [],
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: -1,
      },
      response: {
        status: event.statusCode,
        statusText,
        httpVersion: '',
        headers: [{ name: 'Location', value: event.redirectUrl }],
        cookies: [],
        content: { size: 0, mimeType: '' },
        redirectURL: event.redirectUrl,
        headersSize: -1,
        bodySize: 0,
      },
      timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
      _resourceType: event.resourceType,
    };
    const entry: InspectorRequest = {
      id: entryId,
      harEntry: synthHar,
      chromeRequestId: event.requestId,
      method: event.method,
      url: event.sourceUrl,
      timestamp: safeTs,
      resourceType: event.resourceType,
      statusCode: event.statusCode,
      statusText,
      fires: [],
      arrivalIndex,
      displayId: this.displayCounter++,
      pageref,
    };
    const idx = this.entries.push(entry) - 1;
    if (existingForKey) existingForKey.push(idx);
    else this.byHarKey.set(key, [idx]);
    const reqList = this.byRequestId.get(event.requestId);
    if (reqList) reqList.push(idx);
    else this.byRequestId.set(event.requestId, [idx]);
    this.bump();
  }

  /**
   * Promote every still-pending row to `(unknown)`. Called from
   * `onNavigated` so rows that started but never resolved (the page
   * killed them) flip to a terminal "(unknown)" state matching
   * Chrome's "abandoned" UX. After promotion, `isErrorRequest` returns
   * true for these rows so HAR export excludes them.
   */
  private promotePendingToUnknown(): void {
    let changed = false;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (!e.pending) continue;
      // Note: we DON'T skip rows that have a statusCode from
      // `onCompleted`. A `pending: true` row at nav-time is one the
      // devtools-API HAR pipeline never resolved, regardless of
      // whether the webRequest-side completion event arrived. The
      // body is missing (Preview would show an infinite skeleton),
      // and that mismatch — webRequest reports 200, devtools reports
      // nothing — is exactly the case Chrome's Network panel labels
      // `(unknown)`. We follow the same convention so users don't
      // click into a "200" row and find no response data.
      const { pending: _drop, ...rest } = e;
      void _drop;
      this.entries[i] = {
        ...rest,
        statusCode: 0,
        statusText: 'unknown',
        error: { code: 'oh:abandoned', reason: 'unknown' },
      };
      changed = true;
    }
    if (changed) this.bump();
  }

  ingestHarBody(body: InspectorHarBody): void {
    const key = harKey(body.method, body.url, body.startedDateTime);
    const candidates = this.byHarKey.get(key);
    if (!candidates || candidates.length === 0) return;
    // har-body messages identify their entry only by
    // `(method, url, startedDateTime)`. When two genuine concurrent
    // fetches collide on that triple, we attach the body to the oldest
    // entry without one (FIFO). Chrome emits bodies in entry-arrival
    // order, so this matches in practice.
    let target = -1;
    for (const candidate of candidates) {
      if (this.entries[candidate]?.responseBody == null) {
        target = candidate;
        break;
      }
    }
    if (target === -1) return;
    const entry = this.entries[target];
    this.entries[target] = {
      ...entry,
      responseBody: body.content,
      responseBodyEncoding: body.encoding,
    };
    this.bump();
  }

  ingestFire(record: RequestRecord, authoritative: boolean): void {
    if (!this.recording) return;

    const fire: InspectorFire = {
      ruleUid: record.ruleUid,
      t: record.t,
      pattern: record.pattern,
      authoritative,
      requestId: record.requestId,
      shadowedBy: record.shadowedBy,
      evidence: record.evidence,
      ...(record.ruleSnapshot ? { ruleSnapshot: record.ruleSnapshot } : {}),
    };
    const dedup = fireDedupKey(fire.ruleUid, fire.requestId, fire.t);

    // Primary join: requestId. The background has already attached the
    // matching `chromeRequestId` to the HAR entry via per-URL FIFO
    // correlation, so this is unambiguous even when many requests share
    // a URL (rapid refreshes, parallel XHRs to the same endpoint).
    //
    // Redirect chains share a single requestId across multiple HAR rows
    // — when more than one entry is registered against this requestId,
    // pick the one whose URL also matches the fire's URL. For the common
    // (non-redirect) case the list has one entry and we use it directly,
    // tolerating the rare URL-canonicalization mismatch (e.g. fire URL
    // normalized vs HAR URL raw) that the URL filter would otherwise
    // reject.
    if (fire.requestId) {
      const list = this.byRequestId.get(fire.requestId);
      if (list && list.length > 0) {
        const idx = list.length === 1 ? list[0] : list.find((i) => this.entries[i].url === record.url);
        if (idx != null) {
          this.attachOrUpgrade(idx, fire, dedup);
          return;
        }
      }
    }

    // Fallback: URL + recency window, walked newest-first. Used when the
    // HAR row has no `chromeRequestId` (background never observed the
    // request) or the fire itself has no requestId (scriptable-only).
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e.url !== record.url) continue;
      if (Math.abs(e.timestamp - record.t) > HAR_TO_FIRE_WINDOW_MS) break;
      // Skip entries that already have a known different requestId — the
      // primary join failed for a reason and we should not silently
      // reattach to a row we know belongs to a different request.
      if (e.chromeRequestId && fire.requestId && e.chromeRequestId !== fire.requestId) continue;
      this.attachOrUpgrade(i, fire, dedup);
      return;
    }

    // No HAR entry matched — dangle. The HAR may still arrive later
    // (the fire fires at request-start, HAR at finish) and `ingestHarEntry`
    // will sweep this dangling fire onto it. If a dangling copy already
    // exists for this dedup key, fold the stronger `authoritative` /
    // `evidence` from the newcomer into the existing record — race-
    // independent, so whichever arrival was the strongest signal wins.
    if (this.danglingFireKeys.has(dedup)) {
      this.upgradeDanglingFire(dedup, fire);
      this.bump();
      return;
    }
    this.danglingFireKeys.add(dedup);
    this.danglingFires.push({ ...fire, url: record.url });
    if (this.danglingFires.length > MAX_DANGLING_FIRES) {
      const dropped = this.danglingFires.splice(0, this.danglingFires.length - MAX_DANGLING_FIRES);
      for (const d of dropped) {
        this.danglingFireKeys.delete(fireDedupKey(d.ruleUid, d.requestId, d.t));
      }
    }
    this.bump();
  }

  /**
   * Attach `fire` to entry at `idx`, OR — if a fire with this dedup key is
   * already attached — fold the newcomer's `authoritative` flag and
   * `evidence` tier into the existing record when either is stronger.
   * `authoritative=true` ranks above `false`; evidence `confirmed >
   * matched > matched-fallback > silent`. Both channels (Chrome's
   * onRuleMatchedDebug and the in-page fire-bridge) race in dev mode;
   * whichever arrives first must not lock in a weaker signal.
   */
  private attachOrUpgrade(idx: number, fire: InspectorFire, dedup: string): void {
    const e = this.entries[idx];
    const seen = this.firesByEntry.get(e.id) ?? new Set<string>();
    if (!seen.has(dedup)) {
      seen.add(dedup);
      this.firesByEntry.set(e.id, seen);
      this.entries[idx] = { ...e, fires: [...e.fires, fire] };
      this.bump();
      return;
    }
    let upgraded = false;
    const next = e.fires.map((f) => {
      if (upgraded) return f;
      if (fireDedupKey(f.ruleUid, f.requestId, f.t) !== dedup) return f;
      const merged = mergeFireEvidence(f, fire);
      if (merged === f) return f;
      upgraded = true;
      return merged;
    });
    if (!upgraded) return;
    this.entries[idx] = { ...e, fires: next };
    this.bump();
  }

  private upgradeDanglingFire(dedup: string, incoming: InspectorFire): void {
    let upgraded = false;
    this.danglingFires = this.danglingFires.map((d) => {
      if (upgraded) return d;
      if (fireDedupKey(d.ruleUid, d.requestId, d.t) !== dedup) return d;
      const merged = mergeFireEvidence(d, incoming);
      if (merged === d) return d;
      upgraded = true;
      return merged;
    });
  }

  private bump(): void {
    this.version++;
    this.snapshot = {
      entries: this.entries.slice(),
      danglingFires: this.danglingFires.slice(),
      navTiming: this.navTiming,
      initiatorChildren: new Map(this.initiatorChildren),
      pages: this.pageTracker.list().slice(),
      version: this.version,
    };
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A listener crashing must never stop others from being notified.
      }
    }
  }
}
