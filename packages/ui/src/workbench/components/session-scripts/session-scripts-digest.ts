/**
 * The session scripts digest — one tally per hook the pane reads over
 * EITHER source: the live feed's `script` marks while the session is
 * open, the snapshot's `scripts` record once it settled (the marks
 * stop at the cap, the record's tallies never do — so the settled
 * digest reads the record, the live one the marks). Kind-generic: the
 * WebSocket and MQTT panes hand their hook order and their record's
 * folds / summaries; the Scripts view and the meta-strip tag draw from
 * the digest, the timelines draw the marks themselves.
 */

import type { SessionScriptKind } from '@openheaders/core/scripts';
import {
  type ExecutedScriptFold,
  type ExecutedSessionScriptMark,
  MAX_SESSION_SCRIPT_MARKS,
  type ScriptEventLevelSummary,
  type ScriptEventSummary,
} from '@openheaders/core/types';

/** A `script` mark as a pane holds it — with its display index and,
 *  when observed, its host stamp. */
export type SessionScriptMarkItem<K extends SessionScriptKind> = ExecutedSessionScriptMark & {
  kind: 'script';
  hook: K;
  atIndex: number;
  atMs?: number;
};

/** One hook's tally across the session. */
export interface SessionHookDigest<K extends SessionScriptKind> {
  hook: K;
  runs: number;
  failed: number;
  durationMs: number;
  levels: ScriptEventLevelSummary[];
  lastError?: string;
  /** Before send / Before publish: the messages a level dropped. */
  dropped: number;
}

export interface SessionScriptsDigest<K extends SessionScriptKind> {
  hooks: SessionHookDigest<K>[];
  runs: number;
  failed: number;
  marksCapped: boolean;
}

function emptyHook<K extends SessionScriptKind>(hook: K): SessionHookDigest<K> {
  return { hook, runs: 0, failed: 0, durationMs: 0, levels: [], dropped: 0 };
}

function tallyMark<K extends SessionScriptKind>(digest: SessionHookDigest<K>, mark: ExecutedSessionScriptMark): void {
  digest.runs += 1;
  digest.durationMs += mark.durationMs;
  if (!mark.succeeded) {
    digest.failed += 1;
    if (mark.error !== undefined) digest.lastError = mark.error.message;
  }
  if (mark.droppedBy !== undefined) digest.dropped += 1;
  for (const step of mark.chain) {
    let level = digest.levels.find((l) => l.uid === step.uid);
    if (level === undefined) {
      level = { level: step.level, uid: step.uid, name: step.name, runs: 0, failed: 0, durationMs: 0 };
      digest.levels.push(level);
    }
    level.runs += 1;
    level.durationMs += step.durationMs;
    if (!step.succeeded) level.failed += 1;
  }
}

/** The digest in hook order, hooks that never ran absent. */
export function finishDigest<K extends SessionScriptKind>(
  byHook: ReadonlyMap<K, SessionHookDigest<K>>,
  order: readonly K[],
  marksCapped: boolean,
): SessionScriptsDigest<K> {
  const hooks = order.flatMap((kind) => {
    const digest = byHook.get(kind);
    return digest !== undefined && digest.runs > 0 ? [digest] : [];
  });
  return {
    hooks,
    runs: hooks.reduce((sum, h) => sum + h.runs, 0),
    failed: hooks.reduce((sum, h) => sum + h.failed, 0),
    marksCapped,
  };
}

/** The live session's digest — off the marks the feed carried so far.
 *  The plane records no mark past the cap, so a pane holding the cap's
 *  worth knows the detail stopped (the settled record says so itself);
 *  a feed whose early marks rolled away under the capture's retention
 *  reads under the cap until the record lands. */
export function digestFromMarks<K extends SessionScriptKind>(
  marks: readonly SessionScriptMarkItem<K>[],
  order: readonly K[],
): SessionScriptsDigest<K> {
  const byHook = new Map<K, SessionHookDigest<K>>();
  for (const mark of marks) {
    let digest = byHook.get(mark.hook);
    if (digest === undefined) {
      digest = emptyHook(mark.hook);
      byHook.set(mark.hook, digest);
    }
    tallyMark(digest, mark);
  }
  return finishDigest(byHook, order, marks.length >= MAX_SESSION_SCRIPT_MARKS);
}

/** A once-per-session hook's record as its digest — the fold ran
 *  `runs` times (the dials for Before connect, one for After close). */
export function foldDigest<K extends SessionScriptKind>(
  hook: K,
  fold: ExecutedScriptFold,
  runs: number,
): SessionHookDigest<K> {
  const digest = emptyHook(hook);
  digest.runs = runs;
  digest.failed = fold.succeeded ? 0 : 1;
  digest.durationMs = fold.durationMs;
  if (fold.error !== undefined) digest.lastError = fold.error.message;
  digest.levels = fold.chain.map((step) => ({
    level: step.level,
    uid: step.uid,
    name: step.name,
    runs,
    failed: step.succeeded ? 0 : 1,
    durationMs: step.durationMs,
  }));
  return digest;
}

/** A per-event hook's record as its digest. */
export function summaryDigest<K extends SessionScriptKind>(
  hook: K,
  summary: ScriptEventSummary,
  dropped: number,
): SessionHookDigest<K> {
  return {
    hook,
    runs: summary.runs,
    failed: summary.failed,
    durationMs: summary.durationMs,
    levels: summary.levels,
    ...(summary.lastError !== undefined ? { lastError: summary.lastError.message } : {}),
    dropped,
  };
}
