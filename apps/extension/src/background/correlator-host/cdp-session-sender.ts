/**
 * The narrow seam the CDP control-port adapters depend on — the slice of
 * {@link ChromeDebuggerEventSource} that issues a session-routed command.
 * Both control adapters delegate through this rather than naming
 * `chrome.debugger.*` themselves, keeping that namespace in one file and
 * sharing the single attach + session-mapping path.
 */
export interface CdpSessionSender {
  /** False when `chrome.debugger` is absent (Firefox / Safari). */
  readonly cdpAvailable: boolean;
  /** Issue one CDP command on `(tabId, sessionId)` and return its result. */
  sendOnSession(tabId: number, sessionId: string, method: string, params?: Record<string, unknown>): Promise<unknown>;
}
