/**
 * Main-side handler for renderer-initiated external link opens. The
 * window security hardening in `security.ts` denies every navigation,
 * new-window, and redirect attempt — so anything the UI wants to open
 * in the user's default browser (docs, homepage, issue tracker) has to
 * route through this RPC instead.
 *
 * Only `http(s)` and `mailto` URLs are forwarded to `shell.openExternal`.
 * Other schemes (`file://`, `javascript:`, custom protocols a malicious
 * page could try to register) are rejected — `openExternal` would
 * otherwise launch the OS handler for them.
 *
 * `oh:open-in-browser` is the named-browser sibling: it launches the
 * URL in a SPECIFIC browser (the extension-install CTAs — a store
 * listing must land in the browser that will install the extension),
 * falling back to the default-browser path when that browser isn't
 * installed. http(s) only — no mailto for a browser-targeted open.
 */

import { spawn } from 'node:child_process';
import { ipcMain, shell } from 'electron';
import { createLogger } from './logger';

const CHANNEL = 'oh:open-external';
const BROWSER_CHANNEL = 'oh:open-in-browser';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const BROWSER_PROTOCOLS = new Set(['http:', 'https:']);

const logger = createLogger('external-links');

export interface OpenExternalResult {
  ok: boolean;
  error?: string;
}

export type InstallTargetBrowser = 'chrome' | 'edge' | 'firefox';

/**
 * Per-platform launch vocabulary. macOS resolves by app bundle name
 * (`open -a`); Windows resolves through `start`'s App Paths lookup;
 * Linux tries the distro binary names in order.
 */
const BROWSER_LAUNCH: Record<InstallTargetBrowser, { mac: string; win: string; linux: string[] }> = {
  chrome: { mac: 'Google Chrome', win: 'chrome', linux: ['google-chrome', 'google-chrome-stable', 'chromium'] },
  edge: { mac: 'Microsoft Edge', win: 'msedge', linux: ['microsoft-edge', 'microsoft-edge-stable'] },
  firefox: { mac: 'Firefox', win: 'firefox', linux: ['firefox'] },
};

function isInstallTargetBrowser(value: unknown): value is InstallTargetBrowser {
  return value === 'chrome' || value === 'edge' || value === 'firefox';
}

/** Spawn one launcher command; resolves true only on a clean exit. */
function tryLaunch(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
    child.unref();
  });
}

/** Open `url` in the named browser; false when the browser isn't launchable. */
async function openInNamedBrowser(browser: InstallTargetBrowser, url: string): Promise<boolean> {
  const launch = BROWSER_LAUNCH[browser];
  if (process.platform === 'darwin') {
    return tryLaunch('open', ['-a', launch.mac, url]);
  }
  if (process.platform === 'win32') {
    // `start` resolves registered App Paths; an unknown target exits non-zero.
    return tryLaunch('cmd.exe', ['/c', 'start', '', launch.win, url]);
  }
  for (const bin of launch.linux) {
    if (await tryLaunch(bin, [url])) return true;
  }
  return false;
}

export function installExternalLinkHandler(): void {
  ipcMain.handle(CHANNEL, async (_event, rawUrl: unknown): Promise<OpenExternalResult> => {
    if (typeof rawUrl !== 'string') {
      return { ok: false, error: 'url must be a string' };
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: 'invalid url' };
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      logger.warn('blocked external open for protocol', parsed.protocol);
      return { ok: false, error: `protocol ${parsed.protocol} not allowed` };
    }
    try {
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (err) {
      logger.error('shell.openExternal failed', err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(BROWSER_CHANNEL, async (_event, rawUrl: unknown, rawBrowser: unknown): Promise<OpenExternalResult> => {
    if (typeof rawUrl !== 'string') {
      return { ok: false, error: 'url must be a string' };
    }
    if (!isInstallTargetBrowser(rawBrowser)) {
      return { ok: false, error: 'unknown browser target' };
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: 'invalid url' };
    }
    if (!BROWSER_PROTOCOLS.has(parsed.protocol)) {
      logger.warn('blocked browser-targeted open for protocol', parsed.protocol);
      return { ok: false, error: `protocol ${parsed.protocol} not allowed` };
    }
    const url = parsed.toString();
    if (await openInNamedBrowser(rawBrowser, url)) {
      return { ok: true };
    }
    // Named browser absent — the default browser still gets the user to
    // the listing (the store page itself explains the mismatch).
    logger.warn(`browser ${rawBrowser} not launchable — falling back to default browser`);
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (err) {
      logger.error('shell.openExternal fallback failed', err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
