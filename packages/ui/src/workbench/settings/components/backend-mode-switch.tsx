/**
 * backend-mode-switch — orchestrator-aware machinery for editing the
 * `backend.mode` setting.
 *
 * Switching back-ends can be destructive (data movement, wipe + backup,
 * peer pairing). §11.2 of DATA_PLANE_TOPOLOGIES calls out the silent-
 * commit-on-data-loss anti-pattern; every write to `backend.mode` must
 * route through the request-verdict / apply-verdict / dialog state
 * machine so the user gets a Coexist / Import / Discard choice when
 * both sides have data, and we never strand them on an unreachable
 * peer.
 *
 * Two consumers share the same hook:
 *   - BackendPane: full-bleed picker UI with an "Active back-end"
 *     dropdown card and tile preview row.
 *   - BackendModeFieldEditor: FieldRow-wrapped Select for the generic
 *     settings/search path. Registered as `customEditor` on
 *     `backend.mode`, so a search hit on "backend" or "mode" lands
 *     users on the same guarded dropdown — not the bare enum picker
 *     that bypassed the orchestrator.
 */

import { App as AntApp, Select } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { DataPresenceSummary, ModeSwitchVerdict } from '@openheaders/core/sync';
import { summarizeWorkspaces } from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import {
  applyModeSwitchVerdict,
  executeCoexist,
  executeDiscard,
  executeImport,
  requestModeSwitchVerdict,
  summarizeCoexistFailure,
  summarizeCoexistSuccess,
  summarizeDiscardFailure,
  summarizeDiscardSuccess,
  summarizeImportFailure,
  summarizeImportSuccess,
} from '../../../shared/mode-switch';
import { probeBackendDataPresence } from '../../../shared/backend/probe-connection';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import ModeSwitchDialog, {
  type ModeSwitchChoice,
  type ModeSwitchChooseOptions,
} from '../../components/dialogs/ModeSwitchDialog';
import { get as getSettingValue } from '../store';
import { useSetting } from '../hooks';
import FieldRow from '../fields/FieldRow';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
import type { SettingDef } from '../types';

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

/**
 * Resolve the target back-end's data presence for the mode-switch
 * orchestrator. The orchestrator asks this so its verdict can compare
 * source vs. target data BEFORE the live WS opens.
 *
 * The right transport for this question is a fresh probe — not the
 * live SW WS (which might not be open yet — first-time switch from
 * in-browser into the desktop back-end is exactly that chicken-and-
 * egg). The probe opens its own WebSocket, sends HELLO, runs the
 * `oh.sync.getDataPresence` RPC, then closes. No effect on the live
 * connection lifecycle.
 *
 * Returns `null` for cases where the question has no real answer:
 *   - target mode IS this host (e.g. switching back to in-browser on
 *     the extension — there's no remote peer to query; the
 *     orchestrator's chicken-and-egg branch handles it via source
 *     emptiness).
 *   - target mode is pending (no daemon to probe yet).
 *   - probe fails (URL invalid, server not running, handshake reject).
 */
async function probePeerPresenceForMode(targetMode: BackendMode): Promise<DataPresenceSummary | null> {
  // In-browser target means the local SW IS the target — no remote
  // peer to query. The orchestrator's source-empty fast-path handles
  // this case; otherwise it falls through to peer-unreachable, which
  // is correct because there's no separate "peer state" to inspect.
  if (targetMode === 'in-browser') return null;
  if (backendModeIsPending(targetMode)) return null;
  const url = getSettingValue('backend.url');
  const role = getCurrentHost() === 'desktop' ? 'desktop' : getCurrentHost() === 'web' ? 'web' : 'extension';
  const result = await probeBackendDataPresence(url, {
    agent: `${role}-mode-switch-probe`,
    nodeId: `probe-${generateUid()}`,
    workspaceId: `probe-${generateUid()}`,
    role,
  });
  if (!result.ok) return null;
  return summarizeWorkspaces(result.workspaces);
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
  if (kind === 'coexist') return 'Keeping both as separate workspaces…';
  if (kind === 'import') return 'Importing source data into the target workspace…';
  return 'Discarding source data…';
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
 * executor state, mounts the Coexist/Import/Discard modal, and surfaces
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
        setDialogState({ verdict: showDialog, from: mode, to: next });
      },
    });
  };

  const handleDialogChoose = async (
    choice: ModeSwitchChoice,
    options?: ModeSwitchChooseOptions,
  ): Promise<void> => {
    const state = dialogState;
    if (!state) return;
    setDialogState(null);

    setInFlight({ kind: choice, from: state.from, to: state.to });
    message.loading({
      key: IN_FLIGHT_TOAST_KEY,
      content: inFlightCopy(choice),
      duration: 0,
    });

    try {
      if (choice === 'coexist') {
        const result = await executeCoexist();
        if (result.ok) {
          commitMode(state.to);
          message.success({
            key: IN_FLIGHT_TOAST_KEY,
            content: summarizeCoexistSuccess(result, labelForMode(state.from), labelForMode(state.to)),
          });
        } else {
          message.warning({
            key: IN_FLIGHT_TOAST_KEY,
            content: summarizeCoexistFailure(result, labelForMode(state.to)),
          });
        }
        return;
      }

      if (choice === 'import') {
        const result = await executeImport({ workspaceIdRemap: options?.workspaceIdRemap });
        if (result.ok) {
          commitMode(state.to);
          message.success({
            key: IN_FLIGHT_TOAST_KEY,
            content: summarizeImportSuccess(result, labelForMode(state.from), labelForMode(state.to)),
          });
        } else {
          message.warning({
            key: IN_FLIGHT_TOAST_KEY,
            content: summarizeImportFailure(result, labelForMode(state.to)),
          });
        }
        return;
      }

      const result = await executeDiscard();
      if (result.ok) {
        commitMode(state.to);
        message.success({
          key: IN_FLIGHT_TOAST_KEY,
          content: summarizeDiscardSuccess(result, labelForMode(state.to)),
        });
      } else {
        message.warning({
          key: IN_FLIGHT_TOAST_KEY,
          content: summarizeDiscardFailure(result),
        });
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
      source={dialogState.verdict.source}
      target={dialogState.verdict.target}
      nameCollisions={dialogState.verdict.nameCollisions}
      onChoose={(c, options) => {
        void handleDialogChoose(c, options);
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
