/**
 * backend-mode-switch — machinery for switching the active back-end.
 *
 * Switching a back-end is a clean, non-destructive act. Every mode
 * change routes through {@link useBackendModeSwitch}, which:
 *
 *   1. Verifies the wire first — a reachability + auth probe against the
 *      target (the same {@link probeBackendConnection} "Test connection"
 *      uses). A failure HARD-ABORTS the switch with the same notification
 *      copy, so the user is never stranded on an unreachable back-end.
 *      Modes that need no connection (`in-browser`, or where the host IS
 *      the back-end) skip the probe.
 *   2. Shows a brief, non-closable "Switching to <X>…" overlay (min 1s).
 *   3. Commits the change onto the `OH.backends` registry
 *      (`applyBackendMode` — the enabled flag on entry #0; the mode
 *      itself is derived presentation, never stored).
 *   4. Ends with a success toast.
 *
 * Switching never moves data: the user's workspaces stay on-device under
 * their own Org; the target's workspaces sync down and become active
 * (consume-only). Cleanup, if wanted, is a deliberate per-workspace
 * delete in the Workspace Manager — not a switch-time choice.
 */

import { getPrimaryBackend } from '@openheaders/core/backends';
import { App as AntApp } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { generateUid } from '@openheaders/core/utils';
import {
  applyBackendMode,
  describeProbeResult,
  primaryBackendUrl,
  probeBackendConnection,
} from '../../../shared/backend';
import { useBackendMode } from '../../../shared/hooks/useBackendMode';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending, backendModeNeedsConnection, hostIsTheBackend } from '../schema/backend';
import { useSurfaceWorkspaceAdopt } from '../../hooks/SurfaceWorkspaceAdoptContext';
import SwitchingOverlay from './SwitchingOverlay';

interface ModeDescriptor {
  mode: BackendMode;
  title: string;
  validHosts: readonly Host[];
}

const MODE_DESCRIPTORS: readonly ModeDescriptor[] = [
  { mode: 'in-browser', title: 'Browser Extension', validHosts: ['extension'] },
  { mode: 'desktop-app', title: 'Desktop Application', validHosts: ['extension', 'desktop', 'web'] },
  { mode: 'local-self-hosted', title: 'Local / LAN', validHosts: ['extension', 'desktop', 'web'] },
  { mode: 'remote-self-hosted', title: 'Remote / WAN', validHosts: ['extension', 'desktop', 'web'] },
];

export function labelForMode(mode: BackendMode): string {
  return MODE_DESCRIPTORS.find((d) => d.mode === mode)?.title ?? mode;
}

/** Minimum dwell for the "Switching to …" overlay so an instant commit doesn't flash. */
const MIN_OVERLAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BackendModeSwitchHandle {
  mode: BackendMode;
  attemptChange: (next: BackendMode) => Promise<void>;
  disabled: boolean;
  /**
   * The "Switching to …" overlay element, mounted while a switch is in
   * flight. Render this inline — multiple consumers can mount it without
   * conflict because only one switch runs at a time.
   */
  overlayElement: React.ReactNode;
}

/**
 * One-stop hook for routing a `backend.mode` change through the
 * verify-then-switch flow. Holds the in-flight overlay state, runs the
 * connection probe gate, and surfaces probe failures + the success toast
 * via Ant's App notification / message APIs.
 */
export function useBackendModeSwitch(): BackendModeSwitchHandle {
  const mode = useBackendMode();
  const { message, notification } = AntApp.useApp();
  const [overlay, setOverlay] = useState<{ toLabel: string } | null>(null);
  // Re-pin THIS workbench surface to the new host's active workspace once
  // the switch settles. `null` outside the workbench (popup / side-panel
  // follow global active by design), so those skip the re-pin.
  const adoptActiveWorkspaceIntoSurface = useSurfaceWorkspaceAdopt();

  const attemptChange = async (next: BackendMode): Promise<void> => {
    if (overlay) return;
    if (next === mode) return;

    const host = getCurrentHost();
    const toLabel = labelForMode(next);

    // Verify the wire first — but only for modes that actually have one.
    // `in-browser`, host-is-the-backend, and not-yet-shipped (pending)
    // modes have nothing to probe.
    const needsProbe =
      backendModeNeedsConnection(next) && !hostIsTheBackend(next, host) && !backendModeIsPending(next);
    if (needsProbe) {
      const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';
      const result = await probeBackendConnection(primaryBackendUrl(), {
        agent: `${role}-switch-probe`,
        nodeId: `probe-${generateUid()}`,
        workspaceId: `probe-${generateUid()}`,
        role,
        // The daemon gates every HELLO on a paired token (loopback included).
        authToken: getPrimaryBackend()?.authToken ?? '',
      });
      if (!result.ok) {
        // Same copy as Test connection — and HARD-ABORT, don't commit.
        const notice = describeProbeResult(result, toLabel);
        notification[notice.level]({ message: notice.message, description: notice.description });
        return;
      }
    }

    setOverlay({ toLabel });
    await applyBackendMode(host, next);
    // A connection-backed switch makes the new host promote its workspace
    // to ACTIVE on first join (the data plane's adoption). Hold the
    // overlay until that lands and this surface has followed onto it, so
    // the user never sees the previous host's workspace flash through.
    // Non-connection modes don't adopt, so there's nothing to follow.
    const followsActiveWorkspace = needsProbe && adoptActiveWorkspaceIntoSurface !== null;
    await Promise.all([
      sleep(MIN_OVERLAY_MS),
      followsActiveWorkspace ? adoptActiveWorkspaceIntoSurface() : Promise.resolve(),
    ]);
    setOverlay(null);
    message.success(`Switched to ${toLabel}.`);
  };

  const overlayElement = overlay ? <SwitchingOverlay open toLabel={overlay.toLabel} /> : null;

  return {
    mode,
    attemptChange,
    disabled: overlay !== null,
    overlayElement,
  };
}

