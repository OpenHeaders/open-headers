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
 * Schema docs page: see `workbench/components/docs/sections/open-headers.tsx`
 * "Local-first by design" and "What we're building next".
 */

import { WS_PORT } from '@openheaders/core/protocol';
import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

// Lazy import breaks the schema → component → schema cycle (the editor
// re-imports BackendMode/backendModeIsPending from this file).
const BackendModeFieldEditor = lazy(() => import('../components/backend-mode-switch'));
const LanPeersToggleEditor = lazy(() => import('../components/lan-peers-toggle'));
const BackendBindPortFieldEditor = lazy(() => import('../components/backend-bind-port-field'));
const BackendUrlFieldEditor = lazy(() => import('../components/backend-url-field'));
const BackendAuthTokenFieldEditor = lazy(() => import('../components/backend-auth-token-field'));

export const BACKEND_MODES = ['in-browser', 'desktop-app', 'local-self-hosted', 'remote-self-hosted'] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

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

/** Modes that aren't fully implemented yet — the UI marks them "Coming soon". */
export function backendModeIsPending(mode: BackendMode): boolean {
  return mode === 'local-self-hosted' || mode === 'remote-self-hosted';
}

const modeSchema = v.picklist(BACKEND_MODES);
const bindAddressSchema = v.picklist(BACKEND_BIND_ADDRESSES);
const urlSchema = v.pipe(v.string(), v.regex(/^wss?:\/\//i, 'Must start with ws:// or wss://'));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'backend.mode': BackendMode;
    'backend.bindAddress': BackendBindAddress;
    'backend.bindPort': number;
    'backend.url': string;
    'backend.authToken': string;
    'backend.autoConnect': boolean;
    'backend.reconnectDelayMs': number;
    'backend.maxReconnectDelayMs': number;
    'backend.pingIntervalMs': number;
    'backend.showBadgeWhenDisconnected': boolean;
  }
}

registerSetting({
  key: 'backend.mode',
  type: 'enum',
  default: 'in-browser',
  // Schema default is `in-browser` (only valid on the extension host).
  // On desktop / web the back-end can't live inside a service worker, so
  // the host-aware default falls back to `desktop-app`, which is valid
  // everywhere. Drives `isModified` comparison and Reset behavior.
  getDefault: () => (getCurrentHost() === 'extension' ? 'in-browser' : 'desktop-app'),
  schema: modeSchema,
  label: 'Backend mode',
  description: 'Where your workspaces live. Pick the host that matches your reach.',
  category: 'backend',
  tags: ['mode', 'host', 'in-browser', 'desktop', 'daemon', 'self-hosted'],
  scope: 'user',
  enumOptions: [
    {
      value: 'in-browser',
      label: 'In this browser',
      description: 'Service worker — zero setup. No cross-browser, no cross-device.',
    },
    {
      value: 'desktop-app',
      label: 'Desktop app on this machine',
      description: 'Any browser + the Open Headers desktop app see the same data.',
    },
    {
      value: 'local-self-hosted',
      label: 'Local / LAN daemon',
      description: 'Standalone back-end on this machine or your LAN. Coming soon.',
    },
    {
      value: 'remote-self-hosted',
      label: 'Remote (self-hosted)',
      description: 'A back-end you host on your own VM. Reach anywhere. Coming soon.',
    },
  ],
  // Writing to backend.mode can be destructive (data move, wipe + backup).
  // The custom editor routes every write through the request-verdict +
  // Coexist/Import/Discard dialog so the generic enum field can't bypass
  // the orchestrator from a settings-search hit.
  customEditor: BackendModeFieldEditor,
});

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
  // Surface only on the desktop host while previewing/active mode is
  // `desktop-app` — the only (host, mode) pair where this process IS the
  // daemon. BackendPane strips `when` from its field list because the
  // pane renders the previewed-mode's config; the daemon-side toggle is
  // rendered out of the dedicated "host IS the back-end" branch instead
  // (see BackendPane's `hostIsTheBackend` arm). The `when` is still
  // honored by search hits and by SettingRow's own visibility check.
  when: (get) => getCurrentHost() === 'desktop' && get('backend.mode') === 'desktop-app',
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
  // process IS the daemon. BackendPane strips `when` for the daemon-side
  // section it renders; search hits + SettingRow still honor it.
  when: (get) => getCurrentHost() === 'desktop' && get('backend.mode') === 'desktop-app',
  customEditor: BackendBindPortFieldEditor,
});

registerSetting({
  key: 'backend.url',
  type: 'string',
  default: 'ws://127.0.0.1:8137',
  schema: urlSchema,
  label: 'Backend address',
  description: 'Where this client dials the back-end. `ws://` for local / LAN hosts, `wss://` for remote.',
  category: 'backend',
  subcategory: 'connection',
  tags: ['url', 'websocket', 'address', 'port', 'host'],
  scope: 'user',
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
  // Custom editor splits the canonical `ws://host:port` string into the
  // scheme / Address / Port parts the user thinks in, while persisting
  // the literal URL every dialer reads (WS-A3).
  customEditor: BackendUrlFieldEditor,
});

registerSetting({
  key: 'backend.authToken',
  type: 'string',
  default: '',
  // Empty string is the pre-pairing state — the field exists before the
  // user holds a token. It is no longer a valid *connected* state: the
  // daemon now requires a paired token on every HELLO (loopback
  // included), so an empty token yields an `auth-required` reject. We
  // don't constrain the format here because tokens may be pasted from a
  // future device-flow surface (U3.3) whose shape this client doesn't
  // dictate.
  schema: v.string(),
  label: 'Daemon auth token',
  description:
    'Long-lived token the daemon issues when you pair this device. Pair with the code the back-end shows, or paste a token directly; this client sends it on every HELLO.',
  category: 'backend',
  subcategory: 'connection',
  tags: ['auth', 'token', 'pair', 'daemon', 'secret'],
  scope: 'user',
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
  // Custom editor adds the in-app "Pair with a code" affordance (WS-A2)
  // beside the raw token input — typing the daemon's 6-digit code
  // exchanges it for a token through the `pairWithCode` capability and
  // writes the result straight into this setting.
  customEditor: BackendAuthTokenFieldEditor,
});

registerSetting({
  key: 'backend.autoConnect',
  type: 'boolean',
  default: true,
  schema: v.boolean(),
  label: 'Auto-connect',
  description: 'Connect to the back-end automatically whenever the extension starts.',
  category: 'backend',
  subcategory: 'reliability',
  tags: ['auto', 'connect', 'startup'],
  scope: 'user',
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
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
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
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
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
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
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
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
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
});
