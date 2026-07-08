/**
 * Headless status store — the daemon's implementation of the spine's
 * status seam. Same overwrite-per-subsystem semantics as the UI-side
 * store; no renderer exists yet to mirror it (the served web app takes
 * that role in Phase 4), so subscribers today are just the spine's
 * `statusUpdated` relay, and the snapshot serves the `getStatusSnapshot`
 * RPC + future `oh-daemon status` output.
 */

import type { StatusSnapshot, StatusSubsystem } from '@openheaders/core/types';
import type { SpineStatusStore } from '@openheaders/oracle-host-node/daemon';

export function createDaemonStatusStore(): SpineStatusStore {
  const snapshot: StatusSnapshot = {};
  const listeners = new Set<(snapshot: StatusSnapshot) => void>();

  function notify(): void {
    const copy: StatusSnapshot = { ...snapshot };
    for (const listener of listeners) listener(copy);
  }

  return {
    report(input) {
      const prev = snapshot[input.subsystem];
      snapshot[input.subsystem] = {
        subsystem: input.subsystem,
        state: input.state,
        message: input.message,
        context: input.context,
        timestamp: Date.now(),
      };
      // Skip notify churn when a subsystem re-emits an identical state —
      // context changes still count (mirrors the UI store's contract).
      if (
        prev &&
        prev.state === input.state &&
        prev.message === input.message &&
        contextsEqual(prev.context, input.context)
      ) {
        return;
      }
      notify();
    },
    getSnapshot() {
      return { ...snapshot };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      let touched = false;
      for (const key of Object.keys(snapshot) as StatusSubsystem[]) {
        delete snapshot[key];
        touched = true;
      }
      if (touched) notify();
    },
  };
}

function contextsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}
