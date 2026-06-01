/**
 * backend-mode-switch — orchestrator-aware machinery for editing the
 * `backend.mode` setting.
 *
 * Switching back-ends can be destructive (data movement, wipe + backup,
 * peer pairing). Every write to `backend.mode` routes through the
 * request-verdict / apply-verdict / dialog state machine so the user
 * gets the Phase U5 mode-switch choice when both sides have data, and
 * we never strand them on an unreachable peer.
 *
 * Phase U5 — joining a backend is consume-only. The dialog offers two
 * outcomes, the same regardless of backend: keep the joiner's
 * workspaces on this device under their own Org, or discard them
 * (backup + delete). Neither pushes data up. Discard is a local-only
 * operation the host runs AFTER the mode commits and the live
 * connection records the join (U5.2) — so the router commits the mode
 * first, waits for the target `Org` to land in the authorized set,
 * then fires the executor.
 *
 * Two consumers share the same hook:
 *   - BackendPane: full-bleed picker UI.
 *   - BackendModeFieldEditor: FieldRow-wrapped Select for the generic
 *     settings/search path.
 */

import { App as AntApp, Select } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { ModeSwitchVerdict } from '@openheaders/core/sync';
import { summarizeWorkspaces } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  applyModeSwitchVerdict,
  awaitJoinedOrg,
  executeUseTarget,
  type PeerPresenceProbe,
  requestModeSwitchVerdict,
  summarizeUseTargetFailure,
  summarizeUseTargetSuccess,
} from '../../../shared/mode-switch';
import { probeBackendDataPresence } from '../../../shared/backend/probe-connection';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import type { BackendIconKey } from './backend-icons';
import ModeSwitchDialog, { type ModeSwitchChoice } from '../../components/dialogs/ModeSwitchDialog';
import { get as getSettingValue } from '../store';
import { useSetting } from '../hooks';
import FieldRow from '../fields/FieldRow';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
import type { SettingDef } from '../types';

interface ModeDescriptor {
  mode: BackendMode;
  title: string;
  /** Picker glyph key (browser / desktop / daemon / vm) — drives the
   *  visual identity in the ModeSwitchDialog so users see each side's
   *  icon, not just the label. Matches the SCENARIOS table in
   *  BackendPane (kept in sync; both consume the same icon set). */
  icon: BackendIconKey;
  validHosts: readonly Host[];
}

const MODE_DESCRIPTORS: readonly ModeDescriptor[] = [
  { mode: 'in-browser', title: 'Browser Extension', icon: 'browser', validHosts: ['extension'] },
  { mode: 'desktop-app', title: 'Desktop Application', icon: 'desktop', validHosts: ['extension', 'desktop', 'web'] },
  { mode: 'local-self-hosted', title: 'Local / LAN', icon: 'daemon', validHosts: ['extension', 'desktop', 'web'] },
  { mode: 'remote-self-hosted', title: 'Remote / WAN', icon: 'vm', validHosts: ['extension', 'desktop', 'web'] },
];

export function labelForMode(mode: BackendMode): string {
  return MODE_DESCRIPTORS.find((d) => d.mode === mode)?.title ?? mode;
}

export function iconForMode(mode: BackendMode): BackendIconKey | undefined {
  return MODE_DESCRIPTORS.find((d) => d.mode === mode)?.icon;
}

/**
 * Resolve the target back-end's data presence + home `Org` for the
 * mode-switch orchestrator. The orchestrator asks this so its verdict
 * can compare source vs. target data BEFORE the live WS opens.
 *
 * The right transport is a fresh probe — not the live SW WS (which
 * might not be open yet). The probe opens its own WebSocket, sends
 * HELLO, runs `oh.sync.getDataPresence`, then closes; the WELCOME's
 * `Org` (Phase U5.2) rides back so the Discard executor knows which
 * `Org` the joiner's workspaces must be told apart from.
 *
 * Returns `null` when the question has no real answer (target IS this
 * host, target mode pending, or probe failure).
 */
async function probePeerPresenceForMode(targetMode: BackendMode): Promise<PeerPresenceProbe | null> {
  // In-browser target means the local SW IS the target — no remote
  // peer to query. The orchestrator's source-empty fast-path handles
  // this case; otherwise it falls through to peer-unreachable.
  if (targetMode === 'in-browser') return null;
  if (backendModeIsPending(targetMode)) return null;
  const url = getSettingValue('backend.url');
  const role = getCurrentHost() === 'desktop' ? 'desktop' : getCurrentHost() === 'web' ? 'web' : 'extension';
  const result = await probeBackendDataPresence(url, {
    agent: `${role}-mode-switch-probe`,
    nodeId: `probe-${generateUid()}`,
    workspaceId: `probe-${generateUid()}`,
    role,
    // The daemon gates the data-presence handshake on a token too.
    authToken: getSettingValue('backend.authToken'),
  });
  if (!result.ok) return null;
  return { presence: summarizeWorkspaces(result.workspaces), org: result.org };
}

interface DialogState {
  verdict: Extract<ModeSwitchVerdict, { kind: 'show-dialog' }>;
  from: BackendMode;
  to: BackendMode;
}

interface InFlightState {
  kind: ModeSwitchChoice;
  from: BackendMode;
  to: BackendMode;
}

const IN_FLIGHT_TOAST_KEY = 'backend-mode-switch';

function inFlightCopy(kind: ModeSwitchChoice): string {
  if (kind === 'use-target') return 'Switching back-end and backing up your workspaces…';
  return 'Switching back-end…';
}

export interface BackendModeSwitchHandle {
  mode: BackendMode;
  attemptChange: (next: BackendMode) => Promise<void>;
  disabled: boolean;
  /**
   * The active ModeSwitchDialog element when the orchestrator returned
   * `show-dialog`. Render this inline — multiple consumers can mount it
   * without conflict because only one verdict is in flight at a time.
   */
  dialogElement: React.ReactNode;
}

/**
 * One-stop hook for routing a backend.mode change through the
 * destructive-action orchestrator. Holds dialog state + in-flight
 * executor state, mounts the consume-only modal, and surfaces
 * loading/success/warning toasts via Ant's App message API.
 */
export function useBackendModeSwitch(): BackendModeSwitchHandle {
  const [mode, setMode] = useSetting('backend.mode');
  const { message } = AntApp.useApp();
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [inFlight, setInFlight] = useState<InFlightState | null>(null);

  const commitMode = (next: BackendMode): void => {
    setMode(next);
  };

  const attemptChange = async (next: BackendMode): Promise<void> => {
    if (inFlight) return;
    if (next === mode) return;
    const verdict = await requestModeSwitchVerdict(mode, next, {
      queryPeerPresence: () => probePeerPresenceForMode(next),
    });
    applyModeSwitchVerdict(verdict, {
      commitMode: () => commitMode(next),
      warnPeerUnreachable: () => {
        message.warning(
          `Connect ${labelForMode(next)} first — the mode-switch needs to inspect both sides before committing.`,
        );
      },
      openDialog: (showDialog) => {
        setDialogState({
          verdict: showDialog,
          from: mode,
          to: next,
        });
      },
    });
  };

  const handleDialogChoose = async (choice: ModeSwitchChoice): Promise<void> => {
    const state = dialogState;
    if (!state) return;
    setDialogState(null);

    const fromLabel = labelForMode(state.from);
    const toLabel = labelForMode(state.to);
    const targetOrg: Org | null = state.verdict.targetOrg;

    setInFlight({ kind: choice, from: state.from, to: state.to });
    message.loading({ key: IN_FLIGHT_TOAST_KEY, content: inFlightCopy(choice), duration: 0 });

    try {
      // Every outcome commits the mode first — the live connection then
      // joins the target backend (U5.2). Combine / Use-Target are
      // local-only operations the host runs once that join lands.
      commitMode(state.to);

      if (choice === 'keep-local') {
        message.success({
          key: IN_FLIGHT_TOAST_KEY,
          content: `Switched to ${toLabel}. Your ${fromLabel} workspaces stay on this device under your own org.`,
        });
        return;
      }

      if (!targetOrg) {
        message.warning({
          key: IN_FLIGHT_TOAST_KEY,
          content: `Switched to ${toLabel}, but it reported no workspace identity — your workspaces stayed on this device.`,
        });
        return;
      }

      const joined = await awaitJoinedOrg(targetOrg.id);
      if (!joined) {
        message.warning({
          key: IN_FLIGHT_TOAST_KEY,
          content: `Switched to ${toLabel}, but it didn't come online in time — your workspaces stayed on this device. Retry from Settings once connected.`,
        });
        return;
      }

      const result = await executeUseTarget({ targetOrgId: targetOrg.id });
      if (result.ok) {
        message.success({ key: IN_FLIGHT_TOAST_KEY, content: summarizeUseTargetSuccess(result, toLabel) });
      } else {
        message.warning({ key: IN_FLIGHT_TOAST_KEY, content: summarizeUseTargetFailure(result, toLabel) });
      }
    } finally {
      setInFlight(null);
    }
  };

  const dialogElement = dialogState ? (
    <ModeSwitchDialog
      open
      fromLabel={labelForMode(dialogState.from)}
      toLabel={labelForMode(dialogState.to)}
      fromIcon={iconForMode(dialogState.from)}
      toIcon={iconForMode(dialogState.to)}
      source={dialogState.verdict.source}
      target={dialogState.verdict.target}
      targetOrgKnown={dialogState.verdict.targetOrg !== null}
      onChoose={(c) => {
        void handleDialogChoose(c);
      }}
      onCancel={() => setDialogState(null)}
    />
  ) : null;

  return {
    mode,
    attemptChange,
    disabled: inFlight !== null,
    dialogElement,
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
 * Wraps the orchestrator-aware Select in the standard FieldRow chrome so
 * it visually matches other settings, while still routing every write
 * through `useBackendModeSwitch`.
 */
const BackendModeFieldEditor: React.FC<{ def: SettingDef }> = ({ def }) => {
  const host = getCurrentHost();
  const { mode, attemptChange, disabled, dialogElement } = useBackendModeSwitch();
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
      {dialogElement}
    </>
  );
};

export default BackendModeFieldEditor;
