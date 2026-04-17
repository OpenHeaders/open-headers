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
 *     paths) are correlated to HAR entries by URL + a recency window,
 *     then attached as `InspectorRequest.fires`.
 *
 *   - Fires that don't match any HAR entry within the window land in
 *     `danglingFires`. The Rule Activity view surfaces these so the
 *     user sees rule behavior even when the underlying request didn't
 *     produce a HAR entry (blocked / cached / service worker / fired
 *     before the panel was open).
 *
 *   - When a new HAR entry arrives, the store sweeps recent
 *     `danglingFires` for URL matches and promotes them to attached
 *     fires on the new entry. This handles the common ordering where
 *     the fire arrives before the HAR entry (fires fire at
 *     request-start, HAR at request-finish).
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
} from '@/background/modules/devtools-inspector-port';
import type { RequestRecord } from '@/background/modules/tab-telemetry';
import type { DanglingFire, InspectorFire, InspectorRequest } from './types';

/** Window for promoting a dangling fire to a newly-arrived HAR entry. */
const FIRE_TO_HAR_WINDOW_MS = 5_000;

/** Window for attaching an arriving fire to a recent HAR entry. */
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

export interface InspectorSnapshot {
  entries: readonly InspectorRequest[];
  danglingFires: readonly DanglingFire[];
  navTiming: InspectorNavTiming | null;
  version: number;
}

export class InspectorStore {
  private entries: InspectorRequest[] = [];
  private danglingFires: DanglingFire[] = [];
  /** Index for matching har-body follow-up messages to their entry. */
  private byHarKey: Map<string, number> = new Map();
  private version = 0;
  private listeners: Set<() => void> = new Set();
  private arrivalCounter = 0;
  private displayCounter = 1;
  /** Cached snapshot — rebuilt only on bump() so useSyncExternalStore is stable. */
  private navTiming: InspectorNavTiming | null = null;
  private snapshot: InspectorSnapshot = { entries: [], danglingFires: [], navTiming: null, version: 0 };
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

  ingestHarEntry(har: InspectorHarEntry): void {
    if (!this.recording) return;

    const method = har.request?.method ?? '';
    const url = har.request?.url ?? '';
    const ts = harStartTime(har);
    const key = harKey(method, url, har.startedDateTime);

    // De-dupe: Chrome forwards a HAR entry exactly once per request.
    // If we already have this exact key, it's a spurious duplicate
    // (shouldn't happen in practice — defensive).
    if (this.byHarKey.has(key)) return;

    const entry: InspectorRequest = {
      id: key,
      harEntry: har,
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

    // Before appending, sweep dangling fires for URL matches within
    // the promotion window and attach them. Fires typically fire at
    // request-start; the HAR entry arrives at request-finish, so
    // fires often land in the dangling list before their HAR entry
    // exists. The sweep heals that ordering.
    const now = ts;
    const kept: DanglingFire[] = [];
    const promoted: InspectorFire[] = [];
    for (const f of this.danglingFires) {
      if (f.url === url && Math.abs(f.t - now) <= FIRE_TO_HAR_WINDOW_MS) {
        promoted.push({
          ruleUid: f.ruleUid,
          t: f.t,
          pattern: f.pattern,
          authoritative: f.authoritative,
          shadowedBy: f.shadowedBy,
          evidence: f.evidence,
        });
      } else {
        kept.push(f);
      }
    }
    this.danglingFires = kept;
    entry.fires = promoted;

    const idx = this.entries.push(entry) - 1;
    this.byHarKey.set(key, idx);
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
      shadowedBy: record.shadowedBy,
      evidence: record.evidence,
    };

    // Walk entries newest-first looking for a URL match within the
    // attachment window. Newest-first because fires overwhelmingly
    // attach to the most recently observed request on that URL.
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e.url !== record.url) continue;
      if (Math.abs(e.timestamp - record.t) > HAR_TO_FIRE_WINDOW_MS) break;
      this.entries[i] = { ...e, fires: [...e.fires, fire] };
      this.bump();
      return;
    }

    // No HAR entry matched — dangle the fire. A HAR entry may still
    // arrive later (the fire fired at request-start, HAR fires at
    // finish), in which case `ingestHarEntry` will promote it.
    this.danglingFires.push({ ...fire, url: record.url });
    if (this.danglingFires.length > MAX_DANGLING_FIRES) {
      this.danglingFires.splice(0, this.danglingFires.length - MAX_DANGLING_FIRES);
    }
    this.bump();
  }

  private bump(): void {
    this.version++;
    this.snapshot = {
      entries: this.entries.slice(),
      danglingFires: this.danglingFires.slice(),
      navTiming: this.navTiming,
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
