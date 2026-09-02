/**
 * The WebSocket session's scripts as the pane reads them — the shared
 * session-scripts digest (`session-scripts/`) under the WebSocket hook
 * order and vocabulary: the live feed's `script` marks while the
 * session is open, the snapshot's `scripts` record once it settled.
 */

import type { WsScriptKind } from '@openheaders/core/scripts';
import { WS_SCRIPT_KINDS } from '@openheaders/core/scripts';
import type { ExecutedWsScripts } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import {
  digestFromMarks as digestFromSessionMarks,
  finishDigest,
  foldDigest,
  type SessionHookDigest,
  type SessionScriptsDigest,
  summaryDigest,
} from '../session-scripts/session-scripts-digest';
import type { SessionScriptsVocabulary } from '../session-scripts/session-scripts-vocabulary';
import type { WsTimelineLifecycleItem } from './ws-lifecycle';

/** A `script` mark as the timeline holds it — with its display index
 *  and, when observed, its host stamp. */
export type WsScriptMarkItem = Extract<WsTimelineLifecycleItem, { kind: 'script' }>;

export type WsHookDigest = SessionHookDigest<WsScriptKind>;
export type WsScriptsDigest = SessionScriptsDigest<WsScriptKind>;

/** The hook labels — the Scripts tab's rail vocabulary, verbatim. */
export const WS_HOOK_LABEL_KEY: Readonly<Record<WsScriptKind, MessageKey>> = {
  'ws-before-connect': 'workbench.editors.request.scripts.wsBeforeConnect',
  'ws-before-send': 'workbench.editors.request.scripts.wsBeforeSend',
  'ws-on-message': 'workbench.editors.request.scripts.wsOnMessage',
  'ws-after-close': 'workbench.editors.request.scripts.wsAfterClose',
};

/** What the WebSocket pane hands the shared Scripts tag and view. */
export const WS_SCRIPTS_VOCABULARY: SessionScriptsVocabulary<WsScriptKind> = {
  hookLabelKey: WS_HOOK_LABEL_KEY,
  closeHook: 'ws-after-close',
  testIdPrefix: 'ws',
  keys: {
    tag: 'workbench.editors.websocket.session.scripts.tag',
    tagTitle: 'workbench.editors.websocket.session.scripts.tagTitle',
    tagSummary: 'workbench.editors.websocket.session.scripts.tagSummary',
    tagSummaryFailed: 'workbench.editors.websocket.session.scripts.tagSummaryFailed',
    runs: 'workbench.editors.websocket.session.scripts.runs',
    runsOne: 'workbench.editors.websocket.session.scripts.runsOne',
    failed: 'workbench.editors.websocket.session.scripts.failed',
    dropped: 'workbench.editors.websocket.session.scripts.dropped',
    empty: 'workbench.editors.websocket.session.scripts.empty',
    console: 'workbench.editors.websocket.session.scripts.console',
    tests: 'workbench.editors.websocket.session.scripts.tests',
    consoleEmpty: 'workbench.editors.websocket.session.scripts.consoleEmpty',
    testsEmpty: 'workbench.editors.websocket.session.scripts.testsEmpty',
    attempt: 'workbench.editors.websocket.session.scripts.attempt',
    atMessage: 'workbench.editors.websocket.session.scripts.atMessage',
    marksCapped: 'workbench.editors.websocket.session.scripts.marksCapped',
  },
};

/** The `script` marks among the lifecycle items, in order. */
export function scriptMarksOf(items: readonly WsTimelineLifecycleItem[]): WsScriptMarkItem[] {
  return items.filter((item): item is WsScriptMarkItem => item.kind === 'script');
}

/** The live session's digest — off the marks the feed carried so far. */
export function digestFromMarks(marks: readonly WsScriptMarkItem[]): WsScriptsDigest {
  return digestFromSessionMarks(marks, WS_SCRIPT_KINDS);
}

/** The settled session's digest — off the snapshot's record, whose
 *  tallies outlive the mark cap (the record keeps the LAST dial's
 *  Before connect fold; the dial count is the runs). */
export function digestFromRecord(scripts: ExecutedWsScripts): WsScriptsDigest {
  const byHook = new Map<WsScriptKind, WsHookDigest>();
  if (scripts.beforeConnect !== undefined) {
    byHook.set(
      'ws-before-connect',
      foldDigest('ws-before-connect', scripts.beforeConnect, scripts.beforeConnect.dials),
    );
  }
  if (scripts.beforeSend !== undefined) {
    byHook.set('ws-before-send', summaryDigest('ws-before-send', scripts.beforeSend, scripts.beforeSend.dropped));
  }
  if (scripts.onMessage !== undefined) {
    byHook.set('ws-on-message', summaryDigest('ws-on-message', scripts.onMessage, 0));
  }
  if (scripts.afterClose !== undefined) {
    byHook.set('ws-after-close', foldDigest('ws-after-close', scripts.afterClose, 1));
  }
  return finishDigest(byHook, WS_SCRIPT_KINDS, scripts.marksCapped === true);
}
