/**
 * Daemon URL + token resolution — flag → env (`OH_DAEMON_URL` /
 * `OH_TOKEN`, the CI path) → config file → default loopback bind.
 * The CLI speaks to whatever owns the daemon bind (desktop app or
 * standalone daemon) — admission is bind-agnostic, so nothing here is
 * deployment-specific.
 */

import { WS_PORT } from '@openheaders/core/protocol';
import type { CliConfig } from './config-store';

export const DAEMON_URL_ENV = 'OH_DAEMON_URL';
export const TOKEN_ENV = 'OH_TOKEN';
export const DEFAULT_DAEMON_URL = `http://127.0.0.1:${WS_PORT}`;

export interface Connection {
  daemonUrl: string;
  token?: string;
}

export interface ConnectionFlags {
  daemon?: string;
  token?: string;
}

function normalizeDaemonUrl(raw: string): string {
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * The daemon's WebSocket URL for its HTTP origin — `http→ws`,
 * `https→wss` — the address the shared sign-in client is handed (it
 * addresses a back-end the way every other client does, by the
 * configured socket URL). Null for anything that is not an `http(s)`
 * URL, so a caller refuses with a clear reason.
 */
export function daemonWsUrl(daemonUrl: string): string | null {
  try {
    const u = new URL(daemonUrl);
    const protocol = u.protocol === 'https:' ? 'wss:' : u.protocol === 'http:' ? 'ws:' : null;
    if (!protocol) return null;
    return `${protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function resolveConnection(flags: ConnectionFlags, env: NodeJS.ProcessEnv, config: CliConfig): Connection {
  const daemonUrl = flags.daemon ?? env[DAEMON_URL_ENV] ?? config.daemonUrl ?? DEFAULT_DAEMON_URL;
  const token = flags.token ?? env[TOKEN_ENV] ?? config.token;
  return {
    daemonUrl: normalizeDaemonUrl(daemonUrl),
    ...(token !== undefined && token !== '' ? { token } : {}),
  };
}
