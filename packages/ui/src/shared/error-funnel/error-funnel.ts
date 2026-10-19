/**
 * The error funnel — the ONE place a UI document's failures pass
 * through (the crash-and-error-reports plan §3.4).
 *
 * Every React root hands `createRoot` the options this module builds,
 * so an uncaught render error (React 19 unmounts the tree — the bare
 * body, the "grey window"), a boundary-caught error, and a recoverable
 * one all land here with their component stack; the document's
 * `error` and `unhandledrejection` events join them. Each catch does
 * two things, in order: it LOGS through the host logger (the file on
 * desktop, the observability ring on the extension — `console.error`
 * reaches neither), then it hands the entry to the installed sink (the
 * crash-and-error-report channel, a later slice; absent = nothing).
 *
 * Nothing here throws, and nothing here opens a socket: the UI never
 * reports on its own, the host process does.
 */

import { getHostLogger } from '@openheaders/core/logger';
import type { RootOptions } from 'react-dom/client';

/** The document kinds a funnel can run in — stamped on every entry so a log line names its surface. */
export type ErrorFunnelSurface = 'workbench' | 'popup' | 'sidepanel' | 'devtools-panel' | 'web';

/** How the failure reached the funnel. */
export type ErrorFunnelOrigin =
  /** React: no boundary caught it — the tree is gone. */
  | 'render'
  /** React: an error boundary caught it and rendered its fallback. */
  | 'boundary'
  /** React: recovered on its own (a hydration mismatch, a retried render). */
  | 'recoverable'
  /** The document's `error` event (a throw outside React, a failed script). */
  | 'window-error'
  /** The document's `unhandledrejection` event. */
  | 'unhandled-rejection';

export interface FunnelledError {
  surface: ErrorFunnelSurface;
  origin: ErrorFunnelOrigin;
  /** The thrown value as caught — an Error in practice, anything by contract. */
  error: unknown;
  /** React's component stack for the three React origins; null otherwise. */
  componentStack: string | null;
  /** ms since epoch at catch time. */
  at: number;
}

export type ErrorFunnelSink = (entry: FunnelledError) => void;

export interface ErrorDescription {
  name: string;
  message: string;
  stack: string | null;
}

const SCOPE = 'ErrorFunnel';

let sink: ErrorFunnelSink | null = null;

/** Install the report sink (null removes it). The funnel logs with or without one. */
export function setErrorFunnelSink(next: ErrorFunnelSink | null): void {
  sink = next;
}

/** Name, message and stack of any thrown value; a non-Error reads as `Error` with its string form. */
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message, stack: error.stack ?? null };
  }
  if (typeof error === 'object' && error !== null) {
    const named = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof named.name === 'string' && named.name !== '' ? named.name : 'Error',
      message: typeof named.message === 'string' ? named.message : safeString(error),
      stack: typeof named.stack === 'string' ? named.stack : null,
    };
  }
  return { name: 'Error', message: safeString(error), stack: null };
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable]';
  }
}

/**
 * The text behind a fallback's "Copy details" — what a person pastes
 * into a bug report: where, what, the stack, the component stack.
 */
export function formatErrorDetails(entry: Omit<FunnelledError, 'at'> & { at?: number }, version?: string): string {
  const { name, message, stack } = describeError(entry.error);
  const lines = [
    `Open Headers ${version ?? ''}`.trimEnd(),
    `surface: ${entry.surface}`,
    `origin: ${entry.origin}`,
    `at: ${new Date(entry.at ?? Date.now()).toISOString()}`,
    '',
    `${name}: ${message}`,
  ];
  if (stack) lines.push('', stack);
  if (entry.componentStack) lines.push('', 'component stack:', entry.componentStack.trim());
  return lines.join('\n');
}

/**
 * Record one failure: log it, then hand it to the sink. Never throws —
 * a funnel that fails inside a failure path would hide the original.
 */
export function funnelError(entry: Omit<FunnelledError, 'at'>): void {
  const full: FunnelledError = { ...entry, at: Date.now() };
  const { name, message, stack } = describeError(entry.error);
  const line = `${entry.origin} on ${entry.surface}: ${name}: ${message}`;
  const detail: unknown[] = [];
  if (stack) detail.push(stack);
  if (entry.componentStack) detail.push(`component stack:${entry.componentStack}`);
  try {
    const logger = getHostLogger();
    if (logger) logger.error(SCOPE, line, ...detail);
    else console.error(`[${SCOPE}]`, line, ...detail);
  } catch {
    // The log sink itself failed; the sink below still gets the entry.
  }
  try {
    sink?.(full);
  } catch {
    // A sink must never turn one failure into two.
  }
}

const installedDocuments = new WeakSet<Window>();

/**
 * Register the document's global listeners (once per window) and
 * return the `createRoot` options every entry passes. A rejection a
 * host already handled (`preventDefault` — the desktop's RPC-fallback
 * filter) is not a failure and stays out.
 */
export function installErrorFunnel(options: { surface: ErrorFunnelSurface }): RootOptions {
  const { surface } = options;
  if (typeof window !== 'undefined' && !installedDocuments.has(window)) {
    installedDocuments.add(window);
    window.addEventListener('error', (event) => {
      if (event.defaultPrevented) return;
      funnelError({ surface, origin: 'window-error', error: event.error ?? event.message, componentStack: null });
    });
    window.addEventListener('unhandledrejection', (event) => {
      if (event.defaultPrevented) return;
      funnelError({ surface, origin: 'unhandled-rejection', error: event.reason, componentStack: null });
    });
  }
  return {
    onUncaughtError: (error, info) => {
      funnelError({ surface, origin: 'render', error, componentStack: info.componentStack ?? null });
    },
    onCaughtError: (error, info) => {
      funnelError({ surface, origin: 'boundary', error, componentStack: info.componentStack ?? null });
    },
    onRecoverableError: (error, info) => {
      funnelError({ surface, origin: 'recoverable', error, componentStack: info.componentStack ?? null });
    },
  };
}
