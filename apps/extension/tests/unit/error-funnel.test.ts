// @vitest-environment jsdom
/**
 * The error funnel — every React-root and document-level failure logs
 * through the host logger with its origin, surface and component
 * stack, then reaches the installed sink; a rejection a host already
 * handled (`preventDefault`) stays out.
 */

import { setHostLogger } from '@openheaders/core/logger';
import {
  describeError,
  formatErrorDetails,
  funnelError,
  installErrorFunnel,
  setErrorFunnelSink,
} from '@openheaders/ui/shared/error-funnel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeLogger() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

describe('error funnel', () => {
  let logger: ReturnType<typeof fakeLogger>;

  beforeEach(() => {
    logger = fakeLogger();
    setHostLogger(logger);
  });

  afterEach(() => {
    setErrorFunnelSink(null);
  });

  it('describes Errors, error-shaped objects and primitives', () => {
    const error = new TypeError('boom');
    expect(describeError(error)).toEqual({ name: 'TypeError', message: 'boom', stack: error.stack ?? null });
    expect(describeError({ name: 'Custom', message: 'm' })).toEqual({ name: 'Custom', message: 'm', stack: null });
    expect(describeError('plain')).toEqual({ name: 'Error', message: 'plain', stack: null });
  });

  it('logs the origin, surface, name, message, stack and component stack', () => {
    const error = new RangeError('too far');
    funnelError({ surface: 'workbench', origin: 'render', error, componentStack: '\n    at Editor' });
    expect(logger.error).toHaveBeenCalledOnce();
    const [scope, line, ...detail] = logger.error.mock.calls[0];
    expect(scope).toBe('ErrorFunnel');
    expect(line).toBe('render on workbench: RangeError: too far');
    expect(detail[0]).toBe(error.stack);
    expect(detail[1]).toContain('at Editor');
  });

  it('hands every entry to the sink, after logging', () => {
    const sink = vi.fn();
    setErrorFunnelSink(sink);
    funnelError({ surface: 'popup', origin: 'boundary', error: new Error('x'), componentStack: null });
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0]).toMatchObject({ surface: 'popup', origin: 'boundary' });
    expect(typeof sink.mock.calls[0][0].at).toBe('number');
  });

  it('a throwing sink never masks the log line', () => {
    setErrorFunnelSink(() => {
      throw new Error('sink broke');
    });
    expect(() =>
      funnelError({ surface: 'popup', origin: 'window-error', error: new Error('x'), componentStack: null }),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('the root options route the three React callbacks by origin', () => {
    const options = installErrorFunnel({ surface: 'devtools-panel' });
    options.onUncaughtError?.(new Error('a'), { componentStack: '\n at A' });
    options.onCaughtError?.(new Error('b'), { componentStack: '\n at B', errorBoundary: undefined });
    options.onRecoverableError?.(new Error('c'), { componentStack: '\n at C' });
    const lines = logger.error.mock.calls.map((call) => call[1]);
    expect(lines).toEqual([
      'render on devtools-panel: Error: a',
      'boundary on devtools-panel: Error: b',
      'recoverable on devtools-panel: Error: c',
    ]);
  });

  it('document error events log once per document, and a handled rejection stays out', () => {
    // The listeners register once per window: the surface is the one
    // the FIRST install in this document named (the root-options test
    // above), and a second install adds no second listener.
    installErrorFunnel({ surface: 'devtools-panel' });
    installErrorFunnel({ surface: 'devtools-panel' });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('from window'), message: 'from window' }));
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0][1]).toBe('window-error on devtools-panel: Error: from window');

    const handled = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(handled, 'reason', { value: new Error('already handled') });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(logger.error).toHaveBeenCalledOnce();

    const unhandled = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(unhandled, 'reason', { value: new Error('nobody caught me') });
    window.dispatchEvent(unhandled);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error.mock.calls[1][1]).toBe('unhandled-rejection on devtools-panel: Error: nobody caught me');
  });

  it('formats copyable details with the surface, the stack and the component stack', () => {
    const error = new Error('details');
    const text = formatErrorDetails(
      { surface: 'workbench', origin: 'render', error, componentStack: '\n    at Tab' },
      '2026.10.2',
    );
    expect(text).toContain('Open Headers 2026.10.2');
    expect(text).toContain('surface: workbench');
    expect(text).toContain('Error: details');
    expect(text).toContain('component stack:');
    expect(text).toContain('at Tab');
  });
});
