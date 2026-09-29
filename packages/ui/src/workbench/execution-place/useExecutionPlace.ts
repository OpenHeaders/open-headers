/**
 * useExecutionPlace — the live wrapper over {@link resolveExecutionPlace}:
 * reads the capability markers once per render, the desktop app's
 * companion state through the ONE shared derivation
 * (`useDesktopCompanion` — the status row's), the workspace's server
 * through `useWorkspaceServer`, and hands the pure reader the
 * per-editor transport facts and the resolved preference (the per-send
 * pick today; the settings layers fold in beneath it). Beside the
 * resolution it names the send's TARGET — the resolved place's backend
 * record by explicit id (the desktop app's record, the workspace
 * server's) — for the send frame; null when the socket opens here or
 * the surface's wire already forwards by construction (the web tab).
 */

import type { ExecutionPlaceTarget } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { desktopAppRecord, useBackends } from '@openheaders/ui/shared/backend';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { useDesktopCompanion } from '@openheaders/ui/shared/status';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { useMemo } from 'react';
import {
  type ExecutionPlaceInput,
  type ExecutionPlaceMarkers,
  type ExecutionPlacePreference,
  type ExecutionPlaceResolution,
  type ExecutionPlaceRosterRow,
  type ExecutionRequestKind,
  type MqttTransport,
  type PageSessionKnob,
  resolveExecutionPlace,
  resolveExecutionPlaceRoster,
} from './resolve-execution-place';
import { useWorkspaceServer } from './useWorkspaceServer';

export interface UseExecutionPlaceInput {
  kind: ExecutionRequestKind;
  mqttTransport?: MqttTransport;
  /** Memoized by the caller — identity drives the resolution memo. */
  inapplicableKnobs?: readonly PageSessionKnob[];
  /** The per-send pick (or the settings layers' role); absent = Auto. */
  preference?: ExecutionPlacePreference;
  /** Memoized by the caller — the context's knobs a delegated socket cannot honour. */
  delegationKnobs?: readonly PageSessionKnob[];
}

export interface UseExecutionPlaceResult extends ExecutionPlaceResolution {
  /** The backend the send names when its socket opens elsewhere; null when here. */
  target: ExecutionPlaceTarget | null;
  /** Every place this host knows for this send, available or not — the picker's rows. */
  roster: readonly ExecutionPlaceRosterRow[];
}

function readMarkers(): ExecutionPlaceMarkers {
  return {
    requestRuntime: getCapability('requestRuntime')?.() ?? 'browser',
    remoteRequestDispatch: getCapability('remoteRequestDispatch')?.() ?? null,
    wsPageSession: getCapability('wsPageSession')?.() ?? false,
    mqttPageSession: getCapability('mqttPageSession')?.() ?? false,
    delegatedRequestDispatch: getCapability('delegatedRequestDispatch')?.() ?? false,
    delegatedSessionDispatch: getCapability('delegatedSessionDispatch')?.() ?? false,
    delegatedGrpcDispatch: getCapability('delegatedGrpcDispatch')?.() ?? false,
  };
}

export function useExecutionPlace({
  kind,
  mqttTransport,
  inapplicableKnobs,
  preference,
  delegationKnobs,
}: UseExecutionPlaceInput): UseExecutionPlaceResult {
  const { state: desktopApp, launchable } = useDesktopCompanion();
  const backends = useBackends();
  const desktopAppBackendId = desktopAppRecord(getCurrentHost(), backends)?.id ?? null;
  const server = useWorkspaceServer();
  // This device's own consent for a server place — the one switch
  // under Settings › API Requests; false withholds the server leg
  // from every send on this device.
  const serverAllowed = useSettingValue('requests.allowServerExecution');
  const markers = readMarkers();
  const {
    requestRuntime,
    remoteRequestDispatch,
    wsPageSession,
    mqttPageSession,
    delegatedRequestDispatch,
    delegatedSessionDispatch,
    delegatedGrpcDispatch,
  } = markers;
  return useMemo(() => {
    const input: ExecutionPlaceInput = {
      kind,
      markers: {
        requestRuntime,
        remoteRequestDispatch,
        wsPageSession,
        mqttPageSession,
        delegatedRequestDispatch,
        delegatedSessionDispatch,
        delegatedGrpcDispatch,
      },
      ...(mqttTransport !== undefined ? { mqttTransport } : {}),
      desktopApp,
      desktopAppLaunchable: launchable,
      ...(server !== null ? { workspaceServer: { name: server.name, connected: server.connected } } : {}),
      ...(serverAllowed ? {} : { serverAllowed: false }),
      ...(preference !== undefined ? { preference } : {}),
      ...(inapplicableKnobs !== undefined ? { inapplicableKnobs } : {}),
      ...(delegationKnobs !== undefined ? { delegationKnobs } : {}),
    };
    const resolution = resolveExecutionPlace(input);
    return {
      ...resolution,
      target: targetOf(resolution, desktopAppBackendId, server?.backendId ?? null),
      roster: resolveExecutionPlaceRoster(input),
    };
  }, [
    kind,
    requestRuntime,
    remoteRequestDispatch,
    wsPageSession,
    mqttPageSession,
    delegatedRequestDispatch,
    delegatedSessionDispatch,
    delegatedGrpcDispatch,
    mqttTransport,
    desktopApp,
    launchable,
    desktopAppBackendId,
    server,
    serverAllowed,
    preference,
    inapplicableKnobs,
    delegationKnobs,
  ]);
}

/** The explicit backend a READY delegated send names — its socket
 *  opens on another record of this surface's, the desktop app or the
 *  server; a context send on a remote-dispatch surface rides the
 *  surface's one wire and names nothing. */
function targetOf(
  resolution: ExecutionPlaceResolution,
  desktopAppBackendId: string | null,
  serverBackendId: string | null,
): ExecutionPlaceTarget | null {
  if (resolution.state !== 'ready' || resolution.reason.kind !== 'delegated') return null;
  const backendId = resolution.place === 'desktop-app' ? desktopAppBackendId : serverBackendId;
  return backendId !== null ? { backendId } : null;
}
