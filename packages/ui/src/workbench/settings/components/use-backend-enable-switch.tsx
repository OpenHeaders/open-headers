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
import { getHostBridge } from '@openheaders/core/bridge';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import type { BackendConnection, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { App as AntApp } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { describeProbeResult, probeBackendConnection } from '../../../shared/backend';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { useSurfaceWorkspaceAdopt } from '../../hooks/SurfaceWorkspaceAdoptContext';
import { backendDisplayLabel } from './backend-record-context';
import SwitchingOverlay from './SwitchingOverlay';

/** Minimum dwell for the "Connecting to …" overlay so an instant commit doesn't flash. */
const MIN_OVERLAY_MS = 1_000;

/**
 * Post-green grace before the synced race ends the dwell — covers the
 * adopted workspace's mirror broadcast still crossing the bridge, so a
 * join that DOES repoint the active workspace lets the adopt settle win
 * instead of closing the overlay a frame early.
 */
const SYNCED_GRACE_MS = 300;

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

/**
 * Resolves once `backendId`'s per-backend sync slot reports green — the
 * join has settled. The adopt settle only fires when the active
 * workspace CHANGES, so a join that promotes the workspace this surface
 * is already on would otherwise sit out the full settle timeout; the
 * handshake sequences the adopted workspace first in the fan-out, so by
 * the first green the promotion decision has already executed. Never
 * resolves when the wire stays un-green (or no bridge is installed) —
 * always race it against the settle, and `cancel()` in a finally.
 */
function watchBackendSynced(backendId: string): { synced: Promise<void>; cancel: () => void } {
  let cancel = (): void => {};
  const synced = new Promise<void>((resolve) => {
    const bridge = getHostBridge();
    if (!bridge) return;
    let unsubscribe: (() => void) | undefined;
    const check = (snapshot: BackendSyncStatusSnapshot): void => {
      if (snapshot[backendId]?.state !== 'green') return;
      unsubscribe?.();
      resolve();
    };
    unsubscribe = bridge.subscribe('backendSyncStatusUpdated', check);
    cancel = () => unsubscribe?.();
    void bridge
      .call('getBackendSyncStatusSnapshot')
      .catch(() => null)
      .then((resp) => {
        if (resp?.snapshot) check(resp.snapshot);
      });
  });
  return { synced, cancel };
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
  const t = useT();
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
      const notice = describeProbeResult(result, toLabel, t);
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
    const joinSettled = watchBackendSynced(record.id);
    let refusedEarly = false;
    try {
      const adopt =
        adoptActiveWorkspaceIntoSurface && !isRejoin ? adoptActiveWorkspaceIntoSurface() : Promise.resolve();
      await Promise.all([
        sleep(MIN_OVERLAY_MS),
        Promise.race([
          adopt,
          // A join that leaves the active workspace unchanged never fires
          // the adopt settle — end the dwell on the wire's green instead.
          joinSettled.synced.then(() => sleep(SYNCED_GRACE_MS)),
          refusal.refused.then(() => {
            refusedEarly = true;
          }),
        ]),
      ]);
    } finally {
      refusal.cancel();
      joinSettled.cancel();
    }
    setOverlay(null);
    if (refusedEarly) {
      // The connection row's conflict strip carries the full reason.
      message.warning(t('workbench.settings.backendPane.enable.orgNotJoined', { label: toLabel }));
    } else {
      message.success(t('workbench.settings.backendPane.enable.connected', { label: toLabel }));
    }
    return true;
  };

  const overlayElement = overlay ? <SwitchingOverlay open toLabel={overlay.toLabel} /> : null;

  return { setEnabled, busy: overlay !== null, overlayElement };
}
