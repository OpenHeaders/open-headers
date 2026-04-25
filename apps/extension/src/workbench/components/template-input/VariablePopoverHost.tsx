/**
 * VariablePopoverHost — single popover instance shared across every
 * `TemplateInput` on the page.
 *
 * Each TemplateInput contains many spans, each page contains many
 * TemplateInputs. Mounting a `<VariableHoverPopover>` per input pulls
 * in the full variable-resolver hook chain (vault, environments,
 * collections, live variables, live caches, the resolver itself) once
 * per input — wasteful for a feature 90% of users only invoke
 * occasionally.
 *
 * This provider mounts the popover ONCE at the app root. TemplateInputs
 * call `useVariablePopover()` and `open({ anchorEl, reference,
 * collectionId })` when the user hovers a `{{ref}}` span; the host
 * owns the open/close state, the close-grace timer, and the popover
 * component's lifecycle. When closed, the popover unmounts → state
 * resets for free without manual reset effects.
 *
 * Workbench, popup, and devpanel apps each wrap their tree in
 * `<VariablePopoverProvider>` so any `TemplateInput` they render gets
 * the shared host. A TemplateInput rendered outside a provider
 * gracefully degrades — `useVariablePopover()` returns a noop, no
 * popover appears, but typing still works.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import VariableHoverPopover from './VariableHoverPopover';

interface PopoverState {
  anchorEl: HTMLElement;
  reference: string;
  collectionId?: string;
}

export interface VariablePopoverApi {
  /** Open the popover anchored to `anchorEl` for the given reference.
   *  Idempotent — a second call updates the anchor/reference in place. */
  open(state: PopoverState): void;
  /** Schedule a close after the grace period (default 150ms). Lets the
   *  pointer travel from the span into the popover body without flicker. */
  scheduleClose(): void;
  /** Cancel a pending close — call this when the pointer enters the popover. */
  cancelClose(): void;
  /** Close immediately (Escape, save success, manual dismiss). */
  closeNow(): void;
}

const NOOP_API: VariablePopoverApi = {
  open: () => {},
  scheduleClose: () => {},
  cancelClose: () => {},
  closeNow: () => {},
};

const VariablePopoverContext = createContext<VariablePopoverApi>(NOOP_API);

const CLOSE_GRACE_MS = 150;

export const VariablePopoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PopoverState | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    cancelClose();
    setState(null);
  }, [cancelClose]);

  const open = useCallback(
    (next: PopoverState) => {
      cancelClose();
      setState(next);
    },
    [cancelClose],
  );

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setState(null);
      closeTimer.current = null;
    }, CLOSE_GRACE_MS);
  }, [cancelClose]);

  const api = useMemo<VariablePopoverApi>(
    () => ({ open, scheduleClose, cancelClose, closeNow }),
    [open, scheduleClose, cancelClose, closeNow],
  );

  return (
    <VariablePopoverContext.Provider value={api}>
      {children}
      {state && (
        // `key` forces a fresh mount for each open session — the
        // popover's draft / dirty / saving state resets implicitly,
        // no manual `useEffect([open])` reset needed.
        <VariableHoverPopover
          key={`${state.reference}|${state.collectionId ?? ''}`}
          anchorEl={state.anchorEl}
          reference={state.reference}
          collectionId={state.collectionId}
          onClose={closeNow}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </VariablePopoverContext.Provider>
  );
};

/** Returns the shared popover API. Outside a provider, returns a noop
 *  API so consumers don't need to feature-detect — TemplateInput just
 *  silently does nothing if no host is mounted. */
export function useVariablePopover(): VariablePopoverApi {
  return useContext(VariablePopoverContext);
}
