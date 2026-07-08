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

export interface BackendEnableSwitchHandle {
  /**
   * Flip a record's `enabled` flag. Off→on runs the probe gate and
   * aborts without committing on failure; on→off commits directly.
   */
  setEnabled: (record: BackendConnection, next: boolean) => Promise<void>;
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

  const setEnabled = async (record: BackendConnection, next: boolean): Promise<void> => {
    if (overlay) return;
    if (record.enabled === next) return;

    if (!next) {
      await updateBackend(record.id, { enabled: false });
      return;
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
      return;
    }

    setOverlay({ toLabel });
    await updateBackend(record.id, { enabled: true });
    // First join promotes the backend's active workspace; hold the
    // overlay until this surface has followed onto it so the user never
    // sees the previous workspace flash through.
    await Promise.all([
      sleep(MIN_OVERLAY_MS),
      adoptActiveWorkspaceIntoSurface ? adoptActiveWorkspaceIntoSurface() : Promise.resolve(),
    ]);
    setOverlay(null);
    message.success(`Connected to ${toLabel}.`);
  };

  const overlayElement = overlay ? <SwitchingOverlay open toLabel={overlay.toLabel} /> : null;

  return { setEnabled, busy: overlay !== null, overlayElement };
}
