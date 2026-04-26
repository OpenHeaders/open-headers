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
import { useDismiss } from '@/shared/use-dismiss';
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

/** Selector list passed to `useDismiss` as `insideSelectors`. The
 *  popover dialog itself is matched by `[data-variable-popover-root]`;
 *  Antd portal-mounted overlays (Dropdown menu, Tooltip, Select
 *  dropdown, Popover, Popconfirm) attach to `document.body` as
 *  siblings, so we detect them by their stable Antd class hooks. */
const POPOVER_INSIDE_SELECTORS: ReadonlyArray<string> = [
  '[data-variable-popover-root]',
  '.ant-dropdown',
  '.ant-tooltip',
  '.ant-popover',
  '.ant-select-dropdown',
  '.ant-message',
];

export const VariablePopoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PopoverState | null>(null);
  // Once the user clicks anywhere within the popover surface (the
  // dialog itself or any of its portal-mounted overlays), the popover
  // switches from hover-out semantics to click-out semantics — it
  // stays open until Escape, click-outside, or save. This matches the
  // convention every modal-ish UI uses: passive hover means dismissible
  // by hover-out; active interaction means commitment.
  const [interacted, setInteracted] = useState(false);
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
    setInteracted(false);
  }, [cancelClose]);

  const open = useCallback(
    (next: PopoverState) => {
      cancelClose();
      setState(next);
      setInteracted(false);
    },
    [cancelClose],
  );

  const scheduleClose = useCallback(() => {
    // Once the user has interacted, hover-out is no longer a dismissal
    // signal — they may have moved their cursor away to read elsewhere
    // while editing. Only an explicit dismissal closes us now.
    if (interacted) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setState(null);
      closeTimer.current = null;
    }, CLOSE_GRACE_MS);
  }, [cancelClose, interacted]);

  const api = useMemo<VariablePopoverApi>(
    () => ({ open, scheduleClose, cancelClose, closeNow }),
    [open, scheduleClose, cancelClose, closeNow],
  );

  // Outside-click dismissal + interaction detection + Escape, all via
  // the shared `useDismiss` hook (apps/extension/src/shared/use-dismiss).
  // First inside-click switches the dismissal mode from hover-out to
  // click-out by flipping `interacted`. Outside clicks dismiss only
  // after that switch, so passive hover-readers aren't surprised by a
  // close on stray clicks.
  const handleInside = useCallback(() => {
    setInteracted(true);
    cancelClose();
  }, [cancelClose]);
  const handleOutside = useCallback(() => {
    if (interacted) closeNow();
  }, [interacted, closeNow]);

  useDismiss({
    active: state !== null,
    insideSelectors: POPOVER_INSIDE_SELECTORS,
    onInside: handleInside,
    onOutside: handleOutside,
    onEscape: closeNow,
  });

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
