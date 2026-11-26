/**
 * The device's place facts and the pure reader over them — what
 * `useExecutionPlace` gathers live for an editor (the capability markers,
 * the desktop app's companion state and record, the workspace's server,
 * this device's server switch), split from the hook so a caller that is
 * not an editor — a workflow run that lives in the page — resolves a
 * request's place from the same facts by the same rule. Beside the
 * resolution it names the send's TARGET: the resolved place's backend
 * record by explicit id (the desktop app's record, the workspace
 * server's); null when the socket opens here or the surface's wire
 * already forwards by construction (the web tab).
 */

import type { ExecutionPlaceTarget } from '@openheaders/core/bridge';
import type { DesktopCompanionState } from '@openheaders/ui/shared/status';
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
import type { WorkspaceServer } from './useWorkspaceServer';

export interface ExecutionPlaceFacts {
  markers: ExecutionPlaceMarkers;
  desktopApp: DesktopCompanionState;
  /** `desktopLaunch` registered AND the NM host anchored to a launchable install. */
  desktopAppLaunchable: boolean;
  /** The desktop app's backend record on this surface; null when it holds none. */
  desktopAppBackendId: string | null;
  /** The workspace's server; null when the workspace has none. */
  server: WorkspaceServer | null;
  /** This device's own consent for a server place (Settings › API Requests). */
  serverAllowed: boolean;
}

/** What one send brings to the reader beside the device's facts. */
export interface ExecutionPlaceRequest {
  kind: ExecutionRequestKind;
  mqttTransport?: MqttTransport;
  /** Memoized by the caller — identity drives the resolution memo. */
  inapplicableKnobs?: readonly PageSessionKnob[];
  /** The per-send pick (or the settings layers' role); absent = Auto. */
  preference?: ExecutionPlacePreference;
  /** Memoized by the caller — the context's knobs a delegated socket cannot honour. */
  delegationKnobs?: readonly PageSessionKnob[];
  /** The draft's referenced secret-manager rows, counted (`useSecretManagerReferenceCount`). */
  secretManagerReferences?: number;
}

export interface ResolvedExecutionPlace extends ExecutionPlaceResolution {
  /** The backend the send names when its socket opens elsewhere; null when here. */
  target: ExecutionPlaceTarget | null;
  /** Every place this host knows for this send, available or not — the picker's rows. */
  roster: readonly ExecutionPlaceRosterRow[];
}

export function resolveExecutionPlaceFromFacts(
  facts: ExecutionPlaceFacts,
  request: ExecutionPlaceRequest,
): ResolvedExecutionPlace {
  const { markers, server } = facts;
  const { mqttTransport, preference, inapplicableKnobs, delegationKnobs, secretManagerReferences } = request;
  const input: ExecutionPlaceInput = {
    kind: request.kind,
    markers,
    ...(mqttTransport !== undefined ? { mqttTransport } : {}),
    desktopApp: facts.desktopApp,
    desktopAppLaunchable: facts.desktopAppLaunchable,
    ...(server !== null ? { workspaceServer: { name: server.name, connected: server.connected } } : {}),
    ...(facts.serverAllowed ? {} : { serverAllowed: false }),
    ...(preference !== undefined ? { preference } : {}),
    ...(inapplicableKnobs !== undefined ? { inapplicableKnobs } : {}),
    ...(delegationKnobs !== undefined ? { delegationKnobs } : {}),
    ...(secretManagerReferences !== undefined ? { secretManagerReferences } : {}),
  };
  const resolution = resolveExecutionPlace(input);
  // The served tab has one place by construction and its seam leases
  // that wire for every send, whatever the frame says: the frame
  // names nothing there (the S4 rule), the server read only names it.
  const serverBackendId = markers.remoteRequestDispatch === null ? (server?.backendId ?? null) : null;
  return {
    ...resolution,
    target: targetOf(resolution, facts.desktopAppBackendId, serverBackendId),
    roster: resolveExecutionPlaceRoster(input),
  };
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
