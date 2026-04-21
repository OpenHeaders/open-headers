/**
 * Desktop Connection category — settings for the WebSocket link
 * between the extension and the Open Headers desktop app. The v5
 * desktop app runs on 127.0.0.1:59510 (deliberately different from
 * v4's :59210, so an installed v4 app can't accidentally answer); the
 * extension is the client and reconnects with exponential backoff.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const urlSchema = v.pipe(v.string(), v.regex(/^wss?:\/\//i, 'Must start with ws:// or wss://'));

declare module '../types' {
  interface SettingsMap {
    'desktop.connection.autoConnect': boolean;
    'desktop.connection.url': string;
    'desktop.connection.reconnectDelayMs': number;
    'desktop.connection.maxReconnectDelayMs': number;
    'desktop.connection.pingIntervalMs': number;
    'desktop.connection.showBadgeWhenDisconnected': boolean;
  }
}

registerSetting({
  key: 'desktop.connection.autoConnect',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Auto-Connect',
  description: 'Automatically connect to the desktop app whenever the extension starts.',
  category: 'desktopConnection',
  tags: ['auto', 'connect', 'startup'],
  scope: 'user',
});

registerSetting({
  key: 'desktop.connection.url',
  type: 'string',
  default: 'ws://127.0.0.1:59510',
  schema: urlSchema,
  label: 'Desktop App URL',
  description: 'WebSocket URL of the Open Headers desktop app.',
  category: 'desktopConnection',
  tags: ['url', 'websocket', 'address', 'port'],
  scope: 'user',
});

registerSetting({
  key: 'desktop.connection.reconnectDelayMs',
  type: 'number',
  default: 1000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(60000)),
  label: 'Initial Reconnect Delay',
  description: 'How long to wait (ms) before the first reconnect attempt after a disconnect.',
  category: 'desktopConnection',
  tags: ['reconnect', 'backoff', 'delay'],
  scope: 'user',
  numberRange: { min: 100, max: 60000, step: 100 },
});

registerSetting({
  key: 'desktop.connection.maxReconnectDelayMs',
  type: 'number',
  default: 6000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(500), v.maxValue(300000)),
  label: 'Max Reconnect Delay',
  description: 'Upper bound (ms) on the exponential backoff between reconnect attempts.',
  category: 'desktopConnection',
  tags: ['reconnect', 'backoff', 'max', 'ceiling'],
  scope: 'user',
  numberRange: { min: 500, max: 300000, step: 500 },
});

registerSetting({
  key: 'desktop.connection.pingIntervalMs',
  type: 'number',
  default: 30000,
  schema: v.pipe(v.number(), v.integer(), v.minValue(1000), v.maxValue(600000)),
  label: 'Keep-Alive Interval',
  description: 'How often (ms) to send a ping so the WebSocket stays open behind strict proxies.',
  category: 'desktopConnection',
  tags: ['ping', 'keep-alive', 'heartbeat'],
  scope: 'user',
  numberRange: { min: 1000, max: 600000, step: 1000 },
});

registerSetting({
  key: 'desktop.connection.showBadgeWhenDisconnected',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  label: 'Badge When Disconnected',
  description: 'Show a red badge on the toolbar icon when the desktop app link is down.',
  category: 'desktopConnection',
  tags: ['badge', 'status', 'icon', 'indicator'],
  scope: 'user',
});
