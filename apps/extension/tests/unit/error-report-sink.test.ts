// @vitest-environment jsdom
/**
 * The error-report sink (the error reports plan §3.4): a funnelled
 * failure becomes one `errorReportRecord` call carrying the document's
 * process kind, the kind the origin folds onto, the unit's surface when
 * it is a vocabulary member, and the described error — the host
 * converts, the document never does. The served web app never reports.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setHostLogger } from '@openheaders/core/logger';
import {
  funnelError,
  installErrorReportSink,
  markErrorUnit,
  setErrorFunnelSink,
  toErrorReportWireEntry,
} from '@openheaders/ui/shared/error-funnel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeBridge() {
  const call = vi.fn(async () => ({ success: true }));
  const bridge = { call } as unknown as HostBridge;
  return { bridge, call };
}

describe('toErrorReportWireEntry', () => {
  it('maps the document kind onto the process and the origin onto the kind', () => {
    const error = new TypeError('boom');
    expect(
      toErrorReportWireEntry({ surface: 'workbench', origin: 'render', error, componentStack: '\n at X' }),
    ).toEqual({
      process: 'renderer',
      kind: 'render-error',
      error: { name: 'TypeError', message: 'boom', stack: error.stack ?? null },
      componentStack: '\n at X',
    });
    expect(
      toErrorReportWireEntry({ surface: 'popup', origin: 'window-error', error: 'plain', componentStack: null }),
    ).toMatchObject({ process: 'popup', kind: 'uncaught-exception', error: { name: 'Error', message: 'plain' } });
    expect(
      toErrorReportWireEntry({ surface: 'sidepanel', origin: 'unhandled-rejection', error, componentStack: null }),
    ).toMatchObject({ process: 'sidepanel', kind: 'unhandled-rejection' });
    expect(
      toErrorReportWireEntry({ surface: 'devtools-panel', origin: 'boundary', error, componentStack: null }),
    ).toMatchObject({ process: 'devtools-panel', kind: 'render-error' });
    expect(
      toErrorReportWireEntry({ surface: 'workbench', origin: 'recoverable', error, componentStack: null }),
    ).toMatchObject({ kind: 'render-error' });
  });

  it('names the surface from a unit only when it is a vocabulary member', () => {
    const error = new Error('x');
    const base = { surface: 'workbench', origin: 'boundary', error, componentStack: null } as const;
    expect(toErrorReportWireEntry({ ...base, unit: { kind: 'tab', mode: 'request-edit' } })).toMatchObject({
      surface: 'request-edit',
    });
    expect(toErrorReportWireEntry({ ...base, unit: { kind: 'window', id: 'http-rules' } })).toMatchObject({
      surface: 'http-rules',
    });
    const unknown = toErrorReportWireEntry({ ...base, unit: { kind: 'tab', mode: 'a-mode-the-schema-never-learned' } });
    expect(unknown).not.toBeNull();
    expect('surface' in (unknown ?? {})).toBe(false);
    const none = toErrorReportWireEntry(base);
    expect('surface' in (none ?? {})).toBe(false);
  });

  it('the served web app has no process member and reports nothing', () => {
    expect(
      toErrorReportWireEntry({ surface: 'web', origin: 'render', error: new Error('x'), componentStack: null }),
    ).toBe(null);
  });
});

describe('installErrorReportSink', () => {
  beforeEach(() => {
    setHostLogger({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() });
  });

  afterEach(() => {
    setErrorFunnelSink(null);
  });

  // First, before any test installs a bridge: the module holds no reset.
  it('without a host bridge the entry is logged and goes nowhere', () => {
    installErrorReportSink();
    expect(() =>
      funnelError({ surface: 'popup', origin: 'window-error', error: new Error('x'), componentStack: null }),
    ).not.toThrow();
  });

  it('sends every funnelled failure as one errorReportRecord call, the unit a boundary marked included', () => {
    const { bridge, call } = fakeBridge();
    setHostBridge(bridge);
    installErrorReportSink();
    const error = new RangeError('too far');
    markErrorUnit(error, { kind: 'window', id: 'variables' });
    funnelError({ surface: 'workbench', origin: 'boundary', error, componentStack: null });
    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0]).toEqual([
      'errorReportRecord',
      {
        entry: {
          process: 'renderer',
          kind: 'render-error',
          surface: 'variables',
          error: { name: 'RangeError', message: 'too far', stack: error.stack ?? null },
          componentStack: null,
        },
      },
    ]);
  });

  it('a rejected call is dropped — never a second failure, never a retry', async () => {
    const call = vi.fn(async () => {
      throw new Error('no handler');
    });
    setHostBridge({ call } as unknown as HostBridge);
    installErrorReportSink();
    expect(() =>
      funnelError({ surface: 'popup', origin: 'window-error', error: new Error('x'), componentStack: null }),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(call).toHaveBeenCalledOnce();
  });
});
