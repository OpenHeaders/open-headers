/**
 * The gRPC call's scripts as the result panes read them — the shared
 * session-scripts digest (`session-scripts/`) under the gRPC hook
 * order and vocabulary: the live feed's `script` marks while a
 * streaming call is open, the snapshot's `scripts` record once it
 * settled. The marks ride their own position-stamped list beside the
 * frames (the WebSocket lifecycle law), so a mark's display index is
 * its own `atIndex` and its stamp the feed's per-mark host time.
 */

import type { GrpcScriptKind } from '@openheaders/core/scripts';
import { GRPC_SCRIPT_KINDS } from '@openheaders/core/scripts';
import type { ExecutedGrpcScriptMark, ExecutedGrpcScripts } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import {
  digestFromMarks as digestFromSessionMarks,
  finishDigest,
  foldDigest,
  type SessionHookDigest,
  type SessionScriptMarkItem,
  type SessionScriptsDigest,
  summaryDigest,
} from '../session-scripts/session-scripts-digest';
import type { SessionScriptsVocabulary } from '../session-scripts/session-scripts-vocabulary';

/** A `script` mark as the panes hold it — with its capture position
 *  and, when observed, its host stamp. */
export type GrpcScriptMarkItem = SessionScriptMarkItem<GrpcScriptKind>;

export type GrpcHookDigest = SessionHookDigest<GrpcScriptKind>;
export type GrpcScriptsDigest = SessionScriptsDigest<GrpcScriptKind>;

/** The hook labels — the Scripts tab's rail vocabulary, verbatim. */
export const GRPC_HOOK_LABEL_KEY: Readonly<Record<GrpcScriptKind, MessageKey>> = {
  'grpc-before-invoke': 'workbench.editors.request.scripts.grpcBeforeInvoke',
  'grpc-on-message': 'workbench.editors.request.scripts.grpcOnMessage',
  'grpc-after-response': 'workbench.editors.request.scripts.grpcAfterResponse',
};

/** What the gRPC panes hand the shared Scripts tag and view. */
export const GRPC_SCRIPTS_VOCABULARY: SessionScriptsVocabulary<GrpcScriptKind> = {
  hookLabelKey: GRPC_HOOK_LABEL_KEY,
  closeHook: 'grpc-after-response',
  testIdPrefix: 'grpc',
  keys: {
    tag: 'workbench.editors.grpc.scripts.tag',
    tagTitle: 'workbench.editors.grpc.scripts.tagTitle',
    tagSummary: 'workbench.editors.grpc.scripts.tagSummary',
    tagSummaryFailed: 'workbench.editors.grpc.scripts.tagSummaryFailed',
    runs: 'workbench.editors.grpc.scripts.runs',
    runsOne: 'workbench.editors.grpc.scripts.runsOne',
    failed: 'workbench.editors.grpc.scripts.failed',
    dropped: 'workbench.editors.grpc.scripts.dropped',
    empty: 'workbench.editors.grpc.scripts.empty',
    console: 'workbench.editors.grpc.scripts.console',
    tests: 'workbench.editors.grpc.scripts.tests',
    consoleEmpty: 'workbench.editors.grpc.scripts.consoleEmpty',
    testsEmpty: 'workbench.editors.grpc.scripts.testsEmpty',
    attempt: 'workbench.editors.grpc.scripts.attempt',
    atMessage: 'workbench.editors.grpc.scripts.atMessage',
    marksCapped: 'workbench.editors.grpc.scripts.marksCapped',
  },
};

/** The marks as pane items — each with its host stamp when one was
 *  observed (the live feed's, or the session timing the editor
 *  retained at materialization, positional). */
export function scriptMarkItems(
  marks: readonly ExecutedGrpcScriptMark[],
  timestamps?: readonly number[],
): GrpcScriptMarkItem[] {
  return marks.map((mark, i) => {
    const atMs = timestamps?.[i];
    return atMs !== undefined ? { ...mark, atMs } : mark;
  });
}

/** The live call's digest — off the marks the feed carried so far. */
export function digestFromMarks(marks: readonly GrpcScriptMarkItem[]): GrpcScriptsDigest {
  return digestFromSessionMarks(marks, GRPC_SCRIPT_KINDS);
}

/** The settled call's digest — off the snapshot's record, whose
 *  tallies outlive the mark cap. */
export function digestFromRecord(scripts: ExecutedGrpcScripts): GrpcScriptsDigest {
  const byHook = new Map<GrpcScriptKind, GrpcHookDigest>();
  if (scripts.beforeInvoke !== undefined) {
    byHook.set('grpc-before-invoke', foldDigest('grpc-before-invoke', scripts.beforeInvoke, 1));
  }
  if (scripts.onMessage !== undefined) {
    byHook.set('grpc-on-message', summaryDigest('grpc-on-message', scripts.onMessage, 0));
  }
  if (scripts.afterResponse !== undefined) {
    byHook.set('grpc-after-response', foldDigest('grpc-after-response', scripts.afterResponse, 1));
  }
  return finishDigest(byHook, GRPC_SCRIPT_KINDS, scripts.marksCapped === true);
}
