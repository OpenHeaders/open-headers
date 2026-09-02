/**
 * The session's scripts as the pane reads them — one digest per hook
 * over EITHER source: the live feed's `script` marks while the session
 * is open, the snapshot's `scripts` record once it settled (the marks
 * stop at the cap, the record's tallies never do — so the settled
 * digest reads the record, the live one the marks). The Scripts view
 * and the meta-strip tag draw from the digest; the timeline draws the
 * marks themselves.
 */

import type { WsScriptKind } from '@openheaders/core/scripts';
import { WS_SCRIPT_KINDS } from '@openheaders/core/scripts';
import type { ExecutedWsScriptMark, ExecutedWsScripts, ScriptEventLevelSummary } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { WsTimelineLifecycleItem } from './ws-lifecycle';

/** A `script` mark as the timeline holds it — with its display index
 *  and, when observed, its host stamp. */
export type WsScriptMarkItem = Extract<WsTimelineLifecycleItem, { kind: 'script' }>;

/** The hook labels — the Scripts tab's rail vocabulary, verbatim. */
export const WS_HOOK_LABEL_KEY: Readonly<Record<WsScriptKind, MessageKey>> = {
  'ws-before-connect': 'workbench.editors.request.scripts.wsBeforeConnect',
  'ws-before-send': 'workbench.editors.request.scripts.wsBeforeSend',
  'ws-on-message': 'workbench.editors.request.scripts.wsOnMessage',
  'ws-after-close': 'workbench.editors.request.scripts.wsAfterClose',
};

/** One hook's tally across the session. */
export interface WsHookDigest {
  hook: WsScriptKind;
  runs: number;
  failed: number;
  durationMs: number;
  levels: ScriptEventLevelSummary[];
  lastError?: string;
  /** Before send: the sends a level dropped. */
  dropped: number;
}

export interface WsScriptsDigest {
  hooks: WsHookDigest[];
  runs: number;
  failed: number;
  marksCapped: boolean;
}

/** The `script` marks among the lifecycle items, in order. */
export function scriptMarksOf(items: readonly WsTimelineLifecycleItem[]): WsScriptMarkItem[] {
  return items.filter((item): item is WsScriptMarkItem => item.kind === 'script');
}

function emptyHook(hook: WsScriptKind): WsHookDigest {
  return { hook, runs: 0, failed: 0, durationMs: 0, levels: [], dropped: 0 };
}

function tallyMark(digest: WsHookDigest, mark: ExecutedWsScriptMark): void {
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

function finish(byHook: Map<WsScriptKind, WsHookDigest>, marksCapped: boolean): WsScriptsDigest {
  const hooks = WS_SCRIPT_KINDS.flatMap((kind) => {
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

/** The live session's digest — off the marks the feed carried so far. */
export function digestFromMarks(marks: readonly WsScriptMarkItem[]): WsScriptsDigest {
  const byHook = new Map<WsScriptKind, WsHookDigest>();
  for (const mark of marks) {
    let digest = byHook.get(mark.hook);
    if (digest === undefined) {
      digest = emptyHook(mark.hook);
      byHook.set(mark.hook, digest);
    }
    tallyMark(digest, mark);
  }
  return finish(byHook, false);
}

/** The settled session's digest — off the snapshot's record, whose
 *  tallies outlive the mark cap. */
export function digestFromRecord(scripts: ExecutedWsScripts): WsScriptsDigest {
  const byHook = new Map<WsScriptKind, WsHookDigest>();
  if (scripts.beforeConnect !== undefined) {
    const fold = scripts.beforeConnect;
    const digest = emptyHook('ws-before-connect');
    // The record keeps the LAST dial's fold; the dial count is the runs.
    digest.runs = fold.dials;
    digest.failed = fold.succeeded ? 0 : 1;
    digest.durationMs = fold.durationMs;
    if (fold.error !== undefined) digest.lastError = fold.error.message;
    digest.levels = fold.chain.map((step) => ({
      level: step.level,
      uid: step.uid,
      name: step.name,
      runs: fold.dials,
      failed: step.succeeded ? 0 : 1,
      durationMs: step.durationMs,
    }));
    byHook.set('ws-before-connect', digest);
  }
  if (scripts.beforeSend !== undefined) {
    const summary = scripts.beforeSend;
    byHook.set('ws-before-send', {
      hook: 'ws-before-send',
      runs: summary.runs,
      failed: summary.failed,
      durationMs: summary.durationMs,
      levels: summary.levels,
      ...(summary.lastError !== undefined ? { lastError: summary.lastError.message } : {}),
      dropped: summary.dropped,
    });
  }
  if (scripts.onMessage !== undefined) {
    const summary = scripts.onMessage;
    byHook.set('ws-on-message', {
      hook: 'ws-on-message',
      runs: summary.runs,
      failed: summary.failed,
      durationMs: summary.durationMs,
      levels: summary.levels,
      ...(summary.lastError !== undefined ? { lastError: summary.lastError.message } : {}),
      dropped: 0,
    });
  }
  if (scripts.afterClose !== undefined) {
    const fold = scripts.afterClose;
    const digest = emptyHook('ws-after-close');
    digest.runs = 1;
    digest.failed = fold.succeeded ? 0 : 1;
    digest.durationMs = fold.durationMs;
    if (fold.error !== undefined) digest.lastError = fold.error.message;
    digest.levels = fold.chain.map((step) => ({
      level: step.level,
      uid: step.uid,
      name: step.name,
      runs: 1,
      failed: step.succeeded ? 0 : 1,
      durationMs: step.durationMs,
    }));
    byHook.set('ws-after-close', digest);
  }
  return finish(byHook, scripts.marksCapped === true);
}
