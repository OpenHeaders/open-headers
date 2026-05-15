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

import * as v from 'valibot';
import { registerSetting } from '../registry';

export const BACKEND_MODES = ['in-browser', 'desktop-app', 'local-self-hosted', 'remote-self-hosted'] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

/** Modes that need a wire — everything except `in-browser`. */
export function backendModeNeedsConnection(mode: BackendMode): boolean {
  return mode !== 'in-browser';
}

/** Modes that aren't fully implemented yet — the UI marks them "Coming soon". */
export function backendModeIsPending(mode: BackendMode): boolean {
  return mode === 'local-self-hosted' || mode === 'remote-self-hosted';
}

const modeSchema = v.picklist(BACKEND_MODES);
const urlSchema = v.pipe(v.string(), v.regex(/^wss?:\/\//i, 'Must start with ws:// or wss://'));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'backend.mode': BackendMode;
    'backend.url': string;
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
});

registerSetting({
  key: 'backend.url',
  type: 'string',
  default: 'ws://127.0.0.1:59210',
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
