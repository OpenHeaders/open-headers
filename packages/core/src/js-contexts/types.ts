/**
 * JavaScript contexts — engine→consumer update model.
 *
 * Sibling of `@openheaders/core/console-stream`. The engine tracks the live
 * set of JavaScript execution contexts on a CDP-attached tab — top frame,
 * iframes, dedicated workers, isolated worlds, and (later) browser-scoped
 * targets — from the `Runtime.executionContextCreated` / `Destroyed` /
 * `executionContextsCleared` events the standing `Runtime.enable` already
 * delivers, and fans the set as replace-semantics updates.
 *
 * Unlike the append-only console stream this is LIVE state, not a log: a
 * `context-added` for an existing key replaces it, a `context-removed`
 * deletes it, and `tab-cleared` empties the tab (CDP detach or tab close).
 * Replay on attach re-emits the live set as `context-added` updates,
 * identical shape to live, so the consumer reducer has no replay branch.
 */

/**
 * Where a context lives — drives grouping, depth, and iconography in the
 * selector. `page` is the tab's root target; `iframe` / `worker` are kept
 * flattened child targets; the service-worker / shared-worker kinds arrive
 * with the browser-scoped target plane (Phase B).
 */
export type JsContextTargetKind = 'page' | 'iframe' | 'worker' | 'service-worker' | 'shared-worker';

/**
 * One live JavaScript execution context on a tab. Host-neutral + JSON-safe
 * (it crosses the runtime port to the panel). Identity is `contextKey`;
 * routing is by `tabId` at the envelope level ({@link JsContextUpdate}).
 */
export interface JsContext {
  /** `${sessionKey}::${contextId}` — the join key console entries carry. */
  readonly contextKey: string;
  readonly origin: string;
  /** The browser-provided label (`''` when unnamed). */
  readonly name: string;
  /** Main world of its frame/target. */
  readonly isDefault: boolean;
  readonly frameId?: string;
  /**
   * The context lives in the tab's outermost frame — minted by the engine
   * (only it knows the main-frame id), present only when true. The selector's
   * `top` is the context with `isTopFrame && isDefault`, and an isolated
   * world of the top frame indents one level instead of two.
   */
  readonly isTopFrame?: boolean;
  readonly targetKind: JsContextTargetKind;
  /** Aux world type from the wire: `default` | `isolated` | `worker`. Kept
   *  open (not a closed union) so a new world type flows through without a
   *  protocol change. */
  readonly worldType: string;
}

export type JsContextUpdate =
  | { kind: 'context-added'; tabId: number; context: JsContext }
  | { kind: 'context-removed'; tabId: number; contextKey: string }
  | { kind: 'tab-cleared'; tabId: number };

/**
 * Mint the join key for a context: the session it lives on plus the
 * browser's per-session `executionContextId`. The id is unique only within
 * its session (and reused after navigation), so the session key is part of
 * identity — never treat the numeric id as global.
 */
export function jsContextKey(sessionKey: string, contextId: number): string {
  return `${sessionKey}::${contextId}`;
}

/** Prefix that {@link jsContextKey} stamps for a session — every context of
 *  the session matches `startsWith`; used to drop a whole session's set when
 *  it detaches or clears. */
export function jsContextSessionPrefix(sessionKey: string): string {
  return `${sessionKey}::`;
}
