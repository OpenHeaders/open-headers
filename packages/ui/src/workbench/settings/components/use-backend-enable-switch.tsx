/**
 * use-backend-enable-switch — the probe-gated enable toggle for a
 * backend record. Enabling is the moment a record earns its wire
 * (MULTI_BACKEND_PLAN.md §4: nothing connects until the probe passes),
 * so the off→on flip:
 *
 *   1. Verifies the wire first — a reachability + auth probe against the
 *      record's URL with its paired token (the same probe "Test
 *      connection" ran). A failure HARD-ABORTS with the same
 *      notification copy; the record stays disabled.
 *   2. Shows a brief, non-closable "Connecting to <X>…" overlay (min 1s).
 *   3. Commits `enabled: true` — the connection manager reconciles and
 *      dials.
 *   4. Holds the overlay until this surface has followed the adopted
 *      active workspace (first join promotes the backend's workspace),
 *      then ends with a success toast.
 *
 * Disabling never probes — it's the kill switch, a plain record write.
 * Enabling never moves data: the target's workspaces sync down
 * (consume-only); local workspaces stay under their own Orgs.
 */

import { updateBackend } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import type { BackendConnection } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { App as AntApp } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { describeProbeResult, probeBackendConnection } from '../../../shared/backend';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { useSurfaceWorkspaceAdopt } from '../../hooks/SurfaceWorkspaceAdoptContext';
import { backendDisplayLabel } from './backend-record-context';
import SwitchingOverlay from './SwitchingOverlay';

/** Minimum dwell for the "Connecting to …" overlay so an instant commit doesn't flash. */
const MIN_OVERLAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves the moment a WELCOME refusal lands for `backendId` (a fresh
 * `OH.backendOrgConflicts` row stamped at/after `sinceMs`). A refused
 * join never adopts, so without this the enable overlay would sit out
 * the full adopt-settle timeout before closing. Never resolves when no
 * refusal arrives — always race it against the settle, and `cancel()`
 * in a finally.
 */
function watchOrgConflictRefusal(backendId: string, sinceMs: number): { refused: Promise<void>; cancel: () => void } {
  let cancel = (): void => {};
  const refused = new Promise<void>((resolve) => {
    const storage = getHostStorage();
    if (!storage) return;
    let unsubscribe: (() => void) | undefined;
    const check = (): void => {
      void storage.get(OH.backendOrgConflicts).then((rows) => {
        if ((rows ?? []).some((c) => c.backendId === backendId && Date.parse(c.at) >= sinceMs)) {
          unsubscribe?.();
          resolve();
        }
      });
    };
    unsubscribe = storage.subscribe(OH.backendOrgConflicts, check);
    cancel = () => unsubscribe?.();
    check();
  });
  return { refused, cancel };
}

export interface BackendEnableSwitchHandle {
  /**
   * Flip a record's `enabled` flag. Off→on runs the probe gate and
   * aborts without committing on failure; on→off commits directly.
   * Resolves true when the flip committed, false on a probe abort.
   */
  setEnabled: (record: BackendConnection, next: boolean) => Promise<boolean>;
  /** A flip is in flight — callers disable their toggles meanwhile. */
  busy: boolean;
  /**
   * The "Connecting to …" overlay element, mounted while an enable is in
   * flight. Render inline — only one flip runs at a time.
   */
  overlayElement: React.ReactNode;
}

export function useBackendEnableSwitch(): BackendEnableSwitchHandle {
  const { message, notification } = AntApp.useApp();
  const [overlay, setOverlay] = useState<{ toLabel: string } | null>(null);
  // Re-pin THIS workbench surface to the adopted active workspace once
  // the enable settles. `null` outside the workbench (popup / side-panel
  // follow global active by design), so those skip the re-pin.
  const adoptActiveWorkspaceIntoSurface = useSurfaceWorkspaceAdopt();

  const setEnabled = async (record: BackendConnection, next: boolean): Promise<boolean> => {
    if (overlay) return false;
    if (record.enabled === next) return true;

    if (!next) {
      await updateBackend(record.id, { enabled: false });
      return true;
    }

    const host = getCurrentHost();
    const toLabel = backendDisplayLabel(record);
    const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';
    const result = await probeBackendConnection(record.url, {
      agent: `${role}-enable-probe`,
      nodeId: `probe-${generateUid()}`,
      workspaceId: `probe-${generateUid()}`,
      role,
      // The daemon gates every HELLO on a paired token (loopback included).
      authToken: record.authToken,
    });
    if (!result.ok) {
      // Same copy as Test connection — and HARD-ABORT, don't commit.
      const notice = describeProbeResult(result, toLabel);
      notification[notice.level]({ message: notice.message, description: notice.description });
      return false;
    }

    setOverlay({ toLabel });
    // Adoption happens on FIRST join only — a re-enable of a record whose
    // Orgs are already bound reconnects without repointing the active
    // workspace, so waiting would just burn the adopt settle timeout.
    const isRejoin = [...getOrgBackendBindings().values()].includes(record.id);
    const flippedAtMs = Date.now();
    await updateBackend(record.id, { enabled: true });
    // First join promotes the backend's active workspace; hold the
    // overlay until this surface has followed onto it so the user never
    // sees the previous workspace flash through. A refused WELCOME
    // (Org-uniqueness conflict) never adopts — end the dwell the moment
    // the refusal row lands instead of sitting out the settle timeout.
    const refusal = watchOrgConflictRefusal(record.id, flippedAtMs);
    let refusedEarly = false;
    try {
      const adopt =
        adoptActiveWorkspaceIntoSurface && !isRejoin ? adoptActiveWorkspaceIntoSurface() : Promise.resolve();
      await Promise.all([
        sleep(MIN_OVERLAY_MS),
        Promise.race([
          adopt,
          refusal.refused.then(() => {
            refusedEarly = true;
          }),
        ]),
      ]);
    } finally {
      refusal.cancel();
    }
    setOverlay(null);
    if (refusedEarly) {
      // The connection row's conflict strip carries the full reason.
      message.warning(`${toLabel} connected, but its Org wasn't joined — see the connection row.`);
    } else {
      message.success(`Connected to ${toLabel}.`);
    }
    return true;
  };

  const overlayElement = overlay ? <SwitchingOverlay open toLabel={overlay.toLabel} /> : null;

  return { setEnabled, busy: overlay !== null, overlayElement };
}
