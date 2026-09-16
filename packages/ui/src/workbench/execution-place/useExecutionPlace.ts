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
import { useMemo } from 'react';
import {
  type ExecutionPlaceMarkers,
  type ExecutionPlacePreference,
  type ExecutionPlaceResolution,
  type ExecutionRequestKind,
  type MqttTransport,
  type PageSessionKnob,
  resolveExecutionPlace,
} from './resolve-execution-place';
import { useWorkspaceServer } from './useWorkspaceServer';

export interface UseExecutionPlaceInput {
  kind: ExecutionRequestKind;
  mqttTransport?: MqttTransport;
  /** Memoized by the caller — identity drives the resolution memo. */
  inapplicableKnobs?: readonly PageSessionKnob[];
  /** The per-send pick (or the settings layers' role); absent = Auto. */
  preference?: ExecutionPlacePreference;
}

export interface UseExecutionPlaceResult extends ExecutionPlaceResolution {
  /** The backend the send names when its socket opens elsewhere; null when here. */
  target: ExecutionPlaceTarget | null;
}

function readMarkers(): ExecutionPlaceMarkers {
  return {
    requestRuntime: getCapability('requestRuntime')?.() ?? 'browser',
    remoteRequestDispatch: getCapability('remoteRequestDispatch')?.() ?? null,
    grpcCompanionInvoke: getCapability('grpcCompanionInvoke')?.() ?? false,
    wsPageSession: getCapability('wsPageSession')?.() ?? false,
    mqttPageSession: getCapability('mqttPageSession')?.() ?? false,
    delegatedRequestDispatch: getCapability('delegatedRequestDispatch')?.() ?? false,
    delegatedSessionDispatch: getCapability('delegatedSessionDispatch')?.() ?? false,
  };
}

export function useExecutionPlace({
  kind,
  mqttTransport,
  inapplicableKnobs,
  preference,
}: UseExecutionPlaceInput): UseExecutionPlaceResult {
  const { state: desktopApp, launchable } = useDesktopCompanion();
  const backends = useBackends();
  const desktopAppBackendId = desktopAppRecord(getCurrentHost(), backends)?.id ?? null;
  const server = useWorkspaceServer();
  const markers = readMarkers();
  const {
    requestRuntime,
    remoteRequestDispatch,
    grpcCompanionInvoke,
    wsPageSession,
    mqttPageSession,
    delegatedRequestDispatch,
    delegatedSessionDispatch,
  } = markers;
  return useMemo(() => {
    const resolution = resolveExecutionPlace({
      kind,
      markers: {
        requestRuntime,
        remoteRequestDispatch,
        grpcCompanionInvoke,
        wsPageSession,
        mqttPageSession,
        delegatedRequestDispatch,
        delegatedSessionDispatch,
      },
      ...(mqttTransport !== undefined ? { mqttTransport } : {}),
      desktopApp,
      desktopAppLaunchable: launchable,
      ...(server !== null ? { workspaceServer: { name: server.name, connected: server.connected } } : {}),
      ...(preference !== undefined ? { preference } : {}),
      ...(inapplicableKnobs !== undefined ? { inapplicableKnobs } : {}),
    });
    return { ...resolution, target: targetOf(resolution, desktopAppBackendId, server?.backendId ?? null) };
  }, [
    kind,
    requestRuntime,
    remoteRequestDispatch,
    grpcCompanionInvoke,
    wsPageSession,
    mqttPageSession,
    delegatedRequestDispatch,
    delegatedSessionDispatch,
    mqttTransport,
    desktopApp,
    launchable,
    desktopAppBackendId,
    server,
    preference,
    inapplicableKnobs,
  ]);
}

/** The explicit backend a READY send names when its socket opens on
 *  another record of this surface's — the delegated legs and the gRPC
 *  companion invoke; a context send on a remote-dispatch surface rides
 *  the surface's one wire and names nothing. */
function targetOf(
  resolution: ExecutionPlaceResolution,
  desktopAppBackendId: string | null,
  serverBackendId: string | null,
): ExecutionPlaceTarget | null {
  if (resolution.state !== 'ready') return null;
  const { kind } = resolution.reason;
  if (kind !== 'delegated' && kind !== 'companion-invoke') return null;
  const backendId = resolution.place === 'desktop-app' ? desktopAppBackendId : serverBackendId;
  return backendId !== null ? { backendId } : null;
}
