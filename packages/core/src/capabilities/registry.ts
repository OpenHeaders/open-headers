/**
 * Host capability registry — the seam between shared UI code and the
 * platform-specific features each shell happens to support. Conceptually
 * the same shape as the other host-neutral seams (`hostBridge`,
 * `hostLogger`, `hostStorage`): UI imports the capability accessor and
 * doesn't care which shell is running.
 *
 * **Why this exists.** The shared `@openheaders/ui` package is
 * chrome-free; it can't assume the host has a popup, a tray, a
 * declarativeNetRequest engine, or a multi-window model. Hosts (the
 * desktop renderer, the extension popup / panel / sidepanel, a future
 * web app) install only the capabilities they support at boot;
 * everything else reads as `undefined`, and shared code branches
 * cleanly off `hasCapability`.
 *
 * **Compared to `hostBridge`.** `hostBridge` is a single typed RPC
 * channel. Capabilities are a heterogeneous map of named features with
 * varying signatures (sync state readers, async one-shots, subscription
 * registrations). Anything that's universal to every host long-term
 * belongs in a dedicated seam (`hostBridge`, `hostStorage`, …);
 * anything that's optional per host belongs here.
 *
 * **What a capability is.** A typed function value. Optional in the
 * {@link Capabilities} interface (`name?: signature`) means the
 * capability is host-specific; required means every shell must
 * register it (typecheck doesn't enforce this — it's a contract).
 *
 * **Usage.**
 *
 * ```ts
 * // boot — desktop renderer
 * registerCapability('getActiveWorkspaceId', () =>
 *   hostBridge.call('getActiveWorkspaceId'));
 *
 * // shared UI
 * const probe = getCapability('getActiveWorkspaceId');
 * if (probe) {
 *   const { activeWorkspaceId } = await probe();
 *   …
 * }
 * ```
 *
 * Calling twice replaces the prior implementation — tests use this to
 * swap in fakes; production code installs once at boot.
 */

import type { ChangelogIndexRow } from '../changelog-feed';
import type { CompanionRevealTarget } from '../protocol/messages';
import type { ScriptExecutionMode } from '../scripts';

/**
 * The online release-history reader behind
 * {@link Capabilities.whatsNewHistory}. Both verbs are enhancement-only
 * reads of the static changelog feed and answer null on ANY failure
 * (offline, non-200, unparseable) — callers hide the history section,
 * never surface an error; the bundled current entry is the floor.
 */
export interface WhatsNewHistoryApi {
  /** This host's stream view rows, newest first; null = feed unreachable. */
  list(): Promise<readonly ChangelogIndexRow[] | null>;
  /** One release's prose body (asset URLs absolute); null = absent/unreachable. */
  entryBody(version: string): Promise<string | null>;
}

/**
 * Input to {@link Capabilities.pairWithCode}. `url` is the back-end's
 * WebSocket URL exactly as the user configured it (`backend.url`); the
 * host implementation derives the matching HTTP origin for the daemon's
 * `/pair/<code>/confirm` route, which rides the same bound socket.
 */
export interface PairWithCodeInput {
  /** The configured back-end WebSocket URL, e.g. `ws://127.0.0.1:8137`. */
  readonly url: string;
  /** The numeric pairing code the daemon displayed. */
  readonly code: string;
  /** Optional label recorded against the minted token (Known devices, A6). */
  readonly deviceLabel?: string;
}

/**
 * Result of a code→token exchange. `unknown`/`expired`/`consumed` mirror
 * the daemon's pairing-state reasons; `unreachable`/`error` are
 * client-side transport faults (back-end down, bad URL, non-JSON reply).
 */
export type PairWithCodeResult =
  | { readonly ok: true; readonly token: string; readonly tokenId: string }
  | {
      readonly ok: false;
      readonly reason: 'unknown' | 'expired' | 'consumed' | 'unreachable' | 'error';
      readonly message?: string;
    };

/**
 * Result of one {@link Capabilities.nmAutoPair} attempt. `refused` is
 * the daemon's identity chain saying no (unsigned browser, unlisted
 * signer); `unreachable` means the host ran but no daemon answered;
 * `unavailable` means no native host is registered at all (desktop not
 * installed, no NM permission). The token, when granted, is a minted
 * `nmSession` secret ready to write into `backend.authToken`.
 */
export type NmAutoPairResult =
  | { readonly ok: true; readonly token: string; readonly browser: string }
  | { readonly ok: false; readonly reason: 'refused' | 'unreachable' | 'unavailable' };

/**
 * A newer app build the host knows about. `version` is the display
 * string ("2026.7.2"); `url` is where the user gets it (release page
 * or direct installer download). Hosts with an in-app updater (the
 * desktop app) omit `url` — the affordance then routes to the
 * Settings update row, where download/restart run in-app.
 */
export interface AppUpdateInfo {
  readonly version: string;
  readonly url?: string;
}

/**
 * A caller-chosen shell for {@link TerminalHostApi.spawn} — a terminal
 * profile. The host still owns the environment (TERM etc.) and falls
 * back to its defaults for anything omitted; `cwd` falls back to the
 * home directory when absent or unusable.
 */
export interface TerminalSpawnProfile {
  readonly shell: string;
  readonly args: readonly string[];
  readonly cwd?: string;
}

/**
 * Options for {@link TerminalHostApi.spawn}. Without `profile` the host
 * owns command resolution (the user's shell, login-mode args, home cwd,
 * TERM env) — callers describe the viewport so the pty is born at the
 * right size instead of resizing on first paint, and optionally which
 * shell to run. `cwd` is the starting directory when the profile names
 * none (or there is no profile); the host still falls back to the home
 * directory when it is absent or unusable.
 */
export interface TerminalSpawnOptions {
  readonly cols: number;
  readonly rows: number;
  readonly profile?: TerminalSpawnProfile;
  readonly cwd?: string;
}

/**
 * A live pty session. `write` carries user keystrokes verbatim;
 * `onData` streams the pty's output bytes (UTF-8 decoded) in order.
 * `onExit` fires once when the child exits — after it, every other
 * call on the session is a no-op. `dispose` kills the child and
 * releases the host-side session; unmounting UI must call it.
 */
export interface TerminalSession {
  readonly id: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(listener: (data: string) => void): () => void;
  onExit(listener: (exitCode: number) => void): () => void;
  /** True while the shell has at least one live child process — lets
   *  the UI confirm before a close terminates running work. */
  hasChildren(): Promise<boolean>;
  dispose(): void;
}

/**
 * The pty surface behind the workbench Terminal tool window. A session
 * is a REAL pty running the user's shell — the embedded program can
 * never tell it isn't in a stand-alone terminal, and nothing rides a
 * side channel past it.
 */
export interface TerminalHostApi {
  spawn(options: TerminalSpawnOptions): Promise<TerminalSession>;
}

/**
 * The network stack that executes this surface's API requests (the
 * workbench `executeRequest` channel). `'browser'` = the browser's
 * fetch inside an extension context; `'node'` = a Node fetch stack —
 * the desktop app's main process, or the daemon a web surface is
 * connected to.
 */
export type RequestRuntimeKind = 'browser' | 'node';

/**
 * Browsers an {@link Capabilities.openUrlInBrowser} call can target —
 * the extension-store install CTAs' vocabulary.
 */
export type InstallTargetBrowser = 'chrome' | 'edge' | 'firefox';

/**
 * The universe of capabilities. Optional members (`name?:`) are
 * host-specific; required members are universal contracts every host
 * must implement.
 *
 * Grow this interface as the migration progresses. Each entry is a
 * typed function signature; the registry stores `(...args) => unknown`
 * under the hood but the accessor preserves the declared type.
 */
export interface Capabilities {
  /**
   * Resolve the runtime-active workspace id for the current surface.
   * Used by shared eager-mirror init to pin per-workspace mirrors to
   * the right id on mount. Returns `null` when no workspace is active
   * (fresh install, no seed yet).
   */
  getActiveWorkspaceId?: () => Promise<{ activeWorkspaceId: string | null }>;

  /**
   * Open a URL outside the current surface — the user's default
   * browser on desktop, a new tab on the extension. Implementations
   * decide which schemes to allow (typically http(s) + mailto).
   * Resolves with `{ ok: false, error }` when the URL is rejected or
   * the OS handoff fails.
   */
  openExternalUrl?: (url: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Open a URL in a NAMED browser rather than the OS default — the
   * extension-install CTAs' seam: a store listing must land in the
   * browser that will install the extension, which the default-browser
   * path can't guarantee. Implementations fall back to the default
   * browser when the named one isn't installed. Registered only by
   * hosts with an OS process plane under them (the desktop renderer);
   * surfaces without it branch to {@link Capabilities.openExternalUrl}.
   */
  openUrlInBrowser?: (url: string, browser: InstallTargetBrowser) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Dismiss the current surface — the extension popup closes its own
   * window; the extension sidepanel can self-close. Desktop windows
   * have no equivalent (the workbench is long-lived), so the desktop
   * shell intentionally doesn't register this capability and shared
   * UI no-ops via `getCapability(...)?.()`.
   */
  closeSurface?: () => void;

  /**
   * Fire-and-forget notification that the surface just mounted and
   * would like a fresh broadcast of host state. Extension surfaces
   * use this to kick the SW into emitting current rules / connection /
   * workspaces in case the surface load raced past an earlier event.
   * Desktop doesn't need this — the mirror snapshot fetches on mount
   * already cover the resync — so it doesn't register the capability
   * and shared UI no-ops via `getCapability(...)?.()`.
   */
  announceSurfaceReady?: () => Promise<void>;

  /**
   * Tell the host that rule data changed and any out-of-band rule
   * engine (extension `declarativeNetRequest`, future native proxy
   * rebuild paths) should refresh. The sync mutation itself already
   * propagated the data — this is the secondary nudge for engines
   * that live outside the sync data plane. Desktop's header / proxy
   * pipeline reads rules live from the engine state, so it doesn't
   * register this capability and shared UI no-ops via
   * `getCapability(...)?.()`.
   */
  notifyRulesChanged?: () => Promise<void>;

  /**
   * Exchange a daemon pairing code for a long-lived auth token (WS-A2).
   * Host-specific because the wire is a localhost/LAN HTTP fetch to the
   * back-end's `/pair/<code>/confirm` route, which only a host with the
   * reachability + permission to dial that origin can perform — the
   * extension surfaces register it; the chrome-free UI calls it and
   * writes the returned token into `backend.authToken`. Hosts that pair
   * by some other gesture (or not at all) simply don't register it, and
   * the UI hides the in-app pairing affordance via `hasCapability`.
   */
  pairWithCode?: (input: PairWithCodeInput) => Promise<PairWithCodeResult>;

  /**
   * Exchange OS-verified process identity for a daemon token over the
   * desktop's native-messaging host (OBSERVABILITY_PLAN.md Phase 7) —
   * the pairing path with no code to type: the browser spawns the
   * desktop-registered host, the daemon verifies WHO is asking from OS
   * truth, and an `nmSession` secret comes back. Registered only by
   * extension surfaces whose manifest carries the `nativeMessaging`
   * permission (Chrome/Edge); the wizard keys the desktop-app
   * scenario's automatic pairing off its presence and falls back to
   * {@link Capabilities.pairWithCode} everywhere else.
   */
  nmAutoPair?: (input: { readonly url: string }) => Promise<NmAutoPairResult>;

  /**
   * Whether the desktop app's native-messaging host is registered for
   * this browser — OS truth for "was the desktop app ever installed
   * here": any framed answer from the spawned host proves the manifest
   * + binary exist, a spawn error proves they don't. Says nothing
   * about the daemon RUNNING (connection state answers that). Same
   * registration surface as {@link Capabilities.nmAutoPair}; absent on
   * hosts without the NM plane, where the status surface degrades to a
   * neutral not-connected row.
   */
  nmHostPresence?: () => Promise<boolean>;

  /**
   * Ask the companion desktop app on this machine to front its window
   * and reveal `target` (a desktop-only tool window, the MCP settings
   * category, or just the workbench). Registered only by surfaces that
   * relay to a companion over the backend wire (the extension surfaces,
   * through the SW's `companionReveal` bridge RPC); the desktop shell
   * IS the companion and never registers it. Callers gate the
   * affordance on LIVE loopback connection state — the capability
   * resolves `{ ok: false, reason }` rather than launching anything
   * when no companion answers.
   */
  companionReveal?: (target: CompanionRevealTarget) => Promise<{ ok: boolean; reason?: string }>;

  /**
   * Launch the desktop app installed on this machine — the explicit
   * user gesture for a disconnected companion, riding the desktop's
   * native-messaging host (`launch` verb): the host opens the app it
   * shipped inside, anchored by its own install root, never by
   * anything a caller passes. Same registration surface as
   * {@link Capabilities.nmAutoPair} (extension surfaces whose manifest
   * carries the `nativeMessaging` permission); callers pair it with
   * {@link Capabilities.nmHostPresence} so the affordance only shows
   * where an installed app can actually answer. Resolves
   * `{ ok: false }` on every failure — no registered host, an
   * unanchored dev host, a failed spawn — and the disconnected
   * affordance it replaced remains the honest fallback.
   */
  desktopLaunch?: () => Promise<{ ok: boolean }>;

  /**
   * Marker capability for the opt-in request-inspection path that attaches
   * the browser's debugging protocol to tabs with their developer tools
   * open. Present only on hosts whose runtime exposes that protocol; absent
   * elsewhere (the Firefox / Safari extension surfaces), where shared UI
   * gates the master-switch row off via `hasCapability` and renders it
   * disabled. Presence is the whole signal — the boolean return is a
   * formality so the capability is a typed function like the others.
   */
  cdpInspection?: () => boolean;

  /**
   * Marker capability for origin-scoped site-data clearing (the Storage
   * tool window's "Clear site data" gesture). Present only on hosts
   * whose runtime can wipe an origin's cookies / DOM storage /
   * IndexedDB / Cache Storage / service workers in one call (the
   * extension surfaces whose manifest holds the browsing-data
   * permission — Chrome / Edge / Firefox); absent elsewhere (Safari),
   * where shared UI hides the clear affordance instead of offering a
   * button that can only fail. Presence is the whole signal, like
   * {@link Capabilities.cdpInspection}.
   */
  originDataClearing?: () => boolean;

  /**
   * Report a newer app build than the one running, or `null` when
   * up to date. Registered only by hosts that own their update story
   * (the desktop app checking its release feed); extension surfaces
   * update through the browser store and never register it, which
   * hides every update affordance in shared UI (the settings gear's
   * download item + attention dot).
   */
  getAppUpdate?: () => Promise<AppUpdateInfo | null>;

  /**
   * Whether the host can execute inject-rule code exempt from the page
   * CSP (header AND `<meta>`). Registered only by extension surfaces
   * whose manifest declares the `userScripts` permission (Chrome/Edge);
   * the probe reflects the browser's per-extension "Allow user scripts"
   * toggle at call time. When it resolves `false`, a bypassCSP inject
   * rule degrades to the `<script>`-tag + header-strip path — header
   * CSP is cleared but a `<meta http-equiv>` CSP still blocks the
   * script — and the rule editor surfaces an inline hint. Hosts where
   * the toggle doesn't exist (desktop, Firefox / Safari surfaces)
   * leave it absent and the editor stays quiet.
   */
  cspExemptInjection?: () => Promise<boolean>;

  /**
   * End this surface's daemon session and return to the login gate.
   * Registered only by the web host, whose session is an origin-scoped
   * token it can drop on its own; the extension / desktop shells manage
   * backend connections through settings and never register it, which
   * hides the settings-menu "Sign out" item in shared UI. App-scoped by
   * design — it drops the local session, not the identity provider's,
   * so an SSO re-login can proceed without re-entering the password.
   */
  signOut?: () => void;

  /**
   * The network runtime that executes this surface's API requests —
   * what actually answers the workbench Send button. Hosts whose
   * requests run on a Node fetch stack register `'node'`: the desktop
   * renderer (execution happens in the Electron main process) and the
   * web app (execution happens on the connected daemon). Extension
   * surfaces leave it absent and shared UI defaults to `'browser'`.
   * The request editor's Settings tab keys knob visibility and its
   * runtime-managed fact sheet off this value.
   */
  requestRuntime?: () => RequestRuntimeKind;

  /**
   * Declares that this surface FORWARDS gRPC invokes to a connected
   * companion (the desktop app / daemon) over the backend wire — the
   * browser has no HTTP/2 stack that surfaces trailers, so the seam is
   * the extension's only invoke path. Registered only by extension
   * surfaces; node-runtime surfaces (desktop, web) answer through
   * their own execution plane and leave it absent. The gRPC editor
   * keys its Invoke gate off this together with LIVE connection state:
   * capability present + companion connected → Invoke enabled;
   * present + disconnected → an honest "connect the desktop app"
   * affordance (compose/spec/examples stay fully usable either way).
   */
  grpcCompanionInvoke?: () => boolean;

  /**
   * Declares that this surface executes WebSocket sessions IN its own
   * page realm over the platform-native socket — the extension
   * workbench's posture, where the browser `WebSocket` needs no
   * companion for the base case. Registered only there; node-runtime
   * surfaces answer through their own execution plane
   * ({@link Capabilities.requestRuntime} stays `'node'` and untouched)
   * and other browser surfaces leave it absent, which keeps the
   * WebSocket editor's Connect honestly disabled. The editor enables
   * Connect when EITHER the runtime is node or this marker is present;
   * on the page-session path it also names the configured node-only
   * knobs (custom handshake headers, SSL-verification off) in a
   * Connect-side honesty notice — the platform constructor cannot
   * apply them, and a named limit beats a silent drop.
   */
  wsPageSession?: () => boolean;

  /**
   * Declares that the surface's answering host RUNS pre-request /
   * post-response scripts, and names its default posture (`'safe'` —
   * every host defaults secure). Registered only by node-runtime
   * surfaces whose OWN host runs scripts (the desktop renderer) — it
   * gates the Settings tab's chooser. The web app never registers it:
   * its sends execute on the connected daemon, whose posture arrives
   * as {@link Capabilities.remoteScriptRuntime} instead. The LIVE
   * per-workspace mode is not this capability's answer — it rides the
   * host-local `OH.scriptExecutionModes` slot, read and written by
   * `useScriptExecutionMode` behind the Settings tab's chooser.
   * Browser-runtime surfaces never register it — their offscreen
   * sandbox story is not a node-sheet fact.
   */
  scriptRuntime?: () => ScriptExecutionMode;

  /**
   * Declares that this surface's Sends FORWARD to a remote answering
   * host instead of executing locally, and names that host as the user
   * knows it (the tab's serving origin). The response's egress IP and
   * network locale belong to that host, not this device — the Send
   * button's hint and the response meta strip's "Sent from" attribution
   * key off it. Registered only by the web app; desktop and extension
   * surfaces execute on their own machine and leave it absent, which
   * keeps those surfaces free of remote-execution copy.
   */
  remoteRequestDispatch?: () => string;

  /**
   * Declares that FORWARDED sends run scripts on the answering
   * back-end, and names the mode they run under — always `'safe'`: a
   * peer-forwarded send never rides anything else, so this is a fact,
   * not a choice. Registered by the web app once the serving daemon
   * reports a script runtime over the wire
   * (`getScriptRuntimeInfo`); left absent against a runtime-less
   * daemon (the SEA/Docker single binary), where shared UI keeps the
   * honest "don't run here" fact row. Never renders a chooser — the
   * mode slot is the EXECUTING host's, out of a remote surface's
   * reach by design.
   */
  remoteScriptRuntime?: () => ScriptExecutionMode;

  /**
   * The release notes bundled into this build, as markdown, or `null`
   * when the build carries none. Registered only by hosts that ship a
   * What's New surface (the desktop app bundles the notes at build
   * time — they are never fetched, `docs/UPDATES_PLAN.md`). Extension
   * surfaces update through the store and leave it absent, which hides
   * the What's New affordances in shared UI.
   */
  getWhatsNew?: () => string | null;

  /**
   * Online release history for this host's changelog stream — the
   * What's New tab's "Previous releases" section (enhancement-only:
   * the feed adds history, never the current entry, which
   * {@link Capabilities.getWhatsNew} bundles). Registered by hosts
   * with a transport that can reach the static feed: the desktop
   * renderer bridges to a main-process fetch (its CSP blocks direct
   * connects), the extension fetches directly under its host
   * permissions. Hosts without one (the served web tab — the browser
   * never dials the feed) leave it absent and the section hides.
   */
  whatsNewHistory?: () => WhatsNewHistoryApi;

  /**
   * Access to real pty sessions for the workbench Terminal tool
   * window. Registered only by hosts with an OS process plane under
   * them (the desktop renderer, whose main process owns node-pty);
   * browser surfaces have no pty and leave it absent, which drops the
   * Terminal tool window from the dock registry entirely via
   * `requiresCapability` filtering.
   */
  terminal?: () => TerminalHostApi;

  /**
   * Availability gate for the workbench Proxy tool window — the L7
   * capture proxy's control surface + capture feed. Registered only by
   * hosts that run the daemon spine in-process and expose its lifecycle
   * lifeline (the desktop renderer); browser surfaces have no daemon and
   * leave it absent, which drops the Proxy tool window from the dock
   * registry via `requiresCapability` filtering. The control RPCs ride
   * `hostBridge` and the capture stream rides the lifeline — this flag
   * only says "this host has a capture proxy to drive."
   */
  proxyCapture?: () => boolean;

  /**
   * Availability gate for the workbench Live Network tool window — the
   * always-on live view of browser traffic streamed from the extension
   * through the daemon spine's telemetry relay (OBSERVABILITY_PLAN.md
   * Phase 1). Registered only by hosts that run the daemon spine
   * in-process and expose its lifeline server (the desktop renderer).
   * The tab-inventory RPC rides `hostBridge`; the lifecycle stream
   * rides the qualified lifecycle lifeline — presence is the signal.
   */
  liveNetwork?: () => boolean;

  /**
   * Availability gate for the workbench Git tool window — the log/history
   * surface over the workspace-tree git verbs (`oh.workspaceTree.log` /
   * `fileLog`, GIT_PLAN.md §9). Registered only by hosts whose bridge
   * reaches a workspace-tree runtime in-process (the desktop renderer);
   * browser surfaces have no filesystem tree and leave it absent, which
   * drops the Git tool window from the dock registry via
   * `requiresCapability` filtering. Presence is the whole signal.
   */
  workspaceGit?: () => boolean;
}

export type CapabilityName = keyof Capabilities;

// Underlying store — typed as `unknown` so we can hold heterogeneous
// signatures without per-name conditionals. The accessor below restores
// the declared type at the call site.
const installed = new Map<CapabilityName, unknown>();

/**
 * Install (or replace) a capability. Hosts call this once at boot for
 * every capability they support. Calling twice replaces the prior
 * implementation; tests use this to swap fakes.
 */
export function registerCapability<K extends CapabilityName>(name: K, impl: NonNullable<Capabilities[K]>): void {
  installed.set(name, impl);
}

/**
 * Drop a capability — primarily for test teardown so registrations
 * from one test don't bleed into the next. Production rarely needs it.
 */
export function unregisterCapability<K extends CapabilityName>(name: K): void {
  installed.delete(name);
}

/**
 * Return the installed implementation for `name`, or `undefined` when
 * the current host doesn't support that capability. Callers branch on
 * the return value; never throw.
 */
export function getCapability<K extends CapabilityName>(name: K): Capabilities[K] | undefined {
  return installed.get(name) as Capabilities[K] | undefined;
}

/** Convenience predicate — same answer as `getCapability(name) !== undefined`. */
export function hasCapability<K extends CapabilityName>(name: K): boolean {
  return installed.has(name);
}
