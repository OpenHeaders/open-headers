// @vitest-environment jsdom
/**
 * The shared telemetry inspector (the telemetry plan §6; the error
 * reports plan §4.2 law 8): one modal, two sections read over their
 * one-shot RPCs, opened on the section the row is about, every entry
 * rendered exactly as it travels on the wire — sent or suppressed.
 */

import type { ErrorReportSnapshotWire, HostBridge, ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { setHostBridge } from '@openheaders/core/bridge';
import TelemetryInspectorModal from '@openheaders/ui/workbench/settings/components/telemetry-inspector-modal';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const events: ProductTelemetrySnapshot = {
  sessionId: 'c0ffee00c0ffee00c0ffee00c0ffee00',
  installId: null,
  enabled: true,
  entries: [{ event: { name: 'session_start' }, at: 1_760_000_000_000, disposition: 'sent' }],
};

const reports: ErrorReportSnapshotWire = {
  sessionId: 'c0ffee00c0ffee00c0ffee00c0ffee00',
  enabled: false,
  entries: [
    {
      report: {
        kind: 'render-error',
        process: 'renderer',
        surface: 'request-edit',
        errorName: 'TypeError',
        template: 'cannot-read-property',
        frames: [{ file: 'index-abc123.js', line: 1, col: 48213, fn: 'render' }],
        fingerprint: '0123456789abcdef',
        count: 2,
      },
      at: 1_760_000_001_000,
      disposition: 'suppressed',
    },
  ],
};

beforeAll(() => {
  // antd Tabs measures its ink bar; jsdom ships no ResizeObserver.
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  const call = vi.fn(async (type: string) => (type === 'errorReportRead' ? reports : events));
  setHostBridge({ call } as unknown as HostBridge);
});

afterEach(cleanup);

describe('TelemetryInspectorModal', () => {
  it('opens on the error-reports section and renders each report byte for byte with its disposition', async () => {
    render(<TelemetryInspectorModal open section="reports" onClose={() => {}} />);
    expect(screen.getByText('Telemetry this session')).toBeTruthy();
    expect(screen.getByText('Error reports')).toBeTruthy();
    const row = await screen.findByTestId('error-report-entry');
    expect(row.textContent).toContain(JSON.stringify(reports.entries[0].report));
    expect(row.textContent).toContain('suppressed');
    expect(screen.getByText(`Session ${reports.sessionId} — reporting is off`)).toBeTruthy();
  });

  it('opens on the usage-events section when the usage row asks', async () => {
    render(<TelemetryInspectorModal open section="events" onClose={() => {}} />);
    const row = await screen.findByTestId('product-telemetry-event');
    expect(row.textContent).toContain(JSON.stringify(events.entries[0].event));
    expect(screen.getByText(`Session ${events.sessionId} — counting is on`)).toBeTruthy();
  });
});
