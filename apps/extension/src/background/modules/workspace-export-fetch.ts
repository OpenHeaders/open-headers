/**
 * URL-fetch source for workspace-export imports (design §5.1).
 *
 * Hardening posture (mirrors the threat model in §4.4):
 *   • HTTPS only — http:// rejected before any DNS lookup.
 *   • Host allowlist — `github.com` / `raw.githubusercontent.com` /
 *     `gist.github.com` plus user-configured additions from
 *     `OH.allowedFetchHosts`. Off-allowlist hosts rejected pre-fetch.
 *   • Manual redirect handling — `redirect: 'manual'` and re-validate
 *     each `Location` against the allowlist. Default `redirect:
 *     'follow'` would silently chase a 302 to an arbitrary host.
 *   • 1 MB streaming body cap — the import-side parse pipeline already
 *     has a 50 MB raw cap, but URL-fetch is the highest-risk source,
 *     so the bound here is much tighter (per §5.1).
 *   • Every fetch lands in the observability log.
 *
 * The module deliberately exports a SW-side function only — the
 * renderer reaches it via the `fetchWorkspaceExportYaml` RPC, never
 * directly. The renderer's CORS scope wouldn't reach raw.githubusercontent
 * anyway; the SW's host_permissions cover it.
 */

import { logger } from '@utils/logger';
import { ALLOWED_FETCH_HOSTS_SETTING_KEY, DEFAULT_ALLOWED_FETCH_HOSTS, extensionStorage, OH } from '@openheaders/oracle/storage';
import { recordLog } from './observability-log';

/** Hard cap for the URL-fetch source body size — design §5.1. */
export const URL_FETCH_MAX_BYTES = 1 * 1024 * 1024;

/** Hard cap on redirect hops to keep a misconfigured server from
 *  spinning the SW. Each hop's destination is re-validated. */
const MAX_REDIRECTS = 5;

export interface FetchWorkspaceExportResult {
  ok: true;
  yaml: string;
  finalUrl: string;
}

export interface FetchWorkspaceExportError {
  ok: false;
  reason:
    | 'invalid-url'
    | 'not-https'
    | 'host-not-allowlisted'
    | 'too-many-redirects'
    | 'redirect-host-not-allowlisted'
    | 'body-too-large'
    | 'http-error'
    | 'network-error';
  message: string;
}

export type FetchWorkspaceExportOutcome = FetchWorkspaceExportResult | FetchWorkspaceExportError;

/**
 * Parse a comma- or whitespace-separated host string into a normalized
 * allowlist. Lowercases, trims, de-dupes, drops empty entries.
 */
export function parseAllowedHostsList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/**
 * Read the user-configured allowlist from settings storage (falls back
 * to defaults if unset / empty). Returns a fresh array per call so
 * callers can sort / mutate without aliasing.
 *
 * Single source of truth: the `oh.settings.user` dict; the renderer's
 * Settings → Workspace Sharing UI writes the comma-separated string,
 * the SW parses it on every fetch.
 */
export async function getAllowedFetchHosts(): Promise<string[]> {
  const userSettings = (await extensionStorage.get(OH.settingsUser)) ?? {};
  const raw = userSettings[ALLOWED_FETCH_HOSTS_SETTING_KEY];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = parseAllowedHostsList(raw);
    if (parsed.length > 0) return parsed;
  }
  return [...DEFAULT_ALLOWED_FETCH_HOSTS];
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function hostAllowed(host: string, allowlist: string[]): boolean {
  const lower = host.toLowerCase();
  return allowlist.some((allowed) => lower === allowed || lower.endsWith(`.${allowed}`));
}

/**
 * Fetch a workspace-export YAML/JSON document under the host allowlist
 * + size cap + manual redirect rules. Returns a discriminated union;
 * caller surfaces the failure reason in the preview modal's error
 * gutter.
 */
export async function fetchWorkspaceExportYaml(rawUrl: string): Promise<FetchWorkspaceExportOutcome> {
  const allowlist = await getAllowedFetchHosts();

  const initial = parseUrl(rawUrl);
  if (!initial) {
    return failed('invalid-url', `Could not parse URL: ${rawUrl}`);
  }
  if (initial.protocol !== 'https:') {
    return failed('not-https', `URL-fetch source requires https:// — got ${initial.protocol}`);
  }
  if (!hostAllowed(initial.hostname, allowlist)) {
    return failed(
      'host-not-allowlisted',
      `Host "${initial.hostname}" is not on the allowlist. Add it under Settings → Workspace Sharing → Allowed fetch hosts to import from there.`,
    );
  }

  let currentUrl = initial.toString();
  let hops = 0;
  while (true) {
    if (hops > MAX_REDIRECTS) {
      return failed('too-many-redirects', `Exceeded ${MAX_REDIRECTS} redirects from ${rawUrl}`);
    }
    let resp: Response;
    try {
      resp = await fetch(currentUrl, { redirect: 'manual', cache: 'no-store' });
    } catch (err) {
      return failed('network-error', err instanceof Error ? err.message : 'fetch failed');
    }

    // Manual-redirect handling: status 0 (opaque redirect) or 3xx with a
    // Location header tells us to walk to the next hop. Browsers report
    // a CORS-blocked redirect as `type: 'opaqueredirect'` even when the
    // SW itself made the request — read the `Location` header
    // explicitly and validate it against the allowlist before following.
    const status = resp.status;
    if (resp.type === 'opaqueredirect' || (status >= 300 && status < 400)) {
      const location = resp.headers.get('Location');
      if (!location) {
        // No Location header — treat as terminal HTTP error.
        return failed('http-error', `HTTP ${status} with no Location header from ${currentUrl}`);
      }
      const next = parseUrl(new URL(location, currentUrl).toString());
      if (!next) return failed('invalid-url', `Invalid redirect target: ${location}`);
      if (next.protocol !== 'https:') return failed('not-https', `Redirect target is not HTTPS: ${next.protocol}`);
      if (!hostAllowed(next.hostname, allowlist)) {
        return failed(
          'redirect-host-not-allowlisted',
          `Redirect target "${next.hostname}" is not on the allowlist. Refusing to follow.`,
        );
      }
      currentUrl = next.toString();
      hops++;
      continue;
    }

    if (!resp.ok) {
      return failed('http-error', `HTTP ${status} from ${currentUrl}`);
    }

    // Stream the body with the size cap — Content-Length is advisory at
    // best, but a hard streaming cap defends against servers that
    // ignore or lie about it.
    const reader = resp.body?.getReader();
    if (!reader) {
      // Fall back to .text() when streams aren't available; cap-check
      // post-hoc.
      const text = await resp.text();
      if (new TextEncoder().encode(text).length > URL_FETCH_MAX_BYTES) {
        return failed('body-too-large', `Body exceeded ${URL_FETCH_MAX_BYTES} bytes`);
      }
      return success(text, currentUrl);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > URL_FETCH_MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* best-effort */
        }
        return failed('body-too-large', `Body exceeded ${URL_FETCH_MAX_BYTES} bytes mid-stream`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    return success(text, currentUrl);
  }
}

function success(yaml: string, finalUrl: string): FetchWorkspaceExportResult {
  recordLog({
    subsystem: 'workspace',
    op: 'import',
    level: 'info',
    message: `Fetched workspace export from ${finalUrl} (${new TextEncoder().encode(yaml).length} bytes)`,
    context: {},
  });
  return { ok: true, yaml, finalUrl };
}

function failed(reason: FetchWorkspaceExportError['reason'], message: string): FetchWorkspaceExportError {
  logger.warn('WorkspaceExportFetch', `${reason}: ${message}`);
  recordLog({
    subsystem: 'workspace',
    op: 'import',
    level: 'warn',
    message: `URL-fetch refused: ${reason} — ${message}`,
    context: {},
  });
  return { ok: false, reason, message };
}
