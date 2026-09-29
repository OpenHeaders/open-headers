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
 * The matrix (S1 rendered today's truth; S2 opened the HTTP legs; W
 * made the web tab a context for HTTP and for the sessions; S11
 * brought gRPC under the delegated law):
 *   - a surface whose sends open their sockets on a serving place
 *     (`remoteRequestDispatch` — the web tab) resolves to that server:
 *     HTTP / GraphQL query as a DELEGATED send once the surface honours
 *     a place (`delegatedRequestDispatch` — resolved here, the one
 *     server opens the socket) and as a CONTEXT send (resolved there)
 *     before; the three session kinds as a DELEGATED session once the
 *     surface honours a place for them (`delegatedSessionDispatch` —
 *     the executor here, the server opens the socket, a tcp dial
 *     included) and as `unsupported` with the honest "not forwarded"
 *     reason before; gRPC as a context send until the tab's wire
 *     converges;
 *   - a node runtime runs everything here;
 *   - a browser runtime runs HTTP / GraphQL query here, sessions here
 *     in the page realm (`wsPageSession` / `mqttPageSession`) naming
 *     the node-only knobs it cannot apply, and gRPC NEVER here (no
 *     HTTP/2 stack with trailers): a gRPC invoke and an mqtt(s)://
 *     session resolve to the ONE eligible place by live connection —
 *     the desktop app on this device first, the workspace's server
 *     beside it or alone — as a DELEGATED call there (the executor
 *     here, the place opens the socket), else `needs-companion` with
 *     the CTA ladder.
 *
 * The legs (Phase C): on a surface whose send honours an explicit
 * place, a send can be DELEGATED — resolved here, the socket opened by
 * the connected desktop app (a browser surface) or by the workspace's
 * own server (any surface). The marker is per family:
 * `delegatedRequestDispatch` for HTTP / GraphQL query,
 * `delegatedSessionDispatch` for the three session kinds,
 * `delegatedGrpcDispatch` for gRPC. Those are `alternatives` beside
 * the auto place, and a `preference` naming one resolves to it
 * (`reason: delegated`); a preference naming a role no leg can honour
 * is `unsupported`, never silently overridden — with the companion
 * ladder as its CTA when the role is the desktop app.
 *
 * Refusal (the daemon's two-tier opt-in) is a run-time answer on the
 * response surface (`PeerExecuteDisabledNotice`), not a pre-send
 * state — the reader never guesses it.
 */

import type { RequestRuntimeKind } from '@openheaders/core/capabilities';
import type { Host } from '@openheaders/ui/shared/host-vocabulary';
import type { DesktopCompanionState } from '@openheaders/ui/shared/status';

export type ExecutionRequestKind = 'http' | 'graphql-query' | 'graphql-subscription' | 'grpc' | 'websocket' | 'mqtt';

export type ExecutionPlaceRole = 'here' | 'desktop-app' | 'workspace-server';

export type ExecutionPlacePreference = 'auto' | ExecutionPlaceRole;

export type ExecutionPlaceState = 'ready' | 'needs-companion' | 'unsupported';

/** The MQTT dial transport by URL scheme — ws(s):// rides a WebSocket
 *  any page can open; mqtt(s):// dials a raw TCP socket no page can. */
export type MqttTransport = 'websocket' | 'tcp' | 'unknown';

/** Knobs configured on a draft that the resolved place cannot apply —
 *  named at the control, never silently dropped: the node-only knobs a
 *  page-realm session leaves unapplied, and the context's cookie jar a
 *  delegated socket never sees (the browser's store on the extension,
 *  the app's jar on the desktop app — the jar key never rides). */
export type PageSessionKnob = 'headers' | 'sslVerify' | 'auth' | 'cookieJar';

/** The capability markers the reader derives from — read once by the
 *  caller (`getCapability`), absent markers as their defaults. */
export interface ExecutionPlaceMarkers {
  requestRuntime: RequestRuntimeKind;
  /** The serving place's name on a surface whose sends run remotely; null elsewhere. */
  remoteRequestDispatch: string | null;
  wsPageSession: boolean;
  mqttPageSession: boolean;
  /** The surface's HTTP send honours an explicit place — the delegated legs exist. */
  delegatedRequestDispatch: boolean;
  /** The surface's session Connect honours an explicit place — the socket legs exist. */
  delegatedSessionDispatch: boolean;
  /** The surface's gRPC Invoke honours an explicit place — the call's legs exist. */
  delegatedGrpcDispatch: boolean;
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
  /**
   * This device's own consent for a server place (Settings › API
   * Requests › Run requests on a server) — false means no send from
   * this device is offered to, or resolved to, the workspace's server:
   * the leg is withheld, the roster row says why. Absent = allowed. A
   * served tab's one server is its serving place by construction and
   * never reads this.
   */
  serverAllowed?: boolean;
  /** The resolved role from the settings layers or the per-send pick; absent = Auto. */
  preference?: ExecutionPlacePreference;
  /** Knobs a page-realm session would leave unapplied (the draft's, before Connect). */
  inapplicableKnobs?: readonly PageSessionKnob[];
  /** Knobs the context applies on its own socket that a delegated one
   *  cannot honour (the HTTP send's cookie jar) — named only when the
   *  send resolves to another place. */
  delegationKnobs?: readonly PageSessionKnob[];
}

export type ExecutionPlaceReason =
  /** A node runtime — the surface's own engine runs every kind. */
  | { kind: 'runs-here' }
  /** The extension's service-worker fetch. */
  | { kind: 'runs-here-browser' }
  /** A session over the browser socket, with the knobs it cannot apply. */
  | { kind: 'runs-here-page-realm'; knobs: readonly PageSessionKnob[] }
  /** Forwarded to the serving place and RESOLVED there (the web tab's gRPC until its wire converges). */
  | { kind: 'context-send'; name: string | null }
  /** A kind no place this surface can reach opens — a gRPC invoke with no connected desktop app or server. */
  | { kind: 'companion-required' }
  /** An mqtt(s):// session — raw TCP no page can open; needs the desktop app. */
  | { kind: 'tcp-scheme' }
  /** A session kind on a remote-dispatch surface whose Connect honours no place. */
  | { kind: 'session-not-forwarded'; name: string | null }
  /** A browser surface with neither an engine nor a page-realm socket for this kind. */
  | { kind: 'no-runtime' }
  /** Resolved here; the chosen place opens the socket on this send's
   *  behalf — with the context's knobs that socket cannot honour. */
  | { kind: 'delegated'; role: Exclude<ExecutionPlaceRole, 'here'>; knobs: readonly PageSessionKnob[] }
  /** A preferred role no leg can honour yet. */
  | { kind: 'preference-unavailable'; preferred: ExecutionPlaceRole }
  /** The server was preferred, and this device's own switch keeps every send off any server. */
  | { kind: 'server-off' };

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
const NO_KNOBS: readonly PageSessionKnob[] = [];

export function mqttTransportOf(url: string): MqttTransport {
  const trimmed = url.trim();
  if (/^mqtts?:\/\//i.test(trimmed)) return 'tcp';
  if (/^wss?:\/\//i.test(trimmed)) return 'websocket';
  return 'unknown';
}

export function isSessionKind(kind: ExecutionRequestKind): boolean {
  return kind === 'websocket' || kind === 'mqtt' || kind === 'graphql-subscription';
}

/** Whether the surface honours an explicit place for this kind — the
 *  family's marker: the HTTP send's, the session Connect's, the gRPC
 *  Invoke's. */
function placeHonoured(kind: ExecutionRequestKind, markers: ExecutionPlaceMarkers): boolean {
  if (kind === 'grpc') return markers.delegatedGrpcDispatch;
  return isSessionKind(kind) ? markers.delegatedSessionDispatch : markers.delegatedRequestDispatch;
}

export function resolveExecutionPlace(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const resolution = resolvePreferred(input);
  return input.workspaceServer !== undefined ? { ...resolution, serverName: input.workspaceServer.name } : resolution;
}

function resolvePreferred(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const auto = resolveAuto(input);
  const preference = input.preference ?? 'auto';
  if (preference === 'auto' || preference === auto.place) return auto;
  // The server was asked for by this request or the global row while
  // this device's own switch keeps every send off any server: the
  // switch wins, and the reason names it rather than a missing leg.
  if (
    preference === 'workspace-server' &&
    input.serverAllowed === false &&
    input.markers.remoteRequestDispatch === null
  ) {
    return {
      place: 'workspace-server',
      placeName: input.workspaceServer?.name ?? null,
      state: 'unsupported',
      reason: { kind: 'server-off' },
      cta: null,
      alternatives: auto.state === 'ready' ? [auto.place, ...auto.alternatives] : auto.alternatives,
    };
  }
  if (auto.alternatives.includes(preference)) {
    const others = [auto.place, ...auto.alternatives.filter((role) => role !== preference)];
    // Picking "here" back from a delegated auto (a tcp dial and a gRPC
    // invoke never resolve here, so this arm is the ws(s) kinds' and
    // HTTP's).
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
 *  (the family's marker). */
function delegatedLegs(input: ExecutionPlaceInput): readonly ExecutionPlaceRole[] {
  if (!placeHonoured(input.kind, input.markers)) return NO_ALTERNATIVES;
  const legs: ExecutionPlaceRole[] = [];
  if (input.markers.requestRuntime !== 'node' && input.desktopApp === 'connected') legs.push('desktop-app');
  if (serverReachable(input)) legs.push('workspace-server');
  return legs.length > 0 ? legs : NO_ALTERNATIVES;
}

/** The workspace's server as a place this device may send to: its
 *  wire up AND this device's own switch not withholding it. */
function serverReachable(input: ExecutionPlaceInput): boolean {
  return input.workspaceServer?.connected === true && input.serverAllowed !== false;
}

function resolveAuto(input: ExecutionPlaceInput): ExecutionPlaceResolution {
  const { kind, markers } = input;
  const serving = markers.remoteRequestDispatch;
  if (serving !== null) {
    // Phase W: a serving surface whose send or Connect honours a place
    // is a CONTEXT of its own — resolved here, the serving place opens
    // the socket (a delegated send with the one server, no
    // alternatives; a session's tcp dial included, the place dials raw
    // TCP). A surface that honours no place for the family keeps the
    // honest row: the context send for HTTP (resolved there), the
    // not-forwarded state for a session. gRPC keeps the context-send
    // row (its channel forwards by construction) until the tab's
    // wire converges.
    const honoured = placeHonoured(kind, markers);
    if (isSessionKind(kind) && !honoured) {
      return remote(serving, 'unsupported', { kind: 'session-not-forwarded', name: serving });
    }
    if (kind !== 'grpc' && honoured) {
      return remote(serving, 'ready', {
        kind: 'delegated',
        role: 'workspace-server',
        knobs: input.delegationKnobs ?? NO_KNOBS,
      });
    }
    return remote(serving, 'ready', { kind: 'context-send', name: serving });
  }
  const legs = delegatedLegs(input);
  if (markers.requestRuntime === 'node') return here({ kind: 'runs-here' }, legs);
  const knobs = input.inapplicableKnobs ?? [];
  switch (kind) {
    case 'http':
    case 'graphql-query':
      return here({ kind: 'runs-here-browser' }, legs);
    case 'grpc': {
      if (!markers.delegatedGrpcDispatch) return needsDesktopApp('unsupported', { kind: 'no-runtime' }, null);
      // The HTTP/2 session with trailers no browser can open — Auto is
      // the FIRST eligible place by live connection: the desktop app
      // on this device, the workspace's server beside it or alone; else
      // the honest companion state with the ladder rung.
      const [first, ...rest] = legs;
      if (first !== undefined) return delegatedTo(first, rest, input);
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
    reason: { kind: 'delegated', role, knobs: input.delegationKnobs ?? NO_KNOBS },
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

// ── The roster ──────────────────────────────────────────────────────
//
// The picker's model: EVERY place this host knows, in a fixed order,
// each available or not with the reason and the rung — the hosted
// clients' agent-picker shape. A browser surface lists its own
// extension, the desktop app on this machine and the workspace's
// server; the desktop app lists itself and the server; the served tab
// lists its one server. Availability is the resolution's own rule
// (the transport the kind needs under the live connections), so the
// resolved place is always an available row.

/** The places a host knows, in the roster's order — the Runs on row's
 *  choices (the popover adds availability from the live input). */
export function executionPlaceRosterRoles(host: Host): readonly ExecutionPlaceRole[] {
  switch (host) {
    case 'extension':
      return ['here', 'desktop-app', 'workspace-server'];
    case 'desktop':
      return ['here', 'workspace-server'];
    case 'web':
      return ['workspace-server'];
  }
}

export type ExecutionPlaceRosterReason =
  /** This surface cannot open this kind's socket (a raw TCP dial, an HTTP/2 stack with trailers). */
  | 'kind-not-here'
  /** The desktop app on this machine, by its live state. */
  | 'desktop-not-running'
  | 'desktop-not-paired'
  | 'desktop-not-installed'
  | 'desktop-connecting'
  | 'desktop-unavailable'
  /** The workspace has no providing server (a personal workspace). */
  | 'no-server'
  /** The workspace's server exists but its wire is down. */
  | 'server-not-connected'
  /** This device's own switch keeps every send off any server (Settings › API Requests). */
  | 'server-off'
  /** The surface's send does not honour a place for this kind. */
  | 'not-forwarded';

export interface ExecutionPlaceRosterRow {
  role: ExecutionPlaceRole;
  available: boolean;
  /** Why the row is disabled; null when available. */
  reason: ExecutionPlaceRosterReason | null;
  /** The rung that could make the row available — the desktop ladder. */
  cta: ExecutionPlaceCta;
}

function desktopReason(state: DesktopCompanionState): ExecutionPlaceRosterReason {
  switch (state) {
    case 'not-connected':
      return 'desktop-not-running';
    case 'installed-not-connected':
      return 'desktop-not-paired';
    case 'not-installed':
      return 'desktop-not-installed';
    case 'connecting':
      return 'desktop-connecting';
    default:
      return 'desktop-unavailable';
  }
}

/** Whether this surface's own engine can open the kind's socket. */
function runsHere(input: ExecutionPlaceInput): boolean {
  const { kind, markers } = input;
  if (markers.requestRuntime === 'node') return true;
  switch (kind) {
    case 'http':
    case 'graphql-query':
      return true;
    case 'websocket':
    case 'graphql-subscription':
      return markers.wsPageSession;
    case 'mqtt':
      return markers.mqttPageSession && input.mqttTransport !== 'tcp';
    case 'grpc':
      return false;
  }
}

function serverRow(input: ExecutionPlaceInput, honoured: boolean): ExecutionPlaceRosterRow {
  const server = input.workspaceServer;
  if (server === undefined) return { role: 'workspace-server', available: false, reason: 'no-server', cta: null };
  // The user's own switch comes before the wire: a server they turned
  // off on this device is not offered, connected or not.
  if (input.serverAllowed === false)
    return { role: 'workspace-server', available: false, reason: 'server-off', cta: null };
  if (!honoured) return { role: 'workspace-server', available: false, reason: 'not-forwarded', cta: null };
  if (!server.connected)
    return { role: 'workspace-server', available: false, reason: 'server-not-connected', cta: null };
  return { role: 'workspace-server', available: true, reason: null, cta: null };
}

export function resolveExecutionPlaceRoster(input: ExecutionPlaceInput): readonly ExecutionPlaceRosterRow[] {
  const { kind, markers } = input;
  const honoured = placeHonoured(kind, markers);
  if (markers.remoteRequestDispatch !== null) {
    // The served tab: one place, its server — forwarded by construction
    // for HTTP and gRPC, honoured or not for a session.
    const available = kind === 'grpc' || !isSessionKind(kind) || honoured;
    return [{ role: 'workspace-server', available, reason: available ? null : 'not-forwarded', cta: null }];
  }
  if (markers.requestRuntime === 'node') {
    return [{ role: 'here', available: true, reason: null, cta: null }, serverRow(input, honoured)];
  }
  const here: ExecutionPlaceRosterRow = runsHere(input)
    ? { role: 'here', available: true, reason: null, cta: null }
    : { role: 'here', available: false, reason: 'kind-not-here', cta: null };
  // Every kind reaches the desktop app over its family's delegated leg
  // — the app connected, the family honoured.
  const desktop: ExecutionPlaceRosterRow =
    honoured && input.desktopApp === 'connected'
      ? { role: 'desktop-app', available: true, reason: null, cta: null }
      : {
          role: 'desktop-app',
          available: false,
          reason: honoured ? desktopReason(input.desktopApp) : 'not-forwarded',
          cta: honoured ? companionCta(input) : null,
        };
  return [here, desktop, serverRow(input, honoured)];
}
