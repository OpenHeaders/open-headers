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

import { lazy } from 'react';
import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

// Lazy import breaks the schema → component → schema cycle (the editor
// re-imports BackendMode/backendModeIsPending from this file).
const BackendModeFieldEditor = lazy(() => import('../components/backend-mode-switch'));
const LanPeersToggleEditor = lazy(() => import('../components/lan-peers-toggle'));

export const BACKEND_MODES = ['in-browser', 'desktop-app', 'local-self-hosted', 'remote-self-hosted'] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

/**
 * Bind address for the desktop daemon's WebSocket server (UNIFIED_ORACLE_MODEL.md §4.2).
 * `127.0.0.1` keeps the daemon loopback-only (trust-by-process); `0.0.0.0` opens it to
 * every local interface. Auth is then decided per-connection: loopback-origin peers
 * stay trust-by-process, non-loopback peers must present a token on HELLO.
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
    { value: 'in-browser', label: 'In this browser', description: 'Service worker — zero setup. No cross-browser, no cross-device.' },
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
    { value: '0.0.0.0', label: 'All interfaces (LAN)', description: 'Other devices on the local network can connect. Requires the auth token from U3.2.' },
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
  key: 'backend.url',
  type: 'string',
  default: 'ws://127.0.0.1:8137',
  schema: urlSchema,
  label: 'Backend URL',
  description: 'WebSocket address of the back-end. `ws://` for local hosts, `wss://` for remote.',
  category: 'backend',
  subcategory: 'connection',
  tags: ['url', 'websocket', 'address', 'port', 'host'],
  scope: 'user',
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
});

registerSetting({
  key: 'backend.authToken',
  type: 'string',
  default: '',
  // Empty string is allowed for loopback peers (trust-by-process); the
  // daemon's `requireAuth` flip only enforces presence on non-loopback
  // binds. We don't constrain the format here because tokens may be
  // pasted from a future device-flow surface (U3.3) whose shape this
  // client doesn't dictate.
  schema: v.string(),
  label: 'Daemon auth token',
  description:
    'Long-lived token issued by the daemon when LAN peers are allowed. Paste the value the daemon admin shared with you; the desktop / extension sends it on every HELLO.',
  category: 'backend',
  subcategory: 'connection',
  tags: ['auth', 'token', 'pair', 'daemon', 'secret'],
  scope: 'user',
  when: (get) => backendModeNeedsConnection(get('backend.mode')),
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
