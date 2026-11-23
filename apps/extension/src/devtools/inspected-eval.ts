/**
 * `inspectedWindow.eval` behind one callback shape.
 *
 * Chromium and Firefox answer with two arguments, `(result,
 * exceptionInfo)`. Safari answers with ONE argument, the pair as an array
 * (`[result, exceptionInfo]`). The devtools page's probes evaluate to a
 * plain object, never an array, so an array in first position is always
 * that pair.
 *
 * A host that cannot evaluate at all — Safari while the inspected page is
 * between documents — reports through `runtime.lastError` instead of an
 * answer. Reading it marks it checked; the caller sees a failed sample.
 */

export type EvalAnswer<T> = readonly [result: T | null, exceptionInfo: unknown];

/** Read a host's eval callback arguments as `[result, exceptionInfo]`. */
export function readEvalAnswer<T>(first: unknown, second?: unknown): EvalAnswer<T> {
  if (Array.isArray(first)) return [(first[0] ?? null) as T | null, first[1]];
  return [(first ?? null) as T | null, second];
}

/** Evaluate `expression` in the inspected window; `callback` gets `(result, exceptionInfo)` on every host. */
export function evalInInspectedWindow<T>(
  expression: string,
  callback: (result: T | null, exceptionInfo?: unknown) => void,
): void {
  chrome.devtools.inspectedWindow.eval(expression, (first: unknown, second?: unknown) => {
    const hostError = chrome.runtime.lastError;
    if (hostError) {
      callback(null, hostError);
      return;
    }
    const [result, exceptionInfo] = readEvalAnswer<T>(first, second);
    callback(result, exceptionInfo);
  });
}
