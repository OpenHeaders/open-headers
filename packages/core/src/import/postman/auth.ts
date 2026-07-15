import type { AuthConfig, RequestHeader } from '../../types/request';
import { decodeBase64 } from '../../utils/base64';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import { resolveOAuth2Auth } from './oauth2';
import type { PostmanAuth, PostmanAuthParam, PostmanHeader } from './types';

// ── Headers + auth ─────────────────────────────────────────────────

export function buildHeaders(raw: PostmanHeader[], _jsonPath: string, _report: ImportReport): RequestHeader[] {
  const out: RequestHeader[] = [];
  for (const h of raw) {
    const key = h.key?.trim();
    if (!key) continue;
    const value = typeof h.value === 'string' ? h.value : '';
    // Disabled headers land as explicit `enabled: false` so the
    // editor can preserve the user's intent rather than silently
    // dropping the header.
    if (h.disabled) {
      out.push({ uid: generateUid(), key, value, enabled: false });
    } else {
      out.push({ uid: generateUid(), key, value });
    }
  }
  return out;
}

export function promoteAuthHeader(headers: RequestHeader[]): { auth: AuthConfig; headers: RequestHeader[] } {
  const out: RequestHeader[] = [];
  let auth: AuthConfig = { type: 'none' };
  for (const h of headers) {
    if (auth.type === 'none' && h.key.toLowerCase() === 'authorization' && h.enabled !== false) {
      const promoted = tryPromoteAuthHeaderValue(h.value);
      if (promoted) {
        auth = promoted;
        continue;
      }
    }
    out.push(h);
  }
  return { auth, headers: out };
}

function tryPromoteAuthHeaderValue(value: string): AuthConfig | null {
  const trimmed = value.trim();
  if (/^Bearer\s+/i.test(trimmed)) {
    return { type: 'bearer', token: trimmed.replace(/^Bearer\s+/i, '') };
  }
  if (/^Basic\s+/i.test(trimmed)) {
    const b64 = trimmed.replace(/^Basic\s+/i, '');
    const decoded = decodeBase64(b64);
    if (decoded?.includes(':')) {
      const colon = decoded.indexOf(':');
      return {
        type: 'basic',
        username: decoded.slice(0, colon),
        password: decoded.slice(colon + 1),
      };
    }
  }
  return null;
}

/**
 * A drop / explicit "No Auth" must land a CONCRETE config, never
 * `inherit` — landing `inherit` for a construct the user explicitly
 * authored would silently apply the ancestor chain's auth in its
 * place. A promoted-header fallback stays as-is (the header is real
 * authored auth); only the "nothing promoted" `inherit` placeholder
 * concretizes to `none`.
 */
function concreteFallback(fallback: AuthConfig): AuthConfig {
  return fallback.type === 'inherit' ? { type: 'none' } : fallback;
}

/**
 * Map a vendor auth block onto an {@link AuthConfig}.
 *
 * `fallback` is what an ABSENT block resolves to — the vendor's
 * absent-auth semantic is "inherit from parent", so request call
 * sites pass their promoted-header auth or `{ type: 'inherit' }`;
 * ancestor call sites (collection/folder default auth) pass
 * `{ type: 'inherit' }`, whose round-trip means "nothing configured
 * at this level". An explicit `noauth` is NOT inheritance — it lands
 * `none` (stopping the chain) unless a promoted header carries real
 * auth. `authPath` is the report path for drop notes — call sites
 * name their own site (`…item[i].request.auth`, `collection.auth`,
 * `…item[i].auth`).
 */
export function resolveAuth(
  raw: PostmanAuth | undefined,
  fallback: AuthConfig,
  authPath: string,
  report: ImportReport,
): { auth: AuthConfig; report: ImportReport } {
  if (!raw?.type) {
    return { auth: fallback, report };
  }
  if (raw.type === 'noauth') {
    return { auth: concreteFallback(fallback), report };
  }

  switch (raw.type) {
    case 'basic': {
      const params = asParams(raw.basic);
      const username = paramValue(params, 'username') ?? '';
      const password = paramValue(params, 'password') ?? '';
      return { auth: { type: 'basic', username, password }, report };
    }
    case 'bearer': {
      const params = asParams(raw.bearer);
      const token = paramValue(params, 'token') ?? '';
      return { auth: { type: 'bearer', token }, report };
    }
    case 'apikey': {
      const params = asParams(raw.apikey);
      const key = paramValue(params, 'key') ?? '';
      const value = paramValue(params, 'value') ?? '';
      const rawIn = paramValue(params, 'in')?.toLowerCase();
      const at: 'header' | 'query' = rawIn === 'query' ? 'query' : 'header';
      return { auth: { type: 'api-key', key, value, in: at }, report };
    }
    case 'oauth2': {
      const mapped = resolveOAuth2Auth(raw, authPath, report);
      return { auth: mapped ?? concreteFallback(fallback), report };
    }
    case 'awsv4': {
      const params = asParams(raw.awsv4);
      const sessionToken = paramValue(params, 'sessionToken');
      // Header signing is the only wire mode: presigned-URL (query)
      // signing isn't supported, so a config that asked for it lands
      // with its fields intact plus a transform naming the switch.
      if (paramFlag(params, 'addAuthDataToQuery')) {
        recordTransform(report, {
          path: authPath,
          from: 'awsv4/query-signing',
          to: 'aws-sigv4/header-signing',
          reason:
            'AWS Signature v4 was set to sign via query parameters — imported to sign via request headers instead.',
          tracking: 'PERMANENT: sigv4 header-signing only',
        });
      }
      return {
        auth: {
          type: 'aws-sigv4',
          accessKeyId: paramValue(params, 'accessKey') ?? '',
          secretAccessKey: paramValue(params, 'secretKey') ?? '',
          ...(sessionToken ? { sessionToken } : {}),
          service: paramValue(params, 'service') ?? '',
          region: paramValue(params, 'region') ?? '',
        },
        report,
      };
    }
    case 'digest': {
      // Only the credentials are configuration — the vendor block's
      // other params (realm, nonce, qop, algorithm, opaque, nc,
      // cnonce, retry flags) are a stale capture of some past server
      // challenge; the next live challenge re-supplies all of them,
      // so they are silently lossless.
      const params = asParams(raw.digest);
      return {
        auth: {
          type: 'digest',
          username: paramValue(params, 'username') ?? '',
          password: paramValue(params, 'password') ?? '',
        },
        report,
      };
    }
    case 'oauth1': {
      // Living scheme per the Phase F disposition — planned, not yet
      // first-class.
      recordDrop(report, {
        path: authPath,
        reason: `${raw.type} auth not imported yet — first-class support is planned.`,
        tracking: '#todo-auth-types',
      });
      return { auth: concreteFallback(fallback), report };
    }
    case 'ntlm': {
      recordDrop(report, {
        path: authPath,
        reason: 'NTLM auth not imported — the protocol is being phased out by its vendor and is not supported.',
        tracking: 'PERMANENT: ntlm phased out',
      });
      return { auth: concreteFallback(fallback), report };
    }
    case 'edgegrid': {
      recordDrop(report, {
        path: authPath,
        reason: 'EdgeGrid auth not imported — the scheme is specific to one CDN vendor and is not supported.',
        tracking: 'PERMANENT: edgegrid vendor-specific',
      });
      return { auth: concreteFallback(fallback), report };
    }
    case 'hawk': {
      recordDrop(report, {
        path: authPath,
        reason: 'Hawk auth not imported — the scheme is discontinued upstream and is not supported.',
        tracking: 'PERMANENT: hawk discontinued',
      });
      return { auth: concreteFallback(fallback), report };
    }
    default: {
      recordDrop(report, {
        path: authPath,
        reason: `Unknown auth type "${raw.type}" — ignored.`,
        tracking: 'PERMANENT: auth picklist',
      });
      return { auth: concreteFallback(fallback), report };
    }
  }
}

function asParams(x: unknown): PostmanAuthParam[] {
  if (Array.isArray(x)) return x as PostmanAuthParam[];
  if (x && typeof x === 'object') {
    return Object.entries(x as Record<string, unknown>).map(([key, value]) => ({
      key,
      // Booleans stringify (the object form spells flags as real
      // booleans — `addAuthDataToQuery: true`); anything else drops.
      value: typeof value === 'string' ? value : typeof value === 'boolean' ? String(value) : undefined,
    }));
  }
  return [];
}

function paramValue(params: PostmanAuthParam[], key: string): string | undefined {
  const hit = params.find((p) => p.key === key);
  return typeof hit?.value === 'string' ? hit.value : undefined;
}

/** Boolean-ish auth param — the array form carries real booleans
 *  (`{key, value: true, type: 'boolean'}`), the object form strings. */
function paramFlag(params: PostmanAuthParam[], key: string): boolean {
  const hit = params.find((p) => p.key === key);
  const value: unknown = hit?.value;
  return value === true || value === 'true';
}
