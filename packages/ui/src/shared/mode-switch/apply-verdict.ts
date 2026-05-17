/**
 * Mode-switch verdict dispatcher — Phase C M2c.
 *
 * Pure side-effect router. The orchestrator computes a
 * {@link ModeSwitchVerdict}; this helper fans the verdict out into the
 * three actions a host UI must take: commit the new mode silently,
 * surface a "peer unreachable" toast, or mount the resolution dialog.
 * Keeping the dispatch table here keeps the BackendPane lean and lets
 * us pin every branch in a single unit test rather than spinning up
 * the full settings DOM.
 */

import type { ModeSwitchVerdict } from '@openheaders/core/sync';

export interface ModeSwitchVerdictHandlers {
  /** Persist the new mode to settings + drive the preview tile to match. */
  readonly commitMode: () => void;
  /** Render a "connect target first" toast for peer-unreachable verdicts. */
  readonly warnPeerUnreachable: () => void;
  /** Mount the resolution dialog with the carrying verdict. */
  readonly openDialog: (
    verdict: Extract<ModeSwitchVerdict, { kind: 'show-dialog' }>,
  ) => void;
}

export function applyModeSwitchVerdict(
  verdict: ModeSwitchVerdict,
  handlers: ModeSwitchVerdictHandlers,
): void {
  switch (verdict.kind) {
    case 'no-change':
      return;
    case 'both-empty':
    case 'silent-use-target':
    case 'silent-import-source':
      handlers.commitMode();
      return;
    case 'peer-unreachable':
      handlers.warnPeerUnreachable();
      return;
    case 'show-dialog':
      handlers.openDialog(verdict);
  }
}
