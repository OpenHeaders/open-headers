/**
 * useDismiss — window-level mousedown + keydown listener for
 * popover/dropdown-style dismissal.
 *
 * Click-outside detection inherently requires a `window` listener:
 * portal-mounted overlays (Antd Dropdown, Tooltip, Popover, Select,
 * Modal) attach to `document.body` as siblings of any React subtree,
 * so neither React event delegation nor a shell-root listener
 * (`useShellClickCapture`) sees them. This hook owns the window
 * listener for callers that need cross-portal dismissal semantics —
 * e.g. a popover whose own Dropdown menu lives in `body` but should
 * count as "inside the popover" for dismissal purposes.
 *
 * The hook is intentionally minimal — it does NOT trap focus, does
 * NOT manage z-index, does NOT render a backdrop. It just observes
 * mousedown/keydown and tells you whether the event landed inside or
 * outside the configured surface. The caller decides what "inside"
 * and "outside" mean for their UI.
 *
 * **When NOT to use this:** if your dismissal target is fully inside
 * your shell tree (no portal overlays), prefer `useShellClickCapture`
 * — it shares the shell's single capture listener instead of adding
 * another window listener. This hook is specifically for UIs that
 * mix React subtree elements with portal-mounted overlays and need
 * to treat both as "inside".
 *
 * Listeners attach in capture phase so we observe events before
 * application-level handlers (e.g. workspace shortcut handlers can't
 * preempt an Escape that's meant for the popover).
 */

import { type RefObject, useEffect } from 'react';

/**
 * Escape claim stack — layered surfaces (a popover with a suggestion
 * list or a nested popover on top) each hold an Escape claim; only the
 * most recent claimant owns the key, so one press dismisses ONE layer
 * (the topmost) instead of every listener at once. `useDismiss` claims
 * while active; non-`useDismiss` layers (e.g. the template-input
 * suggestion list) claim via {@link claimEscape} so the dismiss
 * listeners beneath them stand down while they're open.
 */
export interface EscapeClaim {
  owns(): boolean;
  release(): void;
}

const escapeClaims: symbol[] = [];

export function claimEscape(): EscapeClaim {
  const token = Symbol('escape-claim');
  escapeClaims.push(token);
  return {
    owns() {
      return escapeClaims[escapeClaims.length - 1] === token;
    },
    release() {
      const i = escapeClaims.indexOf(token);
      if (i !== -1) escapeClaims.splice(i, 1);
    },
  };
}

export interface UseDismissOptions {
  /** Gate. When false, no listeners are attached — the hook is a noop.
   *  Drive this with the open-state of your popover so listeners are
   *  only live during a session. */
  active: boolean;
  /** Refs whose subtree counts as "inside". Each ref's `current`
   *  element AND its descendants are inside. Used for the popover's
   *  own React tree where you can hold a ref. */
  refs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  /** CSS selectors whose nearest ancestor (`Element.closest`) of the
   *  event target counts as "inside". Used for portal-mounted overlays
   *  the hook doesn't hold refs to — pass the stable Antd class hooks
   *  (`.ant-dropdown`, `.ant-tooltip`, etc.) for any overlay your
   *  popover spawns. Brittle to upstream class renames; trade-off
   *  against the complexity of plumbing refs through every overlay. */
  insideSelectors?: ReadonlyArray<string>;
  /** Fires on a mousedown whose target resolved as "inside". Use for
   *  side effects like marking the surface as interacted (e.g. to
   *  switch from hover-dismiss to click-dismiss semantics). */
  onInside?: (event: MouseEvent) => void;
  /** Fires on a mousedown whose target resolved as "outside". */
  onOutside?: () => void;
  /** Fires on Escape keydown. */
  onEscape?: () => void;
}

function isInsideAny(
  target: EventTarget | null,
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  selectors: ReadonlyArray<string>,
): boolean {
  if (!(target instanceof Node)) return false;
  for (const ref of refs) {
    if (ref.current?.contains(target)) return true;
  }
  if (target instanceof Element) {
    for (const sel of selectors) {
      if (target.closest(sel)) return true;
    }
  }
  return false;
}

export function useDismiss(opts: UseDismissOptions): void {
  const { active, refs, insideSelectors, onInside, onOutside, onEscape } = opts;
  useEffect(() => {
    if (!active) return;
    const refList = refs ?? [];
    const selList = insideSelectors ?? [];
    const claim = claimEscape();

    const onMouseDown = (e: MouseEvent) => {
      const inside = isInsideAny(e.target, refList, selList);
      if (inside) onInside?.(e);
      else onOutside?.();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        // A later-mounted layer (nested popover, suggestion list) owns
        // Escape — leave the key to it; this surface dismisses on the
        // NEXT press, after that layer released its claim.
        if (!claim.owns()) return;
        e.stopPropagation();
        onEscape();
      }
    };

    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      claim.release();
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active, refs, insideSelectors, onInside, onOutside, onEscape]);
}
