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
import { registerSetting } from '../registry';

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
    'backend.bindAddress': BackendBindAddress;
    'backend.bindPort': number;
    'backend.reconnectDelayMs': number;
    'backend.maxReconnectDelayMs': number;
    'backend.pingIntervalMs': number;
    'backend.showBadgeWhenDisconnected': boolean;
    'backend.showDiagrams': boolean;
  }
}

registerSetting({
  key: 'backend.bindAddress',
  type: 'enum',
  default: '127.0.0.1',
  schema: bindAddressSchema,
  label: 'Sync with devices on your network',
  description:
    'Lets other computers and browsers on the same network connect to this app and share its workspaces. Off by default — only this computer can reach it.',
  category: 'backend',
  subcategory: 'lan-peers',
  tags: ['lan', 'daemon', 'bind', 'peers', 'network', 'host', 'devices', 'sync'],
  scope: 'user',
  enumOptions: [
    { value: '127.0.0.1', label: 'Loopback only (127.0.0.1)', description: 'Only this machine can connect. Default.' },
    {
      value: '0.0.0.0',
      label: 'All interfaces (LAN)',
      description: 'Other devices on the local network can connect. Requires the auth token from U3.2.',
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
  label: 'Daemon port',
  description:
    'The port this app binds for browsers and other devices to connect to. Change it only if something else already uses the default. Clients must point at the same port.',
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
  key: 'backend.reconnectDelayMs',
  type: 'number',
  default: 1000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(60000)),
  label: 'Initial reconnect delay',
  description: 'How long to wait (ms) before the first reconnect attempt after a disconnect.',
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
  label: 'Max reconnect delay',
  description: 'Upper bound (ms) on the exponential backoff between reconnect attempts.',
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
  label: 'Keep-alive interval',
  description: 'How often (ms) to send a ping so the WebSocket stays open behind strict proxies.',
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
  label: 'Badge when disconnected',
  description: 'Show a red badge on the toolbar icon when the back-end link is down.',
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
  label: 'Show back-end diagrams',
  description: 'Show the illustrated tier and data-flow panels in Backend settings.',
  category: 'backend',
  tags: ['diagram', 'preview', 'illustration', 'panels', 'svg'],
  scope: 'user',
});
