/**
 * createHoverPopoverHost — factory for "single shared popover" hosts.
 *
 * Mounts ONE popover instance at an app root. Hover / click anywhere
 * in the tree calls `open(state)` through the returned context API;
 * the host owns the open-state, the close-grace timer, and the
 * popover's lifecycle. Closing unmounts the popover so its own state
 * resets implicitly — no manual reset effects.
 *
 * Both the variable hover popover and the rule hover popover share
 * this shape (header pill / editable body / Save / dismissal); the
 * factory captures it once so each consumer only specializes:
 *   - the state shape (`TState extends BaseState`)
 *   - identity for `key` (one fresh mount per session)
 *   - the popover body component
 *
 * Outside-click semantics (hover-out → click-out switch on first
 * inside interaction, Escape always closes) match `useDismiss` —
 * passive readers can still mouse-away without committing, but anyone
 * who clicks into the popover gets a stable surface they can lose
 * focus on without losing their edit. A `pinned` open skips the switch —
 * born committed, for click-to-open editors (vs hover triggers).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useDismiss } from './use-dismiss';

export interface HoverPopoverBaseState {
  anchorEl: HTMLElement;
}

export interface HoverPopoverOpenOptions {
  /** Born-committed session: dismissed only by outside-click / Escape /
   *  save, never by hover-out. Use for click-to-open editors so a
   *  mouse-leave before the first inside-click can't close the popover. */
  pinned?: boolean;
  /** Called once when THIS session ends (unmount), however it was
   *  dismissed (Escape / save / outside-click). The opener uses it to
   *  restore its own focus/caret/derived UI — only it knows that context.
   *  Runs after the close animation, outside any React commit. */
  onClose?: () => void;
}

export interface HoverPopoverApi<TState extends HoverPopoverBaseState> {
  /** Open the popover. Idempotent — a second call updates the state in
   *  place. Pass `{ pinned: true }` for click-to-open editors; omit for
   *  hover triggers (which stay hover-dismissed until clicked inside). */
  open(state: TState, opts?: HoverPopoverOpenOptions): void;
  /** Schedule a close after the grace period. Lets the pointer travel
   *  from the anchor into the popover body without flicker. When
   *  called with a `relatedTarget` (the element the cursor entered),
   *  the host checks it against `insideSelectors` and skips the close
   *  if the cursor moved into a child overlay (e.g. a portal-mounted
   *  suggestion popover or a nested hover popover). */
  scheduleClose(relatedTarget?: EventTarget | null): void;
  /** Cancel a pending close — call when the pointer enters the popover. */
  cancelClose(): void;
  /** Close immediately (Escape, save success, manual dismiss). */
  closeNow(): void;
}

export interface HoverPopoverBodyProps<TState extends HoverPopoverBaseState> {
  state: TState;
  onClose: () => void;
  onMouseEnter: () => void;
  /** React MouseEvent — body forwards as-is so the host can inspect
   *  `relatedTarget` and skip closing when the cursor moves into a
   *  child overlay (portal-mounted suggestion popover, nested
   *  variable popover hovered from inside the rule popover, …). */
  onMouseLeave: (e: React.MouseEvent) => void;
  /** Host-controlled visibility flag. False during the close
   *  animation — the body keeps its DOM mounted but should fade
   *  to opacity 0 so the close transition mirrors the open one.
   *  Bodies AND-combine this with their own `measured` flag from
   *  `usePopoverPlacement`: shown only when both are true. */
  visible: boolean;
}

export interface HoverPopoverHostConfig<TState extends HoverPopoverBaseState> {
  /** Identity per open session — drives React `key` so each new open
   *  gets a fresh mount and resets local state implicitly. */
  identity(state: TState): string;
  /** Stable selectors that count as "inside" for outside-click dismissal.
   *  The popover root itself should be marked with the matching
   *  `data-…-popover-root` attribute and listed here. */
  insideSelectors: ReadonlyArray<string>;
  /** Hover-out close grace in ms. */
  closeGraceMs?: number;
  /** Close-animation duration in ms. The host keeps the body mounted
   *  for this long after a close request so the body's CSS transition
   *  on `opacity` / `transform` runs to completion before the popover
   *  unmounts. Should match the `transition` value in the body's
   *  styles. Default 120ms. */
  closeAnimMs?: number;
  /** Popover body component — receives state + lifecycle callbacks. */
  Body: React.ComponentType<HoverPopoverBodyProps<TState>>;
}

export interface HoverPopoverHost<TState extends HoverPopoverBaseState> {
  Provider: React.FC<{ children: React.ReactNode }>;
  useApi(): HoverPopoverApi<TState>;
}

const DEFAULT_GRACE_MS = 150;
const DEFAULT_CLOSE_ANIM_MS = 120;

export function createHoverPopoverHost<TState extends HoverPopoverBaseState>(
  config: HoverPopoverHostConfig<TState>,
): HoverPopoverHost<TState> {
  const {
    identity,
    insideSelectors,
    closeGraceMs = DEFAULT_GRACE_MS,
    closeAnimMs = DEFAULT_CLOSE_ANIM_MS,
    Body,
  } = config;

  const noopApi: HoverPopoverApi<TState> = {
    open: () => {},
    scheduleClose: () => {},
    cancelClose: () => {},
    closeNow: () => {},
  };

  const Context = createContext<HoverPopoverApi<TState>>(noopApi);

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<TState | null>(null);
    // Once the user clicks anywhere within the popover surface (the
    // dialog itself or any of its portal-mounted overlays), dismissal
    // switches from hover-out to click-out — they stay open until
    // Escape, click-outside, or save. Passive readers aren't surprised
    // by a close on stray clicks because the switch only flips on a
    // click-into.
    //
    // `interactedRef` is the source of truth, read synchronously by
    // `scheduleClose` and `handleOutside`. The mirrored state exists
    // only to re-create callback closures so React state-derived UI
    // can react to it — but no scheduling logic depends on the state
    // value to be committed. Keeping the state-only dance led to a
    // race where a mousedown queued `setInteracted(true)` and a
    // mouseout / mouseleave firing in the same micro-batch read the
    // STALE closure (interacted=false) and scheduled a close that
    // fired 150ms later, dismissing a popover the user had clearly
    // committed to.
    const interactedRef = useRef(false);
    const [, setInteractedVersion] = useState(0);
    const setInteracted = useCallback((v: boolean) => {
      if (interactedRef.current === v) return;
      interactedRef.current = v;
      setInteractedVersion((n) => n + 1);
    }, []);
    // True during the close animation — the body stays mounted but
    // fades out via its `visible` prop. After `closeAnimMs` the
    // unmount-timer flips `state` to null and tears down the DOM.
    const [closing, setClosing] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The current session's close callback (set per `open`). Fired once at
    // unmount, then cleared so a reopened session can't double-invoke it.
    const onCloseRef = useRef<(() => void) | null>(null);

    const cancelClose = useCallback(() => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    }, []);

    const cancelUnmount = useCallback(() => {
      if (unmountTimer.current) {
        clearTimeout(unmountTimer.current);
        unmountTimer.current = null;
      }
    }, []);

    const closeNow = useCallback(() => {
      cancelClose();
      // Two-phase close: flip `closing` to true so the body's
      // `visible` prop fades opacity / transform to 0; after the CSS
      // transition completes (`closeAnimMs`), unmount.
      setClosing(true);
      cancelUnmount();
      unmountTimer.current = setTimeout(() => {
        // Notify the opener before tearing down so it can read where focus
        // currently is (still inside the popover ⇒ restore; moved to an
        // outside target ⇒ leave alone). Cleared so a reopen can't re-fire.
        const onClose = onCloseRef.current;
        onCloseRef.current = null;
        onClose?.();
        setState(null);
        setInteracted(false);
        setClosing(false);
        unmountTimer.current = null;
      }, closeAnimMs);
    }, [cancelClose, cancelUnmount, setInteracted]);

    const open = useCallback<HoverPopoverApi<TState>['open']>(
      (next, opts) => {
        const pinned = opts?.pinned ?? false;
        // Sticky-edit guard. Once the user has clicked inside the
        // current popover, any further hover events on OTHER `{{ref}}`
        // chips elsewhere on the page must NOT swap or replace the
        // popover. The user's commitment to the current edit overrides
        // hover signals from neighbors. Only Escape, outside-click, or
        // an explicit save closes the active session — at which point
        // the user is free to hover a different chip and start a new
        // one. Same-identity re-hovers (cursor returns to the source
        // chip) are allowed through because they don't change state.
        // A pinned open is an explicit click on another trigger — an
        // intentional new session that supersedes the current one, so it
        // bypasses the guard.
        if (!pinned && interactedRef.current && state) {
          if (identity(state) !== identity(next)) return;
        }
        cancelClose();
        // Re-opening during the close animation: cancel the pending
        // unmount, reveal again. Keeps the same DOM if identity is
        // unchanged (no remount flicker) — `key={identity(state)}`
        // handles fresh mount when identity DOES change.
        cancelUnmount();
        setClosing(false);
        // Identity changes (different ref / different anchor) reset
        // `interacted` — that's a new session. SAME identity preserves
        // it so re-hovering the source chip doesn't silently lose the
        // sticky flag the user committed to by clicking inside.
        const prevIdentity = state ? identity(state) : null;
        if (prevIdentity !== identity(next)) interactedRef.current = false;
        // Pinned (click-opened) sessions are born committed: dismissal is
        // outside-click / Escape / save only — `scheduleClose` no-ops while
        // `interacted` is true, so a mouse-leave can't close it.
        if (pinned) interactedRef.current = true;
        // Bind this session's close callback (committed only past the
        // sticky-edit guard above, so an ignored re-hover can't clobber it).
        onCloseRef.current = opts?.onClose ?? null;
        setState(next);
      },
      [cancelClose, cancelUnmount, state],
    );

    const scheduleClose = useCallback<HoverPopoverApi<TState>['scheduleClose']>(
      (relatedTarget) => {
        // Synchronous ref read — no closure-staleness race. A mousedown
        // that flipped `interactedRef.current = true` in the SAME tick
        // is honored even before React commits the mirrored state.
        if (interactedRef.current) return;
        // Cursor moving into a portal-mounted child overlay (suggestion
        // dropdown, nested variable popover) doesn't count as leaving
        // the popover surface — without this check the parent popover
        // would close the moment the user reaches for an inner control.
        if (relatedTarget instanceof Element) {
          for (const sel of insideSelectors) {
            if (relatedTarget.closest(sel)) return;
          }
        }
        cancelClose();
        closeTimer.current = setTimeout(() => {
          closeTimer.current = null;
          closeNow();
        }, closeGraceMs);
      },
      [cancelClose, closeNow],
    );

    const api = useMemo<HoverPopoverApi<TState>>(
      () => ({ open, scheduleClose, cancelClose, closeNow }),
      [open, scheduleClose, cancelClose, closeNow],
    );

    const handleInside = useCallback(() => {
      setInteracted(true);
      cancelClose();
    }, [cancelClose, setInteracted]);
    const handleOutside = useCallback(() => {
      if (interactedRef.current) closeNow();
    }, [closeNow]);

    useDismiss({
      active: state !== null,
      insideSelectors,
      onInside: handleInside,
      onOutside: handleOutside,
      onEscape: closeNow,
    });

    // Hover back into the popover during the close animation reverses
    // it — cancel the pending unmount and flip `closing` off so the
    // CSS transition runs in reverse (opacity/transform back to 1).
    const handleBodyMouseEnter = useCallback(() => {
      cancelClose();
      cancelUnmount();
      setClosing(false);
    }, [cancelClose, cancelUnmount]);

    return (
      <Context.Provider value={api}>
        {children}
        {state && (
          <Body
            key={identity(state)}
            state={state}
            visible={!closing}
            onClose={closeNow}
            onMouseEnter={handleBodyMouseEnter}
            onMouseLeave={(e) => scheduleClose(e.relatedTarget)}
          />
        )}
      </Context.Provider>
    );
  };

  function useApi(): HoverPopoverApi<TState> {
    return useContext(Context);
  }

  return { Provider, useApi };
}
