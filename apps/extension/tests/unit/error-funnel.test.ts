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
  markErrorUnit,
  setErrorFunnelSink,
  stackFrames,
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

  it('logs the origin, surface, name, message, the frames and the component stack — the header once', () => {
    const error = new RangeError('too far');
    funnelError({ surface: 'workbench', origin: 'render', error, componentStack: '\n    at Editor' });
    expect(logger.error).toHaveBeenCalledOnce();
    const [scope, line, ...detail] = logger.error.mock.calls[0];
    expect(scope).toBe('ErrorFunnel');
    expect(line).toBe('render on workbench: RangeError: too far');
    // The detail carries the frames; the line already carried the header.
    const frames = detail[0] as string;
    expect(frames.startsWith('RangeError: too far')).toBe(false);
    expect(`RangeError: too far\n${frames}`).toBe(error.stack);
    expect(detail[1]).toContain('at Editor');
  });

  it('keeps a stack that starts otherwise whole, and adds no detail for a header-only stack', () => {
    funnelError({
      surface: 'popup',
      origin: 'window-error',
      error: { name: 'DOMException', message: 'm', stack: '    at somewhere' },
      componentStack: null,
    });
    expect(logger.error.mock.calls[0].slice(1)).toEqual(['window-error on popup: DOMException: m', '    at somewhere']);
    funnelError({
      surface: 'popup',
      origin: 'window-error',
      error: { name: 'Error', message: 'x', stack: 'Error: x' },
      componentStack: null,
    });
    expect(logger.error.mock.calls[1].slice(1)).toEqual(['window-error on popup: Error: x']);
    expect(stackFrames('Error: x\n    at a\n    at b', 'Error: x')).toBe('    at a\n    at b');
  });

  it('hands every entry to the sink, after logging', () => {
    const sink = vi.fn();
    setErrorFunnelSink(sink);
    funnelError({ surface: 'popup', origin: 'boundary', error: new Error('x'), componentStack: null });
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0]).toMatchObject({ surface: 'popup', origin: 'boundary' });
    expect(typeof sink.mock.calls[0][0].at).toBe('number');
  });

  it('carries the unit a boundary marked on the error object, and none for an unmarked or primitive throw', () => {
    const sink = vi.fn();
    setErrorFunnelSink(sink);
    const marked = new Error('in a tab');
    markErrorUnit(marked, { kind: 'tab', mode: 'request-edit' });
    funnelError({ surface: 'workbench', origin: 'boundary', error: marked, componentStack: null });
    expect(sink.mock.calls[0][0].unit).toEqual({ kind: 'tab', mode: 'request-edit' });
    funnelError({ surface: 'workbench', origin: 'render', error: new Error('root'), componentStack: null });
    expect('unit' in sink.mock.calls[1][0]).toBe(false);
    markErrorUnit('a string', { kind: 'window', id: 'git' });
    funnelError({ surface: 'workbench', origin: 'window-error', error: 'a string', componentStack: null });
    expect('unit' in sink.mock.calls[2][0]).toBe(false);
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
