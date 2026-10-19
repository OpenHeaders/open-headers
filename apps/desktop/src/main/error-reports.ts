/**
 * Crash-and-error-report host adapter for the desktop main process
 * (the error reports plan §4, §5) — the twin of the usage adapter
 * beside it. One `ErrorReportController` lives here on the SAME
 * in-memory session store the usage controller booted with (one
 * session id per launch; the host inits the two in sequence, never
 * concurrently), behind the `telemetry.errorReports` gate read from
 * the `oh.settings.user` blob exactly like `telemetry.enabled`
 * (default on, absent key = on, subscribed live).
 *
 * Inputs reach it from two sides: the renderer's funnel over the
 * `errorReportRecord` RPC (the renderer never dials — this process
 * owns the transport), and ring 0's own observations through the
 * bootstrap sink (`bootstrap/error-report-sink`). Every input runs
 * `toErrorReport` here with this host's own-origin test (law 4): a
 * frame is ours when its file sits under the app path — the asar in
 * a packaged build, `apps/desktop` in dev — or comes from the dev
 * server; Node internals, a user script, anything else is `external`.
 *
 * A report flushes as soon as it is recorded (a crash is not a thing
 * to batch for a minute); the interval is the retry cadence and the
 * quit flush the last chance.
 */

import type { ErrorReportSnapshotWire } from '@openheaders/core/bridge';
import type { HostStorage } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import {
  type ErrorReportContext,
  ErrorReportController,
  type ErrorReportEnvelope,
  type ErrorReportInput,
  type ErrorReportTransport,
  PRODUCT_ERROR_REPORTS_ENDPOINT,
  type ProductTelemetrySessionStore,
  type TelemetryEnvelopeFacts,
  toErrorReport,
} from '@openheaders/core/telemetry';
import { setErrorReportSink } from './bootstrap/error-report-sink';

const FLUSH_PERIOD_MS = 60_000;

export interface ErrorReportsHostDeps {
  storage: Pick<HostStorage, 'get' | 'subscribe'>;
  /** The usage channel's session store — the one session id both channels stamp. */
  sessionStore: ProductTelemetrySessionStore;
  /** The usage envelope's per-process facts, read at flush time. */
  facts(): TelemetryEnvelopeFacts;
  /** `app.getAppPath()` — the asar when packaged, `apps/desktop` in dev; every frame under it is ours. */
  appPath: string;
  /** `process.env.ELECTRON_RENDERER_URL` — the dev server's origin; absent on a packaged build. */
  rendererDevUrl?: string;
  /** Test seams; production uses the fetch transport + wall clock. */
  transport?: ErrorReportTransport;
  now?: () => number;
}

export interface ErrorReportsHandle {
  /** Record one failure — the renderer's funnel entry or a ring-0 observation — and flush it. */
  record(input: ErrorReportInput): void;
  /** The inspector's "Error reports" section (bridge RPC). */
  snapshot(): Promise<ErrorReportSnapshotWire>;
  flush(): Promise<void>;
  /** Stop the cadence, detach the ring-0 sink and fire one best-effort final flush. */
  dispose(): void;
}

function readErrorReportsEnabled(values: Record<string, unknown> | undefined): boolean {
  return values?.['telemetry.errorReports'] !== false;
}

function normalizePath(path: string): string {
  const forward = path.replace(/\\/g, '/');
  // A `file:` URL's pathname carries a Windows drive as `/C:/…`.
  return /^\/[A-Za-z]:\//.test(forward) ? forward.slice(1) : forward;
}

/**
 * The own-origin test (law 4) for this process and its renderer: a
 * `file:` URL or a bare path (main's CommonJS frames carry no scheme)
 * under the app path, or any URL on the dev server's origin. A frame
 * that parses as neither — `node:internal/…`, a `chrome-extension://`
 * script, a user script's `eval` — is foreign.
 */
export function createOwnOriginTest(appPath: string, rendererDevUrl?: string): ErrorReportContext['isOwnOrigin'] {
  const root = normalizePath(appPath).replace(/\/+$/, '');
  let devOrigin: string | null = null;
  if (rendererDevUrl) {
    try {
      devOrigin = new URL(rendererDevUrl).origin;
    } catch {
      devOrigin = null;
    }
  }
  return (url) => {
    if (devOrigin !== null && url.startsWith(`${devOrigin}/`)) return true;
    let path: string;
    if (url.startsWith('file:')) {
      try {
        path = decodeURIComponent(new URL(url).pathname);
      } catch {
        return false;
      }
    } else if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) && !/^[A-Za-z]:[\\/]/.test(url)) {
      // Any other scheme (`node:`, `chrome-extension:`, `blob:`) is foreign; a Windows drive is not a scheme.
      return false;
    } else {
      path = url;
    }
    const normalized = normalizePath(path);
    return normalized === root || normalized.startsWith(`${root}/`);
  };
}

const fetchTransport: ErrorReportTransport = {
  async send(envelope: ErrorReportEnvelope): Promise<boolean> {
    const response = await fetch(PRODUCT_ERROR_REPORTS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return response.ok;
  },
};

export async function installErrorReports(deps: ErrorReportsHostDeps): Promise<ErrorReportsHandle> {
  let enabled = readErrorReportsEnabled(await deps.storage.get(OH.settingsUser));
  const enabledListeners: Array<() => void> = [];
  deps.storage.subscribe(OH.settingsUser, (next) => {
    enabled = readErrorReportsEnabled(next);
    for (const fn of enabledListeners) fn();
  });

  const controller = new ErrorReportController({
    transport: deps.transport ?? fetchTransport,
    now: deps.now ?? Date.now,
    sessionStore: deps.sessionStore,
    host: 'desktop',
    facts: deps.facts,
    getEnabled: () => enabled,
    subscribeEnabled: (fn) => enabledListeners.push(fn),
  });
  await controller.init();
  // Turning the switch on mid-session delivers what queued since.
  enabledListeners.push(() => void controller.flush());

  const context: ErrorReportContext = { isOwnOrigin: createOwnOriginTest(deps.appPath, deps.rendererDevUrl) };
  const record = (input: ErrorReportInput): void => {
    void controller
      .report(toErrorReport(input, context))
      .then(() => controller.flush())
      .catch(() => undefined);
  };
  // Ring 0's observations, the ones buffered since boot first.
  setErrorReportSink(record);

  // The cadence must never keep a quitting app's event loop alive.
  const timer = setInterval(() => void controller.flush(), FLUSH_PERIOD_MS);
  timer.unref();

  return {
    record,
    snapshot: () => controller.snapshot(),
    flush: () => controller.flush(),
    dispose: () => {
      clearInterval(timer);
      setErrorReportSink(null);
      void controller.flush();
    },
  };
}
