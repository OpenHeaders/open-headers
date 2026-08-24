/**
 * Join → adopt decision for the single wire (the server access plan
 * A10, as gated S12): adoption targets the USER'S access, not the
 * operator's pointer. The WELCOME's `activeWorkspaceId` is the daemon's
 * host-global active — a solo-tier concept — so it degrades to a HINT:
 *
 *   - armed once, on the first join of the daemon's Org (a reconnect
 *     must not re-adopt over a switch the user made since);
 *   - each recheck adopts the hint if it has synced down, otherwise —
 *     once the `__global__` catch-up has SYNCED and the consumed list
 *     is non-empty — the first workspace in sort order;
 *   - disarmed after ONE adoption. A zero-grant join stays armed, so
 *     the first live grant still adopts in place (the awaiting-access
 *     screen resolves onto a real active pointer); the mount-plane
 *     promotion in `mount-decision.ts` stays the safety net.
 *
 * The chosen target (the hint until adoption, the adopted workspace
 * after) is what the wire's fan-out sequences first, so an interrupted
 * fan-out still leaves the user on a synced workspace.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  getWorkspace,
  listWorkspaces,
  setActiveWorkspaceById,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';

const SCOPE = 'WireAdoption';

/** Workspaces whose Org is bound to the serving daemon, in sort order. */
export function consumedWorkspaceIds(): string[] {
  const bindings = getOrgBackendBindings();
  return listWorkspaces()
    .filter((ws) => bindings.get(ws.orgId) === WEB_DAEMON_BACKEND_ID)
    .map((ws) => ws.id);
}

export interface WireAdoption {
  /** Arm the one adoption on the first join; the WELCOME pointer is a hint (or null). */
  arm(hintWorkspaceId: string | null): void;
  /** The `__global__` catch-up reached SYNCED — the server's workspace list is in. */
  markGlobalSynced(): void;
  /** Re-run the decision — called on every workspace-store change. */
  recheck(): void;
  /** The workspace the fan-out sequences first, or null. */
  priorityWorkspaceId(): string | null;
}

export function createWireAdoption(): WireAdoption {
  let armed = false;
  let hintId: string | null = null;
  let adoptedId: string | null = null;
  // Latched, not per-socket: once the server's list has synced down it
  // is durable local state, and the fallback it gates stays valid.
  let globalSynced = false;

  const recheck = (): void => {
    if (!armed) return;
    let target: string | null = null;
    if (hintId && getWorkspace(hintId)) {
      target = hintId;
    } else if (globalSynced) {
      target = consumedWorkspaceIds()[0] ?? null;
    }
    if (!target) return;
    armed = false;
    adoptedId = target;
    logger.info(SCOPE, `join → adopt ${target}${target === hintId ? ' (the daemon hint)' : ' (first in sort order)'}`);
    void setActiveWorkspaceById(target).catch((err: unknown) => {
      logger.warn(SCOPE, 'join → adopt: could not promote the workspace to active', err);
    });
  };

  return {
    arm: (hintWorkspaceId) => {
      armed = true;
      hintId = hintWorkspaceId;
      recheck();
    },
    markGlobalSynced: () => {
      globalSynced = true;
      recheck();
    },
    recheck,
    priorityWorkspaceId: () => adoptedId ?? hintId,
  };
}
