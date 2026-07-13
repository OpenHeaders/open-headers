/**
 * "Log XMLHttpRequests" derivation — the browser synthesizes a console
 * message frontend-side when a request of XHR category (xhr / fetch /
 * eventsource) reaches its terminal: `Fetch finished loading: GET "url".`
 * or `Fetch failed loading: GET "url".` (a failure or an HTTP error
 * status), Info level, Network source — no protocol switch involved.
 *
 * We mirror that as a pure projection over the panel's own network rows:
 * each terminal XHR-category lifecycle yields one ConsoleEntry-shaped row
 * with its `requestId` set, so the METHOD-url-link join and cross-nav to
 * the Network row come free from the existing console↔network join. The
 * `xhrLog` marker is panel-local (these entries never cross the wire) and
 * carries the parts the row renderer needs to linkify the URL inside the
 * browser's exact phrasing.
 *
 * Pure; the memo lives with the caller (the panel root owns the rows).
 * The "Log XMLHttpRequests" pref gates rendering inside ConsoleView.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { effectiveResourceType } from './inspector-row-projection';
import { parseRedirectHopRequestId } from './redirect-hop-rows';

/** A panel-synthesized XHR log entry — a {@link ConsoleEntry} plus the
 *  render parts. `kindLabel` is the browser's resource-type title. */
export interface XhrLogConsoleEntry extends ConsoleEntry {
  readonly xhrLog: {
    readonly kindLabel: string;
    readonly failed: boolean;
  };
}

export function isXhrLogEntry(entry: ConsoleEntry): entry is XhrLogConsoleEntry {
  return 'xhrLog' in entry;
}

/** The browser's XHR resource category, across both correlator vocabularies
 *  (webRequest `xmlhttprequest` vs the devtools HAR's `xhr`/`fetch`). */
const XHR_KIND_LABEL: Record<string, string> = {
  xhr: 'XHR',
  xmlhttprequest: 'XHR',
  fetch: 'Fetch',
  eventsource: 'EventSource',
};

/**
 * Derive the synthesized log entries from the panel's network rows, in
 * terminal-timestamp order. Synthetic redirect-hop rows are skipped — the
 * browser logs one message per request, on its final leg.
 */
export function deriveXhrLogEntries(rows: ReadonlyArray<{ lifecycle: RequestLifecycle }>): XhrLogConsoleEntry[] {
  const entries: XhrLogConsoleEntry[] = [];
  for (const { lifecycle } of rows) {
    if (lifecycle.phase !== 'completed' && lifecycle.phase !== 'failed') continue;
    if (parseRedirectHopRequestId(lifecycle.requestId) !== null) continue;
    const kindLabel = XHR_KIND_LABEL[effectiveResourceType(lifecycle).toLowerCase()];
    if (kindLabel === undefined) continue;
    const failed = lifecycle.phase === 'failed' || (lifecycle.statusCode !== undefined && lifecycle.statusCode >= 400);
    const verb = failed ? 'failed' : 'finished';
    entries.push({
      source: 'browser',
      level: 'info',
      category: 'network',
      requestId: lifecycle.requestId,
      args: [{ type: 'string', text: `${kindLabel} ${verb} loading: ${lifecycle.method} "${lifecycle.url}".` }],
      timestamp: lifecycle.completedAtMs ?? lifecycle.startedAtMs,
      xhrLog: { kindLabel, failed },
    });
  }
  entries.sort((a, b) => a.timestamp - b.timestamp);
  return entries;
}
