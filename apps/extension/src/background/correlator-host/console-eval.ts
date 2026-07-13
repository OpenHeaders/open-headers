/**
 * Console REPL evaluator (JS contexts Phase D) — runs a prompt expression
 * in one JS execution context and records the command echo + outcome into
 * the tab's console stream.
 *
 * The context is addressed by the registry's `${sessionKey}::${contextId}`
 * join key; the session key routes the transport — `target:<targetId>`
 * goes to the browser-target plane, anything else (the root `page` or a
 * kept child session id) rides the tab plane's session sender.
 *
 * Echo semantics: the `command` entry records BEFORE dispatch and the
 * `result` entry after, both through the hub, so the transcript is one
 * ordered feed that interleaves with live output and replays across
 * tool-window switches. Never-throw / never-silent: a transport refusal,
 * command failure, or timeout becomes an error-level `result` entry (5s
 * ceiling, the eval-port precedent).
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { logger } from '@utils/logger';
import {
  evalFailureEntry,
  normalizeEvalCommand,
  normalizeEvalPreviewText,
  normalizeEvalResult,
} from './cdp-normalizers';
import type { RawEvaluateResult } from './cdp-raw-payloads';

/** The tab plane's session sender (`ChromeDebuggerEventSource.sendOnSession`). */
type SessionSender = (
  tabId: number,
  sessionId: string,
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;
/** The browser-target plane's sender (`ChromeBrowserTargetSource.sendOnTarget`). */
type TargetSender = (targetId: string, method: string, params?: Record<string, unknown>) => Promise<unknown>;

export interface ConsoleEvalOptions {
  readonly sendOnSession: SessionSender;
  readonly sendOnTarget: TargetSender;
  /** The console hub's intake — both echo entries record through it. */
  readonly recordEntry: (tabId: number, entry: ConsoleEntry) => void;
  /** Injectable clock (tests); production omits it. */
  readonly now?: () => number;
}

export interface ConsoleEvalExecutor {
  /** Evaluate one expression; resolves once both echo entries are recorded.
   *  `userGesture` mirrors the browser's "Treat code evaluation as user
   *  action" console setting. */
  evaluate(tabId: number, contextKey: string, expression: string, userGesture: boolean): Promise<void>;
  /**
   * Eager evaluation — silent, side-effect-free preview of the prompt text.
   * NEVER records to the console stream; `null` means nothing to show (a
   * refused side-effecting expression, a throw, a timeout, a dead context).
   */
  evaluatePreview(tabId: number, contextKey: string, expression: string): Promise<string | null>;
}

const EVAL_TIMEOUT_MS = 5_000;
/** The engine-side ceiling for an eager-eval preview (the browser's own). */
const PREVIEW_TIMEOUT_MS = 500;
const BROWSER_TARGET_PREFIX = 'target:';

export function createConsoleEval(options: ConsoleEvalOptions): ConsoleEvalExecutor {
  const now = options.now ?? (() => Date.now());

  return {
    async evaluate(tabId: number, contextKey: string, expression: string, userGesture: boolean): Promise<void> {
      options.recordEntry(tabId, normalizeEvalCommand(contextKey, expression, now()));

      const address = parseContextKey(contextKey);
      if (address === null) {
        options.recordEntry(tabId, evalFailureEntry(contextKey, 'Evaluation failed: unknown context', now()));
        return;
      }

      const params: Record<string, unknown> = {
        expression,
        contextId: address.contextId,
        replMode: true,
        includeCommandLineAPI: true,
        generatePreview: true,
        awaitPromise: true,
        userGesture,
        objectGroup: 'oh-console',
      };

      try {
        const send =
          address.targetId !== null
            ? options.sendOnTarget(address.targetId, 'Runtime.evaluate', params)
            : options.sendOnSession(tabId, address.sessionKey, 'Runtime.evaluate', params);
        const raw = (await withTimeout(send)) as RawEvaluateResult;
        options.recordEntry(tabId, normalizeEvalResult(contextKey, raw, now()));
      } catch (err) {
        // Dead context, detached session, command refusal, or the 5s
        // ceiling — surfaced in the transcript, never thrown upward.
        const message = err instanceof Error ? err.message : String(err);
        logger.debug('ConsoleEval', 'Runtime.evaluate failed', { contextKey, error: message });
        options.recordEntry(tabId, evalFailureEntry(contextKey, `Evaluation failed: ${message}`, now()));
      }
    },

    async evaluatePreview(tabId: number, contextKey: string, expression: string): Promise<string | null> {
      const address = parseContextKey(contextKey);
      if (address === null) return null;

      // The browser's eager-eval params: side-effect-free or refused,
      // silent (a throw must not surface as an exception event), short
      // engine timeout, breakpoints disabled — a preview must never pause.
      const params: Record<string, unknown> = {
        expression,
        contextId: address.contextId,
        replMode: true,
        includeCommandLineAPI: true,
        generatePreview: true,
        throwOnSideEffect: true,
        silent: true,
        disableBreaks: true,
        timeout: PREVIEW_TIMEOUT_MS,
        objectGroup: 'oh-console',
      };

      try {
        const send =
          address.targetId !== null
            ? options.sendOnTarget(address.targetId, 'Runtime.evaluate', params)
            : options.sendOnSession(tabId, address.sessionKey, 'Runtime.evaluate', params);
        const raw = (await withTimeout(send)) as RawEvaluateResult;
        return normalizeEvalPreviewText(raw);
      } catch {
        // A preview is best-effort by contract — refusals stay quiet.
        return null;
      }
    },
  };
}

interface ContextAddress {
  readonly sessionKey: string;
  /** Set when the session is a browser-scoped target (`target:<id>`). */
  readonly targetId: string | null;
  readonly contextId: number;
}

/**
 * Split the registry join key on its LAST `::` — the numeric context id is
 * the suffix; everything before is the session key (whose own shape is
 * opaque here beyond the `target:` routing prefix).
 */
function parseContextKey(contextKey: string): ContextAddress | null {
  const split = contextKey.lastIndexOf('::');
  if (split <= 0) return null;
  const sessionKey = contextKey.slice(0, split);
  const contextId = Number(contextKey.slice(split + 2));
  if (!Number.isInteger(contextId) || contextId <= 0) return null;
  const targetId = sessionKey.startsWith(BROWSER_TARGET_PREFIX) ? sessionKey.slice(BROWSER_TARGET_PREFIX.length) : null;
  return { sessionKey, targetId, contextId };
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('evaluation timed out')), EVAL_TIMEOUT_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
