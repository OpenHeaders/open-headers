import type { AuthConfig, RequestHeader } from '../../types/request';
import { decodeBase64 } from '../../utils/base64';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop } from '../report';
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

export function resolveAuth(
  raw: PostmanAuth | undefined,
  fallback: AuthConfig,
  jsonPath: string,
  report: ImportReport,
): { auth: AuthConfig; report: ImportReport } {
  if (!raw?.type || raw.type === 'noauth') {
    return { auth: fallback, report };
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
      recordDrop(report, {
        path: `${jsonPath}.request.auth`,
        reason: 'OAuth 2.0 auth not imported — first-class OAuth support lands with §18.',
        tracking: '#todo-oauth',
      });
      return { auth: fallback, report };
    }
    case 'awsv4': {
      recordDrop(report, {
        path: `${jsonPath}.request.auth`,
        reason: 'AWS Signature v4 auth not imported — first-class support lands with §18.',
        tracking: '#todo-aws-sigv4',
      });
      return { auth: fallback, report };
    }
    case 'digest':
    case 'hawk':
    case 'ntlm':
    case 'edgegrid':
    case 'oauth1': {
      recordDrop(report, {
        path: `${jsonPath}.request.auth`,
        reason: `${raw.type} auth not imported — only basic/bearer/apikey are supported in v1.`,
        tracking: '#todo-auth-types',
      });
      return { auth: fallback, report };
    }
    default: {
      recordDrop(report, {
        path: `${jsonPath}.request.auth`,
        reason: `Unknown auth type "${raw.type}" — ignored.`,
        tracking: 'PERMANENT: auth picklist',
      });
      return { auth: fallback, report };
    }
  }
}

function asParams(x: unknown): PostmanAuthParam[] {
  if (Array.isArray(x)) return x as PostmanAuthParam[];
  if (x && typeof x === 'object') {
    return Object.entries(x as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : undefined,
    }));
  }
  return [];
}

function paramValue(params: PostmanAuthParam[], key: string): string | undefined {
  const hit = params.find((p) => p.key === key);
  return typeof hit?.value === 'string' ? hit.value : undefined;
}
