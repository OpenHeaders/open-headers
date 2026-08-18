/**
 * OS proxy-configuration snapshot for the System mode's informational
 * display (the request-engine proxy design P3): what THIS
 * machine's own configuration says, read from the platform's canonical
 * store — `scutil --proxy` on macOS, the per-user Internet Settings
 * registry key on Windows, the HTTP_PROXY-family environment variables
 * elsewhere.
 *
 * Read-only and informational: resolution stays delegated to Chromium
 * (`resolve`, per URL) and always wins — a PAC script can answer
 * differently for every target, so the snapshot never feeds the
 * resolver. Parsers are pure and exported for unit rigs; only
 * `describeOsProxy` touches the platform.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemProxyOsSnapshot } from '@openheaders/core/types';

const run = promisify(execFile);

const WINDOWS_INTERNET_SETTINGS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function scutilScalar(text: string, key: string): string | undefined {
  const match = text.match(new RegExp(`\\b${key} : (.+)`));
  const value = match?.[1]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function scutilHostPort(text: string, prefix: string): string | undefined {
  if (scutilScalar(text, `${prefix}Enable`) !== '1') return undefined;
  const host = scutilScalar(text, `${prefix}Proxy`);
  if (host === undefined) return undefined;
  const port = scutilScalar(text, `${prefix}Port`);
  return port === undefined ? host : `${host}:${port}`;
}

/** Parse `scutil --proxy` dictionary output into the snapshot. */
export function parseScutilProxy(text: string): SystemProxyOsSnapshot {
  const snapshot: SystemProxyOsSnapshot = { source: 'macos-system' };
  const http = scutilHostPort(text, 'HTTP');
  const https = scutilHostPort(text, 'HTTPS');
  if (http !== undefined) snapshot.httpProxy = http;
  if (https !== undefined) snapshot.httpsProxy = https;
  if (scutilScalar(text, 'ProxyAutoConfigEnable') === '1') {
    const pac = scutilScalar(text, 'ProxyAutoConfigURLString');
    if (pac !== undefined) snapshot.pacUrl = pac;
  }
  if (scutilScalar(text, 'ProxyAutoDiscoveryEnable') === '1') snapshot.autoDetect = true;
  const exceptions = text.match(/ExceptionsList : <array> \{([\s\S]*?)\}/);
  if (exceptions !== null) {
    const items = [...exceptions[1].matchAll(/\d+ : (.+)/g)].map((m) => m[1].trim()).filter((item) => item !== '');
    if (items.length > 0) snapshot.bypassList = items.join(', ');
  }
  return snapshot;
}

function registryValue(text: string, name: string): string | undefined {
  const match = text.match(new RegExp(`^\\s*${name}\\s+REG_(?:DWORD|SZ|EXPAND_SZ)\\s+(.+)$`, 'm'));
  const value = match?.[1]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** Parse `reg query` output for the Internet Settings key. WinINET's
 *  `ProxyServer` is either one `host:port` for every scheme or a
 *  `scheme=host:port;…` list — both shapes surface as-is per scheme. */
export function parseWindowsProxyRegistry(text: string): SystemProxyOsSnapshot {
  const snapshot: SystemProxyOsSnapshot = { source: 'windows-registry' };
  const pac = registryValue(text, 'AutoConfigURL');
  if (pac !== undefined) snapshot.pacUrl = pac;
  const enabled = registryValue(text, 'ProxyEnable');
  const server = registryValue(text, 'ProxyServer');
  if (enabled !== undefined && Number.parseInt(enabled, 16) !== 0 && server !== undefined) {
    if (server.includes('=')) {
      for (const part of server.split(';')) {
        const [scheme, value] = part.split('=', 2);
        if (scheme?.trim() === 'http' && value !== undefined) snapshot.httpProxy = value.trim();
        if (scheme?.trim() === 'https' && value !== undefined) snapshot.httpsProxy = value.trim();
      }
    } else {
      snapshot.httpProxy = server;
      snapshot.httpsProxy = server;
    }
    const override = registryValue(text, 'ProxyOverride');
    if (override !== undefined) {
      snapshot.bypassList = override
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
        .join(', ');
    }
  }
  return snapshot;
}

/** Snapshot from the HTTP_PROXY-family environment variables — the
 *  Linux (and fallback) configuration surface. `auto_proxy` is the
 *  conventional PAC-URL variable in that family. */
export function snapshotFromEnvironment(env: Record<string, string | undefined>): SystemProxyOsSnapshot {
  const snapshot: SystemProxyOsSnapshot = { source: 'process-env' };
  const read = (lower: string, upper: string): string | undefined => {
    const value = env[lower] ?? env[upper];
    return value === undefined || value === '' ? undefined : value;
  };
  const http = read('http_proxy', 'HTTP_PROXY');
  const https = read('https_proxy', 'HTTPS_PROXY');
  const pac = read('auto_proxy', 'AUTO_PROXY');
  const noProxy = read('no_proxy', 'NO_PROXY');
  if (http !== undefined) snapshot.httpProxy = http;
  if (https !== undefined) snapshot.httpsProxy = https;
  if (pac !== undefined) snapshot.pacUrl = pac;
  if (noProxy !== undefined) snapshot.bypassList = noProxy;
  return snapshot;
}

/** Read the platform's proxy configuration. Throws on a failed
 *  platform read — the RPC handler maps that to an honest error. */
export async function describeOsProxy(): Promise<SystemProxyOsSnapshot> {
  if (process.platform === 'darwin') {
    const { stdout } = await run('scutil', ['--proxy']);
    return parseScutilProxy(stdout);
  }
  if (process.platform === 'win32') {
    const { stdout } = await run('reg', ['query', WINDOWS_INTERNET_SETTINGS_KEY]);
    return parseWindowsProxyRegistry(stdout);
  }
  return snapshotFromEnvironment(process.env);
}
