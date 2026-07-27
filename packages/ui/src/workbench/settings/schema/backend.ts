/**
 * Backend category — where your workspaces, rules, vault, and history
 * live. Four scenarios, all local-only (no vendor cloud, ever); the
 * trade-off is reach, not ownership.
 *
 *   - `in-browser`          — in-extension service worker (today, zero setup).
 *                             This browser only.
 *   - `desktop-app`         — the Open Headers desktop app's embedded
 *                             back-end. Any browser + the desktop app on
 *                             this machine see the same data.
 *   - `local-self-hosted`   — a standalone daemon you run on this machine
 *                             or your LAN. Every Open Headers surface
 *                             (extensions, desktop, CLI) on the same
 *                             network is a client. *Coming soon.*
 *   - `remote-self-hosted`  — a back-end you self-host on your own VM.
 *                             Reach anywhere with the same data.
 *                             *Coming soon.*
 *
 * Since the multi-backend Phase-1 retirement (MULTI_BACKEND_PLAN.md §2)
 * the mode is no longer a stored setting: the connection identity lives
 * in the `OH.backends` registry (`@openheaders/core/backends`), and
 * `BackendMode` survives purely as presentation vocabulary DERIVED from
 * that registry via {@link deriveBackendMode}. The keys that remain
 * registered here are the daemon-side bind (this process as a server)
 * and the global reliability/notification knobs that apply to every
 * connection.
 *
 * Schema docs page: see `workbench/components/docs/sections/open-headers.tsx`
 * "Local-first by design" and "What we're building next".
 */

import { getPrimaryBackend, isLoopbackBackendUrl } from '@openheaders/core/backends';
import { WS_PORT } from '@openheaders/core/protocol';
import type { BackendConnection } from '@openheaders/core/types';
import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useSettingValue } from '../hooks';
import { registerSetting } from '../registry';
import { get as getSettingValue } from '../store';

const LanPeersToggleEditor = lazy(() => import('../components/lan-peers-toggle'));
const BackendBindPortFieldEditor = lazy(() => import('../components/backend-bind-port-field'));

export const BACKEND_MODES = ['in-browser', 'desktop-app', 'local-self-hosted', 'remote-self-hosted'] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

/**
 * The mode of tier zero — the local host engine that is always on and
 * never a registry entry: the extension's SW, or the desktop app's
 * embedded back-end (a web bundle is always a client of the desktop it
 * was served by, so its no-connection state reads the same way).
 */
export function tierZeroMode(host: Host): BackendMode {
  return host === 'extension' ? 'in-browser' : 'desktop-app';
}

/**
 * Derive the presentation mode from the connection registry — "kind" is
 * read off the record, never stored (MULTI_BACKEND_PLAN.md §1). No
 * enabled entry means tier zero; an enabled entry classifies by URL:
 * `wss` is a remote back-end, a loopback address dialed from a browser
 * host is the desktop app, anything else is a local / LAN daemon.
 */
export function deriveBackendMode(host: Host, primary: BackendConnection | null): BackendMode {
  if (!primary?.enabled) return tierZeroMode(host);
  if (/^wss:/i.test(primary.url)) return 'remote-self-hosted';
  if (host !== 'desktop' && isLoopbackBackendUrl(primary.url)) return 'desktop-app';
  return 'local-self-hosted';
}

/** {@link deriveBackendMode} over the live registry mirror for this host. */
export function currentBackendMode(): BackendMode {
  return deriveBackendMode(getCurrentHost(), getPrimaryBackend());
}

/**
 * Bind address for the desktop daemon's WebSocket server (UNIFIED_ORACLE_MODEL.md §4.2).
 * `127.0.0.1` keeps the daemon loopback-only; `0.0.0.0` opens it to every local
 * interface. The bind controls reachability only — auth is mandatory on every
 * connection regardless of origin (loopback included), so a paired token is required
 * on HELLO either way.
 */
export const BACKEND_BIND_ADDRESSES = ['127.0.0.1', '0.0.0.0'] as const;
export type BackendBindAddress = (typeof BACKEND_BIND_ADDRESSES)[number];

/** Modes that need a wire — everything except `in-browser`. */
export function backendModeNeedsConnection(mode: BackendMode): boolean {
  return mode !== 'in-browser';
}

const bindAddressSchema = v.picklist(BACKEND_BIND_ADDRESSES);

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'backend.nmAutoJoin': boolean;
    'backend.nmAutoJoinProbe': boolean;
    'backend.requireNmIdentity': boolean;
    'backend.allowDesktopWatch': boolean;
    'backend.bindAddress': BackendBindAddress;
    'backend.bindPort': number;
    'backend.serveWebApp': boolean;
    'backend.allowLocalPeerExecute': boolean;
    'backend.allowRemotePeerExecute': boolean;
    'backend.reconnectDelayMs': number;
    'backend.maxReconnectDelayMs': number;
    'backend.pingIntervalMs': number;
    'backend.showBadgeWhenDisconnected': boolean;
    'backend.showDiagrams': boolean;
  }
}

registerSetting({
  // Consent gate for the NM identity plane (OBSERVABILITY_PLAN.md
  // Phase 7): on (the default), the extension silently pairs with —
  // and auto-joins — the desktop app on this machine once the daemon
  // has OS-verified the browser; off, only the explicit gestures (the
  // wizard's automatic pairing, device-flow codes) mint credentials.
  // Extension hosts only — the desktop IS the daemon; a web surface
  // has no native-messaging plane.
  key: 'backend.nmAutoJoin',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.nmAutoJoin.label',
  descriptionKey: 'workbench.settings.def.backend.nmAutoJoin.description',
  category: 'backend',
  tags: ['pair', 'pairing', 'automatic', 'desktop', 'join', 'native', 'token', 'connect'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
});

registerSetting({
  // The slow background re-probe behind [[backend.nmAutoJoin]]: with no
  // desktop configured, the extension checks every couple of minutes
  // whether one has appeared, so a fresh install connects on its own.
  // Off = the check runs only when the extension starts.
  key: 'backend.nmAutoJoinProbe',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.nmAutoJoinProbe.label',
  descriptionKey: 'workbench.settings.def.backend.nmAutoJoinProbe.description',
  category: 'backend',
  tags: ['pair', 'automatic', 'desktop', 'probe', 'periodic', 'check', 'background'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
});

registerSetting({
  // Fleet posture for the NM identity plane (OBSERVABILITY_PLAN.md §4,
  // deferred from S17's degraded-mode fork): on, the manual credential
  // gestures for the desktop app — pairing codes and pasted tokens on
  // loopback records — are refused, so only the daemon's OS-verified
  // native-messaging handoff can mint desktop credentials. Off (the
  // default), the device-flow gesture remains the degraded-mode path.
  // Remote self-hosted back-ends are untouched — they have no NM plane
  // and carry their own auth. Extension hosts only.
  key: 'backend.requireNmIdentity',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.requireNmIdentity.label',
  descriptionKey: 'workbench.settings.def.backend.requireNmIdentity.description',
  category: 'backend',
  tags: ['require', 'identity', 'native', 'pairing', 'code', 'token', 'policy', 'fleet', 'managed', 'desktop'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
});

/**
 * The require-NM posture verdict for one back-end address: true when
 * this host refuses manual credential gestures (pairing codes, pasted
 * tokens) for the record because only the NM handoff may mint its
 * credential. Loopback records on extension hosts only — remote
 * back-ends have no NM plane to require.
 */
export function nmIdentityRequiredFor(url: string): boolean {
  return getCurrentHost() === 'extension' && isLoopbackBackendUrl(url) && getSettingValue('backend.requireNmIdentity');
}

/** Reactive {@link nmIdentityRequiredFor} — re-renders when the setting moves (managed policy included). */
export function useNmIdentityRequired(url: string): boolean {
  const required = useSettingValue('backend.requireNmIdentity');
  return getCurrentHost() === 'extension' && isLoopbackBackendUrl(url) && required;
}

registerSetting({
  // Telemetry consent gate (OBSERVABILITY_PLAN.md §8 Phase 7, ratified
  // S16): identity decides WHO may attach; this decides WHAT an
  // attached peer may subscribe to. Off, a paired desktop stays
  // connected for rules/sync while traffic/storage/console watch
  // subscriptions get a typed refusal the desktop renders honestly.
  // Extension hosts only — the desktop IS the viewer, not the viewed.
  key: 'backend.allowDesktopWatch',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.allowDesktopWatch.label',
  descriptionKey: 'workbench.settings.def.backend.allowDesktopWatch.description',
  category: 'backend',
  tags: ['watch', 'traffic', 'storage', 'console', 'desktop', 'privacy', 'share', 'consent', 'live'],
  scope: 'user',
  when: () => getCurrentHost() === 'extension',
});

registerSetting({
  key: 'backend.bindAddress',
  type: 'enum',
  default: '127.0.0.1',
  schema: bindAddressSchema,
  labelKey: 'workbench.settings.def.backend.bindAddress.label',
  descriptionKey: 'workbench.settings.def.backend.bindAddress.description',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['lan', 'daemon', 'bind', 'peers', 'network', 'host', 'devices', 'sync'],
  scope: 'user',
  enumOptions: [
    {
      value: '127.0.0.1',
      labelKey: 'workbench.settings.def.backend.bindAddress.option.loopback.label',
      descriptionKey: 'workbench.settings.def.backend.bindAddress.option.loopback.description',
    },
    {
      value: '0.0.0.0',
      labelKey: 'workbench.settings.def.backend.bindAddress.option.all-interfaces.label',
      descriptionKey: 'workbench.settings.def.backend.bindAddress.option.all-interfaces.description',
    },
  ],
  // Surface only on the desktop host while the derived mode is
  // `desktop-app` — the only (host, mode) pair where this process IS the
  // daemon. The tier-zero card strips `when` from the lan-peers rows it
  // renders (the card itself establishes the daemon context); the `when`
  // is still honored by search hits and by SettingRow's own visibility
  // check.
  when: () => getCurrentHost() === 'desktop' && currentBackendMode() === 'desktop-app',
  // Custom editor surfaces the boolean-shaped affordance (a single
  // Switch) and the first-flip confirmation dialog. The underlying
  // value remains the explicit address string so future deliverables
  // (interface-specific binds, IPv6) extend the enum without remodeling.
  customEditor: LanPeersToggleEditor,
});

registerSetting({
  key: 'backend.bindPort',
  type: 'number',
  default: WS_PORT,
  // Hard floor matches `validatePort`'s reject rules — privileged ports
  // and out-of-range values are blocked at the schema too, so a stored
  // config from a future surface can't smuggle an unbindable port past
  // the UI. The ephemeral-range soft-warn lives only in the editor; the
  // schema still accepts it because it's a usable (if risky) port.
  schema: v.pipe(v.number(), v.integer(), v.minValue(1024), v.maxValue(65535)),
  labelKey: 'workbench.settings.def.backend.bindPort.label',
  descriptionKey: 'workbench.settings.def.backend.bindPort.description',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['port', 'bind', 'daemon', 'network', 'host', 'address'],
  scope: 'user',
  // Same (host, mode) gate as the LAN-peers toggle — surfaced only on the
  // desktop host while `desktop-app` is active, the one pair where this
  // process IS the daemon. The tier-zero card strips `when` for the
  // daemon-side rows it renders; search hits + SettingRow still honor it.
  when: () => getCurrentHost() === 'desktop' && currentBackendMode() === 'desktop-app',
  customEditor: BackendBindPortFieldEditor,
});

registerSetting({
  key: 'backend.serveWebApp',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.serveWebApp.label',
  descriptionKey: 'workbench.settings.def.backend.serveWebApp.description',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['web', 'serve', 'workbench', 'browser', 'tab', 'daemon', 'host'],
  scope: 'user',
  // Same (host, mode) gate as the other daemon-side rows — this process
  // serves the bundle only where it IS the daemon.
  when: () => getCurrentHost() === 'desktop' && currentBackendMode() === 'desktop-app',
});

// Two-tier egress opt-in — same-device browsers vs other devices are
// different trust decisions, so each gets its own toggle. Local
// defaults ON (the user paired this browser to use this app as its
// request engine — pairing is the consent); remote defaults OFF
// (egress from this machine on another device's behalf is an operator
// decision, never implied by pairing).
// Host gate only, NOT the mode gate the other daemon-side rows use:
// the desktop app runs its embedded server in every mode, so these
// opt-ins must stay reachable even while this app is itself a client
// of another back-end — the refusing wire messages point here.
registerSetting({
  key: 'backend.allowLocalPeerExecute',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.allowLocalPeerExecute.label',
  descriptionKey: 'workbench.settings.def.backend.allowLocalPeerExecute.description',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['send', 'execute', 'requests', 'peers', 'devices', 'daemon', 'egress', 'local', 'loopback'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});

registerSetting({
  key: 'backend.allowRemotePeerExecute',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.allowRemotePeerExecute.label',
  descriptionKey: 'workbench.settings.def.backend.allowRemotePeerExecute.description',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['send', 'execute', 'requests', 'peers', 'devices', 'daemon', 'egress', 'remote', 'lan'],
  scope: 'user',
  when: () => getCurrentHost() === 'desktop',
});

registerSetting({
  key: 'backend.reconnectDelayMs',
  type: 'number',
  default: 1000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(60000)),
  labelKey: 'workbench.settings.def.backend.reconnectDelayMs.label',
  descriptionKey: 'workbench.settings.def.backend.reconnectDelayMs.description',
  category: 'backend',
  subcategory: 'reliability',
  tags: ['reconnect', 'backoff', 'delay'],
  scope: 'user',
  numberRange: { min: 100, max: 60000, step: 100 },
  when: () => backendModeNeedsConnection(currentBackendMode()),
});

registerSetting({
  key: 'backend.maxReconnectDelayMs',
  type: 'number',
  default: 6000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(500), v.maxValue(300000)),
  labelKey: 'workbench.settings.def.backend.maxReconnectDelayMs.label',
  descriptionKey: 'workbench.settings.def.backend.maxReconnectDelayMs.description',
  category: 'backend',
  subcategory: 'reliability',
  tags: ['reconnect', 'backoff', 'max', 'ceiling'],
  scope: 'user',
  numberRange: { min: 500, max: 300000, step: 500 },
  when: () => backendModeNeedsConnection(currentBackendMode()),
});

registerSetting({
  key: 'backend.pingIntervalMs',
  type: 'number',
  default: 30000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(1000), v.maxValue(600000)),
  labelKey: 'workbench.settings.def.backend.pingIntervalMs.label',
  descriptionKey: 'workbench.settings.def.backend.pingIntervalMs.description',
  category: 'backend',
  subcategory: 'reliability',
  tags: ['ping', 'keep-alive', 'heartbeat'],
  scope: 'user',
  numberRange: { min: 1000, max: 600000, step: 1000 },
  when: () => backendModeNeedsConnection(currentBackendMode()),
});

registerSetting({
  key: 'backend.showBadgeWhenDisconnected',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.showBadgeWhenDisconnected.label',
  descriptionKey: 'workbench.settings.def.backend.showBadgeWhenDisconnected.description',
  category: 'backend',
  subcategory: 'notifications',
  tags: ['badge', 'status', 'icon', 'indicator'],
  scope: 'user',
  when: () => backendModeNeedsConnection(currentBackendMode()),
});

registerSetting({
  key: 'backend.showDiagrams',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.backend.showDiagrams.label',
  descriptionKey: 'workbench.settings.def.backend.showDiagrams.description',
  category: 'backend',
  tags: ['diagram', 'preview', 'illustration', 'panels', 'svg'],
  scope: 'user',
});
