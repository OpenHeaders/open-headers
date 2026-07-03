/**
 * CDP tab-pin registration seam.
 *
 * `pinCdpTab` / `unpinCdpTab` are born inside `startLifecyclePipeline()` —
 * they close over the single {@link CdpAttachController} reconciler. The
 * footer's "include this tab" control writes through the `setCdpTabPin` RPC,
 * whose handler lives in the message-handler map and can't reach that
 * closure. This module bridges them: `background.ts` registers the controls
 * once the pipeline handles exist (sibling to the master-switch / scope-mode
 * effector wiring), and the handler drives them through {@link setCdpTabPin}.
 *
 * The controller is the only path that drives a tab into CDP, so the pin
 * write stays a thin pass-through — no attach logic here, just the one
 * derivation input.
 */

interface CdpTabPinControls {
  pin: (tabId: number) => void;
  unpin: (tabId: number) => void;
}

let controls: CdpTabPinControls | null = null;

/** Register the pipeline's pin/unpin controls. Idempotent — a re-register
 *  (SW re-init) replaces the prior pair. */
export function registerCdpTabPinControls(next: CdpTabPinControls): void {
  controls = next;
}

/**
 * Pin or unpin a tab into the CDP scope. No-op before the controls are
 * registered (on hosts without CDP they never are) so a stray RPC can't
 * throw.
 */
export function setCdpTabPin(tabId: number, pinned: boolean): void {
  if (!controls) return;
  if (pinned) controls.pin(tabId);
  else controls.unpin(tabId);
}

/** Test-only — drop the registration so tests start from a clean seam. */
export function __resetCdpTabPinControlsForTests(): void {
  controls = null;
}
