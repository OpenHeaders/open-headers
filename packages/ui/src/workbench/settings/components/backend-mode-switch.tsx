/**
 * backend-mode-switch — machinery for editing the `backend.mode` setting.
 *
 * Switching a back-end is a clean, non-destructive act. Every write to
 * `backend.mode` routes through {@link useBackendModeSwitch}, which:
 *
 *   1. Verifies the wire first — a reachability + auth probe against the
 *      target (the same {@link probeBackendConnection} "Test connection"
 *      uses). A failure HARD-ABORTS the switch with the same notification
 *      copy, so the user is never stranded on an unreachable back-end.
 *      Modes that need no connection (`in-browser`, or where the host IS
 *      the back-end) skip the probe.
 *   2. Shows a brief, non-closable "Switching to <X>…" overlay (min 1s).
 *   3. Commits `backend.mode`.
 *   4. Ends with a success toast.
 *
 * Switching never moves data: the user's workspaces stay on-device under
 * their own Org; the target's workspaces sync down and become active
 * (consume-only). Cleanup, if wanted, is a deliberate per-workspace
 * delete in the Workspace Manager — not a switch-time choice.
 *
 * Two consumers share the same hook:
 *   - BackendPane: full-bleed picker UI.
 *   - BackendModeFieldEditor: FieldRow-wrapped Select for the generic
 *     settings/search path.
 */

import { App as AntApp, Select } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { generateUid } from '@openheaders/core/utils';
import { describeProbeResult, probeBackendConnection } from '../../../shared/backend';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { get as getSettingValue } from '../store';
import { useSetting } from '../hooks';
import FieldRow from '../fields/FieldRow';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending, backendModeNeedsConnection, hostIsTheBackend } from '../schema/backend';
import { useSurfaceWorkspaceAdopt } from '../../hooks/SurfaceWorkspaceAdoptContext';
import type { SettingDef } from '../types';
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
  const [mode, setMode] = useSetting('backend.mode');
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
      const result = await probeBackendConnection(getSettingValue('backend.url'), {
        agent: `${role}-switch-probe`,
        nodeId: `probe-${generateUid()}`,
        workspaceId: `probe-${generateUid()}`,
        role,
        // The daemon gates every HELLO on a paired token (loopback included).
        authToken: getSettingValue('backend.authToken'),
      });
      if (!result.ok) {
        // Same copy as Test connection — and HARD-ABORT, don't commit.
        const notice = describeProbeResult(result, toLabel);
        notification[notice.level]({ message: notice.message, description: notice.description });
        return;
      }
    }

    setOverlay({ toLabel });
    setMode(next);
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

/**
 * Options for the Active back-end Select. Pending modes (daemon / VM)
 * stay selectable so users can pre-stage them; only host-incompatible
 * modes are hard-disabled.
 */
export function backendModeSelectOptions(
  host: Host,
): { value: BackendMode; label: string; disabled: boolean }[] {
  return MODE_DESCRIPTORS.map((d) => {
    const pending = backendModeIsPending(d.mode);
    return {
      value: d.mode,
      label: `${d.title}${pending ? ' · coming soon' : ''}`,
      disabled: !d.validHosts.includes(host),
    };
  });
}

/**
 * Custom editor for `backend.mode` in the generic settings/search path.
 * Wraps the switch-aware Select in the standard FieldRow chrome so it
 * visually matches other settings, while still routing every write
 * through `useBackendModeSwitch`.
 */
const BackendModeFieldEditor: React.FC<{ def: SettingDef }> = ({ def }) => {
  const host = getCurrentHost();
  const { mode, attemptChange, disabled, overlayElement } = useBackendModeSwitch();
  return (
    <>
      <FieldRow
        settingKey={def.key}
        label={def.label}
        description={def.description}
        experimental={def.experimental}
        requiresConnection={def.requiresConnection}
      >
        <Select<BackendMode>
          value={mode}
          disabled={disabled}
          onChange={(next) => {
            void attemptChange(next);
          }}
          style={{ width: '100%' }}
          options={backendModeSelectOptions(host)}
        />
      </FieldRow>
      {overlayElement}
    </>
  );
};

export default BackendModeFieldEditor;
