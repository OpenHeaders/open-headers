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
 * focus on without losing their edit.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useDismiss } from './use-dismiss';

export interface HoverPopoverBaseState {
  anchorEl: HTMLElement;
}

export interface HoverPopoverApi<TState extends HoverPopoverBaseState> {
  /** Open the popover. Idempotent — a second call updates the state in place. */
  open(state: TState): void;
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
    const [interacted, setInteracted] = useState(false);
    // True during the close animation — the body stays mounted but
    // fades out via its `visible` prop. After `closeAnimMs` the
    // unmount-timer flips `state` to null and tears down the DOM.
    const [closing, setClosing] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setState(null);
        setInteracted(false);
        setClosing(false);
        unmountTimer.current = null;
      }, closeAnimMs);
    }, [cancelClose, cancelUnmount]);

    const open = useCallback(
      (next: TState) => {
        cancelClose();
        // Re-opening during the close animation: cancel the pending
        // unmount, reveal again. Keeps the same DOM if identity is
        // unchanged (no remount flicker) — `key={identity(state)}`
        // handles fresh mount when identity DOES change.
        cancelUnmount();
        setClosing(false);
        setState(next);
        setInteracted(false);
      },
      [cancelClose, cancelUnmount],
    );

    const scheduleClose = useCallback<HoverPopoverApi<TState>['scheduleClose']>(
      (relatedTarget) => {
        if (interacted) return;
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
      [cancelClose, interacted, closeNow],
    );

    const api = useMemo<HoverPopoverApi<TState>>(
      () => ({ open, scheduleClose, cancelClose, closeNow }),
      [open, scheduleClose, cancelClose, closeNow],
    );

    const handleInside = useCallback(() => {
      setInteracted(true);
      cancelClose();
    }, [cancelClose]);
    const handleOutside = useCallback(() => {
      if (interacted) closeNow();
    }, [interacted, closeNow]);

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
