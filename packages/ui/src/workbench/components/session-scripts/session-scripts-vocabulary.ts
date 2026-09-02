/**
 * What a session family hands the shared Scripts tag and view — its
 * hook labels (the Scripts tab's rail vocabulary, verbatim), the pane's
 * own catalog keys (each family's session pane speaks under its own
 * namespace), the hook whose mark carries no event heading (the
 * once-at-settle close hook) and the test-id prefix its surfaces wear.
 */

import type { SessionScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';

export interface SessionScriptsVocabulary<K extends SessionScriptKind> {
  hookLabelKey: Readonly<Record<K, MessageKey>>;
  /** The After close hook — its mark names no event. */
  closeHook: K;
  /** `ws` / `mqtt` — `<prefix>-session-scripts-tag`, `<prefix>-session-scripts-view`, … */
  testIdPrefix: string;
  keys: {
    tag: MessageKey;
    tagTitle: MessageKey;
    tagSummary: MessageKey;
    tagSummaryFailed: MessageKey;
    runs: MessageKey;
    runsOne: MessageKey;
    failed: MessageKey;
    dropped: MessageKey;
    empty: MessageKey;
    console: MessageKey;
    tests: MessageKey;
    consoleEmpty: MessageKey;
    testsEmpty: MessageKey;
    attempt: MessageKey;
    atMessage: MessageKey;
    marksCapped: MessageKey;
  };
}
