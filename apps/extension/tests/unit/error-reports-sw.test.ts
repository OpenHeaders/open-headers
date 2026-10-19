/**
 * The service worker's crash-and-error-report channel (the error
 * reports plan §4, §5): it boots behind the usage channel on the SAME
 * session store (one session id on both envelopes), names only frames
 * under this extension's own origin, maps the bridge's typed failure
 * onto its code, persists the pending queue in the session area, and
 * turns the worker's own `error` / `unhandledrejection` events into
 * reports.
 */

import type { ErrorReportEnvelope, TelemetryEnvelope } from '@openheaders/core/telemetry';
import { PRODUCT_ERROR_REPORTS_ENDPOINT, PRODUCT_TELEMETRY_ENDPOINT } from '@openheaders/core/telemetry';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => {
    if (key === 'telemetry.enabled' || key === 'telemetry.errorReports') return true;
    if (key === 'general.language') return 'en';
    return undefined;
  }),
  subscribeKey: vi.fn(() => () => {}),
}));

const OWN = 'chrome-extension://test-id/';

/** A stateful, promise-returning storage area — the queue stores' and the identity's substrate. */
function statefulArea(area: chrome.storage.StorageArea): Map<string, unknown> {
  const items = new Map<string, unknown>();
  (area.get as ReturnType<typeof vi.fn>).mockImplementation(async (keys?: string | string[] | null) => {
    const wanted = keys === undefined || keys === null ? [...items.keys()] : Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(wanted.filter((key) => items.has(key)).map((key) => [key, items.get(key)]));
  });
  (area.set as ReturnType<typeof vi.fn>).mockImplementation(async (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) items.set(key, value);
  });
  (area.remove as ReturnType<typeof vi.fn>).mockImplementation(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) items.delete(key);
  });
  return items;
}

/** `chrome.storage.session` (the session store, the error queue) and `chrome.storage.local` (the usage identity). */
function statefulStorage(): Map<string, unknown> {
  statefulArea(chrome.storage.local);
  return statefulArea(chrome.storage.session);
}

function stubFetch() {
  const posted: Array<{ url: string; body: TelemetryEnvelope | ErrorReportEnvelope }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { body?: string }) => {
      posted.push({ url, body: JSON.parse(init?.body ?? '{}') });
      return { ok: true };
    }),
  );
  return posted;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadModules() {
  const usage = await import('../../src/background/modules/product-telemetry');
  const errors = await import('../../src/background/modules/error-reports');
  return { usage, errors };
}

beforeEach(() => {
  vi.resetModules();
  vi.mocked(chrome.runtime.getURL).mockImplementation((path: string) => `${OWN}${path}`);
});

describe('the service worker error-report channel', () => {
  it('boots behind the usage channel on one session id, and names only own-origin frames', async () => {
    statefulStorage();
    const posted = stubFetch();
    const { usage, errors } = await loadModules();
    await usage.initProductTelemetry().then(errors.initErrorReports);
    const stack = [
      'TypeError: x is not a function',
      `    at run (${OWN}assets/workbench-abc123.js:1:48213)`,
      '    at https://openheaders.io/page.js:3:4',
      `    at next (${OWN}assets/workbench-abc123.js:1:99)`,
    ].join('\n');
    errors.recordErrorReportEntry({
      process: 'renderer',
      kind: 'uncaught-exception',
      error: { name: 'TypeError', message: 'x is not a function', stack },
      componentStack: null,
    });
    await settle();
    const usageEnvelope = posted.find((call) => call.url === PRODUCT_TELEMETRY_ENDPOINT)?.body as TelemetryEnvelope;
    const errorEnvelope = posted.find((call) => call.url === PRODUCT_ERROR_REPORTS_ENDPOINT)
      ?.body as ErrorReportEnvelope;
    expect(usageEnvelope).toBeDefined();
    expect(errorEnvelope).toBeDefined();
    expect(errorEnvelope.sessionId).toBe(usageEnvelope.sessionId);
    expect(errorEnvelope.host).toBe('extension');
    expect('installId' in errorEnvelope).toBe(false);
    expect(errorEnvelope.reports[0]).toMatchObject({
      kind: 'uncaught-exception',
      process: 'renderer',
      errorName: 'TypeError',
      template: 'not-a-function',
    });
    expect(errorEnvelope.reports[0].frames).toEqual([
      { file: 'workbench-abc123.js', line: 1, col: 48213, fn: 'run' },
      { external: true },
      { file: 'workbench-abc123.js', line: 1, col: 99, fn: 'next' },
    ]);
    expect(JSON.stringify(errorEnvelope)).not.toContain('openheaders.io');
  });

  it("the bridge's typed failure carries its code, from a page and from the worker's own listeners", async () => {
    statefulStorage();
    const posted = stubFetch();
    const { usage, errors } = await loadModules();
    await usage.initProductTelemetry().then(errors.initErrorReports);
    const listeners = new Map<string, (event: unknown) => void>();
    const scope = {
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    } as unknown as Pick<Window, 'addEventListener'>;
    errors.installServiceWorkerErrorListeners(scope);
    const bridgeError = new Error('bridge(ruleList) failed: no response');
    bridgeError.name = 'BridgeError';
    listeners.get('unhandledrejection')?.({ reason: bridgeError });
    listeners.get('error')?.({ error: new RangeError('Maximum call stack size exceeded'), message: '' });
    // A different kind, or it would fold into the first: the fingerprint ignores the process.
    errors.recordErrorReportEntry({
      process: 'popup',
      kind: 'uncaught-exception',
      error: { name: 'BridgeError', message: 'bridge(x) failed: y', stack: null },
      componentStack: null,
    });
    await settle();
    const reports = posted
      .filter((call) => call.url === PRODUCT_ERROR_REPORTS_ENDPOINT)
      .flatMap((call) => (call.body as ErrorReportEnvelope).reports);
    expect(reports.map((report) => [report.kind, report.process, report.code ?? null, report.template])).toEqual([
      ['unhandled-rejection', 'service-worker', 'bridge-call-failed', 'other'],
      ['uncaught-exception', 'service-worker', null, 'max-call-stack'],
      ['uncaught-exception', 'popup', 'bridge-call-failed', 'other'],
    ]);
  });

  it('a report recorded before the boot waits for it, and the pending queue lives in the session area', async () => {
    const items = statefulStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );
    const { usage, errors } = await loadModules();
    errors.recordErrorReport({ kind: 'unhandled-rejection', process: 'service-worker' });
    await settle();
    expect(items.has('oh.errorReports.queue')).toBe(false);
    await usage.initProductTelemetry().then(errors.initErrorReports);
    await settle();
    // The transport refused, so the report is still pending — in the session area, for the next worker life.
    const queued = items.get('oh.errorReports.queue') as Array<{ report: { kind: string } }>;
    expect(queued).toHaveLength(1);
    expect(queued[0].report.kind).toBe('unhandled-rejection');
    const snapshot = await errors.readErrorReportSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.entries.map((entry) => entry.disposition)).toEqual(['pending']);
  });
});
