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
 */

import { ipcMain, shell } from 'electron';
import { createLogger } from './logger';

const CHANNEL = 'oh:open-external';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const logger = createLogger('external-links');

export interface OpenExternalResult {
  ok: boolean;
  error?: string;
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
}
