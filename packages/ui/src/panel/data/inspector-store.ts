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

import type { InspectorHarBody, InspectorHarEntry, InspectorNavTiming, RequestRecord } from '@openheaders/core/types';
import { resolveInitiatorRootUrl } from './initiator-graph';
import { type DanglingFire, type InspectorFire, type InspectorRequest, mergeFireEvidence } from './types';

/** Window for promoting a URL+window dangling fire to a newly-arrived HAR entry. */
const FIRE_TO_HAR_WINDOW_MS = 5_000;

/** Window for attaching a URL+window arriving fire to a recent HAR entry. */
const HAR_TO_FIRE_WINDOW_MS = 5_000;

/** Maximum dangling fires retained — bounded so a rule loop can't OOM the panel. */
const MAX_DANGLING_FIRES = 5_000;

function harStartTime(entry: InspectorHarEntry): number {
  const t = Date.parse(entry.startedDateTime);
  return Number.isFinite(t) ? t : Date.now();
}

function harKey(method: string, url: string, startedDateTime: string): string {
  return `${method}|${url}|${startedDateTime}`;
}

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
  version: number;
}

export class InspectorStore {
  private entries: InspectorRequest[] = [];
  private danglingFires: DanglingFire[] = [];
  /** Index for matching har-body follow-up messages to their entry. */
  private byHarKey: Map<string, number> = new Map();
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
  private snapshot: InspectorSnapshot = {
    entries: [],
    danglingFires: [],
    navTiming: null,
    initiatorChildren: new Map(),
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
    this.entries = [];
    this.danglingFires = [];
    this.byHarKey.clear();
    this.byRequestId.clear();
    this.initiatorChildren.clear();
    this.firesByEntry.clear();
    this.danglingFireKeys.clear();
    this.displayCounter = 1;
    this.bump();
  };

  /** Called when the inspected window navigates. Respects preserve-log. */
  onNavigated = (): void => {
    // Nav timing is scoped to the *current* page; reset regardless of
    // preserve-log so the status bar doesn't keep showing DCL/Load
    // numbers from a previous navigation.
    this.navTiming = null;
    if (this.preserveLog) {
      this.bump();
      return;
    }
    this.clear();
  };

  setNavTiming = (timing: InspectorNavTiming): void => {
    this.navTiming = timing;
    this.bump();
  };

  getNavTiming = (): InspectorNavTiming | null => this.navTiming;

  ingestHarEntry(har: InspectorHarEntry, chromeRequestId?: string): void {
    if (!this.recording) return;

    const method = har.request?.method ?? '';
    const url = har.request?.url ?? '';
    const ts = harStartTime(har);
    const key = harKey(method, url, har.startedDateTime);

    // De-dupe: Chrome forwards a HAR entry exactly once per request.
    // The port's flush-on-connect can replay buffered entries that
    // already landed via a live broadcast, so silently coalesce dupes.
    if (this.byHarKey.has(key)) return;

    const entry: InspectorRequest = {
      id: key,
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
      arrivalIndex: this.arrivalCounter++,
      displayId: this.displayCounter++,
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
    this.firesByEntry.set(key, seenForThisEntry);

    const idx = this.entries.push(entry) - 1;
    this.byHarKey.set(key, idx);
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
      this.initiatorChildren.set(parentUrl, prev ? [...prev, key] : [key]);
    }

    this.bump();
  }

  ingestHarBody(body: InspectorHarBody): void {
    const key = harKey(body.method, body.url, body.startedDateTime);
    const idx = this.byHarKey.get(key);
    if (idx == null) return;
    const entry = this.entries[idx];
    this.entries[idx] = {
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
