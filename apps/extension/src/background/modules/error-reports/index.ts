/**
 * Crash-and-error-report host wiring for the service worker (the error
 * reports plan §4, §5) — the twin of the product-telemetry module
 * beside it, bound to the same substrates: the SAME `chrome.storage.session`
 * session store (one session id per browser launch; this channel boots
 * AFTER the usage one, never beside it), the settings store for
 * `telemetry.errorReports`, a fetch transport to the published errors
 * route, and the usage alarm's tick as the retry cadence.
 *
 * Inputs reach it from two sides: the UI documents' funnels over the
 * `errorReportRecord` RPC (a page never dials — this worker owns the
 * transport), and the worker's own `error` / `unhandledrejection`
 * events. Every input runs `toErrorReport` here with this extension's
 * own-origin test (law 4): a frame is ours when its URL sits under
 * `runtime.getURL('')` — the extension's own origin on every engine —
 * and foreign otherwise (a page script, a content script of someone
 * else's, `eval`). The bridge's typed failure carries its code (law 5).
 *
 * The pending queue persists in `chrome.storage.session`: it survives
 * SW eviction and dies with the browser, exactly the session scope a
 * report envelope has. A report flushes the moment it is recorded —
 * this worker may not live to see the alarm.
 */

import type { ErrorReportSnapshotWire, ErrorReportWireEntry } from '@openheaders/core/bridge';
import {
  type ErrorReportContext,
  ErrorReportController,
  type ErrorReportEnvelope,
  type ErrorReportInput,
  type ErrorReportQueueStore,
  type PersistedErrorReportQueueEntry,
  PRODUCT_ERROR_REPORTS_ENDPOINT,
  toErrorReport,
} from '@openheaders/core/telemetry';
import { describeError } from '@openheaders/ui/shared/error-funnel';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { runtime } from '@utils/browser-api';
import { buildEnvelopeFacts, sessionArea, sessionStore } from '../product-telemetry';

const QUEUE_KEY = 'oh.errorReports.queue';

/** The pending reports, session-scoped by the substrate itself; engines without a session area keep a RAM-only queue. */
const queueStore: ErrorReportQueueStore = {
  async load() {
    const area = sessionArea();
    if (!area) return null;
    const items = await area.get(QUEUE_KEY);
    const entries = items[QUEUE_KEY] as PersistedErrorReportQueueEntry[] | undefined;
    return Array.isArray(entries) ? entries : null;
  },
  async save(entries) {
    const area = sessionArea();
    if (!area) return;
    if (entries.length === 0) {
      await area.remove(QUEUE_KEY);
      return;
    }
    await area.set({ [QUEUE_KEY]: [...entries] });
  },
};

const controller = new ErrorReportController({
  transport: {
    async send(envelope: ErrorReportEnvelope): Promise<boolean> {
      const response = await fetch(PRODUCT_ERROR_REPORTS_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      return response.ok;
    },
  },
  now: Date.now,
  sessionStore,
  queueStore,
  host: 'extension',
  facts: buildEnvelopeFacts,
  getEnabled: () => getSetting('telemetry.errorReports'),
  subscribeEnabled: (fn) => void subscribeKey('telemetry.errorReports', fn),
});

/** The own-origin test (law 4): this extension's origin and nothing else. */
const context: ErrorReportContext = {
  isOwnOrigin: (url) => url.startsWith(runtime.getURL('')),
};

let bootResolve: () => void = () => undefined;
/** Resolves once the host has booted this channel AFTER the usage one; every record waits on it. */
const booted = new Promise<void>((resolve) => {
  bootResolve = resolve;
});

/**
 * Boot the channel. Chained by `background.ts` behind the usage
 * channel's settled boot so the shared session is read, never minted
 * twice. Drains whatever the worker's own listeners and early pages
 * recorded before the boot.
 */
export function initErrorReports(): Promise<void> {
  return controller
    .init()
    .then(() => {
      subscribeKey('telemetry.errorReports', () => void controller.flush().catch(() => undefined));
      bootResolve();
      return controller.flush();
    })
    .catch(() => undefined);
}

/**
 * Record one failure — a document's funnel entry or the worker's own —
 * and flush it. Fire-and-forget by law: a failure anywhere in here
 * drops the report silently, never throws at a caller.
 */
export function recordErrorReport(input: ErrorReportInput): void {
  void booted
    .then(() => controller.report(toErrorReport(input, context)))
    .then(() => controller.flush())
    .catch(() => undefined);
}

/** A bridge call's typed failure carries its code (law 5); the message stays here. */
function codeFor(errorName: string): Pick<ErrorReportInput, 'code'> {
  return errorName === 'BridgeError' ? { code: 'bridge-call-failed' } : {};
}

/** UI-document entry (bridge RPC): the funnel's wire entry becomes the converter's input. */
export function recordErrorReportEntry(entry: ErrorReportWireEntry): void {
  recordErrorReport({
    kind: entry.kind,
    process: entry.process,
    ...(entry.surface !== undefined ? { surface: entry.surface } : {}),
    error: entry.error,
    componentStack: entry.componentStack,
    ...codeFor(entry.error.name),
  });
}

/**
 * The worker's own failures (plan §3.3): the document-level listeners
 * the UI funnel registers, on the worker's global. Installed at eval
 * time by `background.ts`; the reports wait for the boot.
 */
export function installServiceWorkerErrorListeners(scope: Pick<Window, 'addEventListener'>): void {
  scope.addEventListener('error', (event) => {
    const error = describeError(event.error ?? event.message);
    recordErrorReport({ kind: 'uncaught-exception', process: 'service-worker', error, ...codeFor(error.name) });
  });
  scope.addEventListener('unhandledrejection', (event) => {
    const error = describeError(event.reason);
    recordErrorReport({ kind: 'unhandled-rejection', process: 'service-worker', error, ...codeFor(error.name) });
  });
}

/** The usage alarm's tick — the retry cadence for anything a dead worker left pending. */
export async function flushErrorReports(): Promise<void> {
  await booted;
  await controller.flush();
}

/** UI-surface entry (bridge RPC): the inspector's "Error reports" section. */
export function readErrorReportSnapshot(): Promise<ErrorReportSnapshotWire> {
  return controller.snapshot();
}
