/**
 * Console stream — engine→consumer update model.
 *
 * Sibling of `@openheaders/core/rule-fire-stream` and
 * `@openheaders/core/page-stream`. The engine captures a CDP-attached tab's
 * console output (`Runtime.consoleAPICalled`), uncaught exceptions
 * (`Runtime.exceptionThrown`), and browser-generated log entries
 * (`Log.entryAdded` — failed/blocked network requests, deprecations, CSP
 * violations, interventions, …), normalizes each into a host-neutral
 * {@link ConsoleEntry}, and fans it out as an append-only stream. Console
 * output is observation-only — there is no dedup or merge (every call is a
 * distinct event), unlike the rule-fire stream.
 *
 * One update kind (`'entry'`) for live + replay — replay re-emits each stored
 * entry as an `'entry'` update, identical shape to live, so the consumer
 * reducer has no replay/live branch. `'tab-cleared'` is emitted when the
 * engine drops a tab's console log (mirror of the page + rule-fire streams).
 */

/**
 * Display severity, bucketed from the CDP `consoleAPICalled` type or the
 * `Log` entry level. Unknown types (`dir`/`table`/`trace`/`group`/…) fall to
 * `log`; an uncaught exception is always `error`; a browser log entry's
 * `verbose` maps to `debug`. The raw CDP type is not preserved in v1 —
 * richer type fidelity is a later refinement.
 */
export type ConsoleLevel = 'log' | 'info' | 'warning' | 'error' | 'debug';

/**
 * One rendered console argument. `text` is rendered host-side from the CDP
 * `RemoteObject`'s inline `value` / `description` / `preview` — there is NO
 * `Runtime.getProperties` round-trip in v1, so a deep object shows its inline
 * preview, not its full contents. `type` / `subtype` are the CDP
 * `RemoteObject` discriminators, carried so a consumer can style by kind
 * (string vs number vs error vs array) without re-deriving.
 */
export interface ConsoleArg {
  readonly type: string;
  readonly subtype?: string;
  readonly text: string;
}

/**
 * One captured console line — a `console.*` call, an uncaught
 * exception/rejection, or a browser-generated log entry on a CDP-attached
 * tab. Host-neutral + JSON-safe (it crosses the runtime port to the panel).
 * Routed by `tabId` at the envelope level ({@link ConsoleStreamUpdate}), so
 * identity is positional (arrival order), not a field on the entry.
 */
export interface ConsoleEntry {
  /**
   * Capture origin: a `console.*` call, an uncaught exception/rejection, or
   * a browser-generated log entry (the browser's own console messages —
   * failed/blocked network requests, deprecations, violations, …).
   */
  readonly source: 'console-api' | 'exception' | 'browser';
  readonly level: ConsoleLevel;
  /** Rendered args (a `console.*` call) or the single message text. */
  readonly args: readonly ConsoleArg[];
  /** CDP wall-clock ms (`Runtime`/`Log` event timestamp). */
  readonly timestamp: number;
  /**
   * Browser log-entry category — the engine passes the browser's own source
   * label through verbatim (`network`/`deprecation`/`violation`/`security`/
   * `intervention`/`rendering`/…). Present only on `source: 'browser'`
   * entries; kept open (not a closed union) so a new browser category flows
   * through without a protocol change.
   */
  readonly category?: string;
  /** Top stack-frame location, when the event carried a stack. */
  readonly url?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
}

export type ConsoleStreamUpdate =
  | { kind: 'entry'; tabId: number; entry: ConsoleEntry }
  | { kind: 'tab-cleared'; tabId: number };
