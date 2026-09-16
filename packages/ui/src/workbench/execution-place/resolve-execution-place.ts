/**
 * resolveExecutionPlace — the ONE reader that says where a request
 * would run, why, and what to do about it (the Execution Place plan:
 * "Execution context and reach"). Pure: the hosts' capability markers
 * and the live companion state come in, a resolution comes out; no
 * editor computes "where" on its own after this lands.
 *
 * Vocabulary (the place law): a request runs `here` (this surface's
 * own engine — the desktop app's node stack, the extension's service
 * worker fetch, the extension's page-realm socket), on the
 * `desktop-app` on this device, or on the `workspace-server` (the
 * workspace's own providing backend). Capabilities never name the
 * host — the reader branches off the markers alone.
 *
 * The matrix (S1 rendered today's truth; S2 opened the HTTP legs):
 *   - a surface whose sends run on a remote place (`remoteRequestDispatch`
 *     — the web tab) resolves to that server: HTTP / GraphQL query as
 *     a CONTEXT send (resolved there — Phase W makes the tab a context
 *     of its own), the three session kinds as `unsupported` with the
 *     honest "not forwarded yet" reason (Phase W flips the row);
 *   - a node runtime runs everything here;
 *   - a browser runtime runs HTTP / GraphQL query here, sessions here
 *     in the page realm (`wsPageSession` / `mqttPageSession`) naming
 *     the node-only knobs it cannot apply, gRPC on the connected
 *     desktop app (`grpcCompanionInvoke`), and an mqtt(s):// session
 *     NOWHERE yet — `needs-companion` with the desktop-app CTA ladder
 *     (Phase D delegates it and flips the row to `ready`).
 *
 * The legs (Phase C): on a surface whose send honours an explicit
 * place (`delegatedRequestDispatch`), an HTTP / GraphQL query send can
 * be DELEGATED — resolved here, the socket opened by the connected
 * desktop app (a browser surface) or by the workspace's own server
 * (any surface). Those are `alternatives` beside the auto place, and a
 * `preference` naming one resolves to it (`reason: delegated`); a
 * preference naming a role no leg can honour is `unsupported`, never
 * silently overridden — with the companion ladder as its CTA when the
 * role is the desktop app. Sessions and gRPC carry no alternatives yet
 * (Phase D).
 *
 * Refusal (the daemon's two-tier opt-in) is a run-time answer on the
 * response surface (`PeerExecuteDisabledNotice`), not a pre-send
 * state — the reader never guesses it.
 */

import type { RequestRuntimeKind } from '@openheaders/core/capabilities';
import type { DesktopCompanionState } from '@openheaders/ui/shared/status';

export type ExecutionRequestKind = 'http' | 'graphql-query' | 'graphql-subscription' | 'grpc' | 'websocket' | 'mqtt';

export type ExecutionPlaceRole = 'here' | 'desktop-app' | 'workspace-server';

export type ExecutionPlacePreference = 'auto' | ExecutionPlaceRole;

export type ExecutionPlaceState = 'ready' | 'needs-companion' | 'unsupported';

/** The MQTT dial transport by URL scheme — ws(s):// rides a WebSocket
 *  any page can open; mqtt(s):// dials a raw TCP socket no page can. */
export type MqttTransport = 'websocket' | 'tcp' | 'unknown';

/** Node-only knobs configured on a draft that a page-realm session
 *  cannot apply — named at the control, never silently dropped. */
export type PageSessionKnob = 'headers' | 'sslVerify' | 'auth';

/** The capability markers the reader derives from — read once by the
 *  caller (`getCapability`), absent markers as their defaults. */
export interface ExecutionPlaceMarkers {
  requestRuntime: RequestRuntimeKind;
  /** The serving place's name on a surface whose sends run remotely; null elsewhere. */
  remoteRequestDispatch: string | null;
  grpcCompanionInvoke: boolean;
  wsPageSession: boolean;
  mqttPageSession: boolean;
  /** The surface's HTTP send honours an explicit place — the delegated legs exist. */
  delegatedRequestDispatch: boolean;
  /** The surface's session Connect honours an explicit place — the socket legs exist. */
  delegatedSessionDispatch: boolean;
}

/** The workspace's own providing server, when it has one — the
 *  `workspace-server` role's live state (the org binding's record). */
export interface WorkspaceServerState {
  /** The place's name (the label, the group, the host) — null when nameless. */
  name: string | null;
  connected: boolean;
}

export interface ExecutionPlaceInput {
  kind: ExecutionRequestKind;
  markers: ExecutionPlaceMarkers;
  /** MQTT only — see {@link mqttTransportOf}. */
  mqttTransport?: MqttTransport;
  /** The desktop app on this device, the companion row's derivation. */
  desktopApp: DesktopCompanionState;
  /** `desktopLaunch` registered AND the NM host anchored to a launchable install. */
  desktopAppLaunchable: boolean;
  /** The workspace's server, by the place rule; absent = the workspace has none. */
  workspaceServer?: WorkspaceServerState;
  /** The resolved role from the settings layers or the per-send pick; absent = Auto. */
  preference?: ExecutionPlacePreference;
  /** Knobs a page-realm session would leave unapplied (the draft's, before Connect). */
  inapplicableKnobs?: readonly PageSessionKnob[];
}

export type ExecutionPlaceReason =
  /** A node runtime — the surface's own engine runs every kind. */
  | { kind: 'runs-here' }
  /** The extension's service-worker fetch. */
  | { kind: 'runs-here-browser' }
  /** A session over the browser socket, with the knobs it cannot apply. */
  | { kind: 'runs-here-page-realm'; knobs: readonly PageSessionKnob[] }
  /** Forwarded to the serving place and RESOLVED there (the web tab until Phase W). */
  | { kind: 'context-send'; name: string | null }
  /** A gRPC invoke forwarded to the connected desktop app. */
  | { kind: 'companion-invoke' }
  /** A gRPC invoke with no connected desktop app. */
  | { kind: 'companion-required' }
  /** An mqtt(s):// session — raw TCP no page can open; needs the desktop app. */
  | { kind: 'tcp-scheme' }
  /** A session kind on a remote-dispatch surface — the channel is not forwarded yet. */
  | { kind: 'session-not-forwarded'; name: string | null }
  /** A browser surface with neither an engine nor a page-realm socket for this kind. */
  | { kind: 'no-runtime' }
  /** Resolved here; the chosen place opens the socket on this send's behalf. */
  | { kind: 'delegated'; role: Exclude<ExecutionPlaceRole, 'here'> }
  /** A preferred role no leg can honour yet. */
  | { kind: 'preference-unavailable'; preferred: ExecutionPlaceRole };

/** The primary call to action for a missing companion — the status
 *  row's ladder (`companion-rows.tsx`), one rung at a time. */
export type ExecutionPlaceCta =
  | 'reveal-desktop-app'
  | 'launch-desktop-app'
  | 'connect-desktop-app'
  | 'download-desktop-app'
  | null;

export interface ExecutionPlaceResolution {
  /** Where the send runs when `ready`; the place it NEEDS otherwise. */
  place: ExecutionPlaceRole;
  /** The server place's name for `workspace-server`; null for the other roles. */
  placeName: string | null;
  state: ExecutionPlaceState;
  reason: ExecutionPlaceReason;
  cta: ExecutionPlaceCta;
  /** The other eligible places for this send — the picker's rows beside `place`. */
  alternatives: readonly ExecutionPlaceRole[];
  /** The workspace server's name whenever the workspace has one — the picker's row label. */
  serverName?: string | null;
}

const NO_ALTERNATIVES: readonly ExecutionPlaceRole[] = [];

export function mqttTransportOf(url: string): MqttTransport {
  const trimmed = url.trim();
  if (/^mqtts?:\/\//i.test(trimmed)) return 'tcp';
  if (/^wss?:\/\//i.test(trimmed)) return 'websocket';
  return 'unknown';
}

export function isSessionKind(kind: ExecutionRequestKind): boolean {
  return kind === 'websocket' || kind === 'mqtt' || kind === 'graphql-subscription';
}

export function resolveExecutionPlace(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const resolution = resolvePreferred(input);
  return input.workspaceServer !== undefined ? { ...resolution, serverName: input.workspaceServer.name } : resolution;
}

function resolvePreferred(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const auto = resolveAuto(input);
  const preference = input.preference ?? 'auto';
  if (preference === 'auto' || preference === auto.place) return auto;
  if (auto.alternatives.includes(preference)) {
    const others = [auto.place, ...auto.alternatives.filter((role) => role !== preference)];
    // Picking "here" back from a delegated auto (a tcp dial never
    // resolves here, so this arm is the ws(s) kinds' and HTTP's).
    if (preference === 'here') return { ...auto, place: 'here', placeName: null, alternatives: others };
    return delegatedTo(preference, others, input);
  }
  // The places that ARE possible stay on offer — the user picks back.
  return {
    place: preference,
    placeName: null,
    state: 'unsupported',
    reason: { kind: 'preference-unavailable', preferred: preference },
    cta: preference === 'desktop-app' ? companionCta(input) : null,
    alternatives: auto.state === 'ready' ? [auto.place, ...auto.alternatives] : auto.alternatives,
  };
}

/** The places that could open this send's socket on its behalf,
 *  beside the surface's own — a transport fact under the live
 *  connection state, offered only where the send honours a place
 *  (the HTTP send's marker for HTTP / GraphQL query, the session
 *  Connect's for the three session kinds). */
function delegatedLegs(input: ExecutionPlaceInput): readonly ExecutionPlaceRole[] {
  const honoured = isSessionKind(input.kind)
    ? input.markers.delegatedSessionDispatch
    : input.markers.delegatedRequestDispatch;
  if (!honoured) return NO_ALTERNATIVES;
  const legs: ExecutionPlaceRole[] = [];
  if (input.markers.requestRuntime !== 'node' && input.desktopApp === 'connected') legs.push('desktop-app');
  if (input.workspaceServer?.connected === true) legs.push('workspace-server');
  return legs.length > 0 ? legs : NO_ALTERNATIVES;
}

function resolveAuto(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const { kind, markers } = input;
  const serving = markers.remoteRequestDispatch;
  if (serving !== null) {
    if (isSessionKind(kind)) {
      return remote(serving, 'unsupported', { kind: 'session-not-forwarded', name: serving });
    }
    return remote(serving, 'ready', { kind: 'context-send', name: serving });
  }
  const legs = kind === 'grpc' ? NO_ALTERNATIVES : delegatedLegs(input);
  if (markers.requestRuntime === 'node') return here({ kind: 'runs-here' }, legs);
  const knobs = input.inapplicableKnobs ?? [];
  switch (kind) {
    case 'http':
    case 'graphql-query':
      return here({ kind: 'runs-here-browser' }, legs);
    case 'grpc': {
      if (!markers.grpcCompanionInvoke) return needsDesktopApp('unsupported', { kind: 'no-runtime' }, null);
      if (input.desktopApp === 'connected') {
        return {
          place: 'desktop-app',
          placeName: null,
          state: 'ready',
          reason: { kind: 'companion-invoke' },
          cta: null,
          alternatives: NO_ALTERNATIVES,
        };
      }
      return needsDesktopApp('needs-companion', { kind: 'companion-required' }, companionCta(input));
    }
    case 'websocket':
    case 'graphql-subscription':
      if (!markers.wsPageSession) return needsDesktopApp('unsupported', { kind: 'no-runtime' }, null);
      return here({ kind: 'runs-here-page-realm', knobs }, legs);
    case 'mqtt':
      if (!markers.mqttPageSession) return needsDesktopApp('unsupported', { kind: 'no-runtime' }, null);
      if (input.mqttTransport === 'tcp') {
        // The raw TCP dial no page can make — Auto is the ONE eligible
        // place when a leg exists (the reporter's case, runnable from
        // the extension with the desktop app connected); else the
        // honest companion state with the ladder rung.
        const [first, ...rest] = legs;
        if (first !== undefined) return delegatedTo(first, rest, input);
        return needsDesktopApp('needs-companion', { kind: 'tcp-scheme' }, companionCta(input));
      }
      return here({ kind: 'runs-here-page-realm', knobs }, legs);
  }
}

function delegatedTo(
  role: ExecutionPlaceRole,
  alternatives: readonly ExecutionPlaceRole[],
  input: ExecutionPlaceInput,
): ExecutionPlaceResolution {
  if (role === 'here') return here({ kind: 'runs-here' }, alternatives);
  return {
    place: role,
    placeName: role === 'workspace-server' ? (input.workspaceServer?.name ?? null) : null,
    state: 'ready',
    reason: { kind: 'delegated', role },
    cta: null,
    alternatives,
  };
}

function here(
  reason: ExecutionPlaceReason,
  alternatives: readonly ExecutionPlaceRole[] = NO_ALTERNATIVES,
): ExecutionPlaceResolution {
  return { place: 'here', placeName: null, state: 'ready', reason, cta: null, alternatives };
}

function remote(name: string, state: ExecutionPlaceState, reason: ExecutionPlaceReason): ExecutionPlaceResolution {
  return { place: 'workspace-server', placeName: name, state, reason, cta: null, alternatives: NO_ALTERNATIVES };
}

function needsDesktopApp(
  state: ExecutionPlaceState,
  reason: ExecutionPlaceReason,
  cta: ExecutionPlaceCta,
): ExecutionPlaceResolution {
  return { place: 'desktop-app', placeName: null, state, reason, cta, alternatives: NO_ALTERNATIVES };
}

/** One rung of the companion ladder by live state: a connected app
 *  can be fronted; a paired-but-down app launched (anchored installs
 *  only); an installed-never-paired app connected; a missing app
 *  downloaded. Connecting, disabled and unresolved carry no action. */
function companionCta(input: Pick<ExecutionPlaceInput, 'desktopApp' | 'desktopAppLaunchable'>): ExecutionPlaceCta {
  switch (input.desktopApp) {
    case 'connected':
      return 'reveal-desktop-app';
    case 'not-connected':
      return input.desktopAppLaunchable ? 'launch-desktop-app' : null;
    case 'installed-not-connected':
      return 'connect-desktop-app';
    case 'not-installed':
      return 'download-desktop-app';
    default:
      return null;
  }
}
