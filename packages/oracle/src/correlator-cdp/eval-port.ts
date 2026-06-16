/**
 * CDP eval port — the host-neutral seam for running a rule's dynamic body
 * (user JS) at the network layer (Phase D2b-2). Kept separate from
 * {@link CdpRequestControlPort} because "run user JS" is a distinct concern
 * from "issue a `Fetch.*` command": the eval drives the `Page`/`Runtime`
 * domains and owns a per-frame isolated-world lifecycle, and it travels with
 * the engines to the private split, whereas the control port is pure Fetch
 * transport.
 *
 * The eval COMPUTES ONLY — it returns the value the user fn produced; the
 * visible network effect (fulfill / continue) is still the control port's
 * job. That keeps the Phase-D4a invariant intact: a dynamic rule's
 * modification is network-visible and fires exactly once, like its static
 * sibling — never on both the CDP and in-page planes.
 */

import type { CdpSessionTarget } from './control-port';

/**
 * The JSON-serializable argument handed to the wrapped user fn (e.g. the
 * `{method,url,requestBody}` a `mock`+dynamic `buildResponse` receives). It
 * is passed by value into the isolated world, so every leaf must survive
 * structured-clone serialization.
 */
export type CdpEvalArg = Readonly<Record<string, unknown>>;

/**
 * The outcome of one isolated-world eval. `ok` carries the user fn's return
 * value already serialized to a string IN the isolated world — the wrapper
 * runs the same `typeof o === 'object' ? JSON.stringify : String` the
 * injection path runs in its own realm, so the bytes match. `!ok` means the
 * user fn threw, the eval timed out, or the isolated world was unreachable;
 * the caller then releases the request and does NOT fire (fire = the
 * modification actually ran).
 */
export type CdpEvalOutcome =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

/**
 * Run a wrapped user function in a per-frame isolated world and return its
 * serialized result. `functionDeclaration` is a complete function expression
 * (it defines the user fn, then returns its stringified result over `arg`);
 * `arg` is passed by value. The host adapter maps this to
 * `Page.createIsolatedWorld({frameId})` (cached per `(target, frameId)`,
 * recreated when the cached context goes stale after a navigation) +
 * `Runtime.callFunctionOn` with `awaitPromise` (a transform may be async) and
 * `returnByValue` (the wrapper returns a string).
 *
 * Never rejects: an eval fault is reported as `{ok:false}` so the interceptor
 * releases the paused request cleanly rather than leaving it hung open.
 */
export interface CdpEvalPort {
  /** False when `chrome.debugger` is absent (Firefox / Safari). */
  readonly available: boolean;
  callInIsolatedWorld(
    target: CdpSessionTarget,
    frameId: string,
    functionDeclaration: string,
    arg: CdpEvalArg,
  ): Promise<CdpEvalOutcome>;
}
