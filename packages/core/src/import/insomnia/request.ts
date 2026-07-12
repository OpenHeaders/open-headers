import { placeholderFileRef } from '../../files';
import type { AuthConfig, HttpMethod, MultipartPart, RequestBody, RequestHeader } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import type { CurlRequest } from '../curl';
import { promoteAuthHeader } from '../postman/auth';
import { splitUrl } from '../postman/url';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { InsomniaAuthentication, InsomniaBody, InsomniaDoc, InsomniaParameter } from './types';

// ── Template syntax ────────────────────────────────────────────────

/**
 * Insomnia references variables as `{{ _.name }}` (Nunjucks with the
 * `_` environment object); our resolver reads flat `{{name}}`. The
 * rewrite preserves the dotted path — imported environments flatten
 * nested data to the same dotted names, so references keep resolving.
 */
const TEMPLATE_REF = /\{\{\s*_\.([^{}\s]+)\s*\}\}/g;

export function rewriteTemplateRefs(value: string): { value: string; rewrites: number } {
  let rewrites = 0;
  const rewritten = value.replace(TEMPLATE_REF, (_m, name: string) => {
    rewrites++;
    return `{{${name}}}`;
  });
  return { value: rewritten, rewrites };
}

// ── Request conversion ─────────────────────────────────────────────

const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export function convertRequest(doc: InsomniaDoc, jsonPath: string, report: ImportReport): CurlRequest {
  const rewrites = { count: 0 };
  const rewrite = (s: string): string => {
    const r = rewriteTemplateRefs(s);
    rewrites.count += r.rewrites;
    return r.value;
  };

  const method = coerceMethod(doc.method, jsonPath, report);
  const rawUrl = rewrite(doc.url ?? '');
  if (!doc.url) {
    recordDrop(report, {
      path: `${jsonPath}.url`,
      reason: 'URL missing — defaulting to empty string.',
      tracking: 'PERMANENT: resource shape validation',
    });
  }
  const { base, params } = splitUrl(rawUrl);

  const headers: RequestHeader[] = [];
  for (const h of doc.headers ?? []) {
    const key = h.name?.trim();
    if (!key) continue;
    const value = rewrite(h.value ?? '');
    if (h.disabled) {
      headers.push({ uid: generateUid(), key, value, enabled: false });
    } else {
      headers.push({ uid: generateUid(), key, value });
    }
  }
  const { auth: authFromHeader, headers: headersWithoutAuth } = promoteAuthHeader(headers);
  const auth = resolveAuth(doc.authentication, authFromHeader, jsonPath, report, rewrite);
  const body = buildBody(doc.body, jsonPath, report, rewrite);

  for (const p of doc.parameters ?? []) {
    const key = p.name?.trim();
    if (!key) continue;
    params.push({
      uid: generateUid(),
      key,
      value: rewrite(p.value ?? ''),
      enabled: p.disabled ? false : undefined,
      description: p.description,
    });
  }

  if (rewrites.count > 0) {
    recordTransform(report, {
      path: jsonPath,
      from: '{{ _.var }}',
      to: '{{var}}',
      reason: `${rewrites.count} Insomnia template reference${rewrites.count === 1 ? '' : 's'} rewritten to the flat {{var}} syntax; they resolve against the imported environments.`,
      tracking: 'PERMANENT: template syntax mapping',
    });
  }
  reportTemplateTags(doc, jsonPath, report);

  return { name: doc.name, method, url: base, headers: headersWithoutAuth, params, auth, body };
}

/**
 * Nunjucks tag blocks (`{% response … %}`, `{% prompt … %}`) have no
 * equivalent — the values stay verbatim so nothing is lost, but the
 * user is told they will not execute.
 */
function reportTemplateTags(doc: InsomniaDoc, jsonPath: string, report: ImportReport): void {
  const carriers = [
    doc.url ?? '',
    doc.body?.text ?? '',
    ...(doc.headers ?? []).map((h) => h.value ?? ''),
    ...(doc.parameters ?? []).map((p) => p.value ?? ''),
  ];
  if (carriers.some((s) => s.includes('{%'))) {
    recordDrop(report, {
      path: jsonPath,
      reason:
        'Insomnia template tags ({% … %}) are not supported — the text was kept verbatim but will not execute; edit the request after import.',
      tracking: '#todo-template-tags',
    });
  }
}

function coerceMethod(raw: string | undefined, jsonPath: string, report: ImportReport): HttpMethod {
  if (typeof raw !== 'string' || raw.length === 0) {
    recordDrop(report, {
      path: `${jsonPath}.method`,
      reason: 'Method missing — defaulting to GET.',
      tracking: 'PERMANENT: resource shape validation',
    });
    return 'GET';
  }
  const upper = raw.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) return upper as HttpMethod;
  recordDrop(report, {
    path: `${jsonPath}.method`,
    reason: `Unknown HTTP method "${raw}" — defaulting to GET.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}

// ── Auth ───────────────────────────────────────────────────────────

function resolveAuth(
  raw: InsomniaAuthentication | undefined,
  fallback: AuthConfig,
  jsonPath: string,
  report: ImportReport,
  rewrite: (s: string) => string,
): AuthConfig {
  if (!raw?.type || raw.type === 'none') return fallback;
  if (raw.disabled) {
    recordDrop(report, {
      path: `${jsonPath}.authentication`,
      reason: `Authentication (${raw.type}) is disabled in the source — not imported.`,
      tracking: 'PERMANENT: disabled-auth policy',
    });
    return fallback;
  }

  switch (raw.type) {
    case 'basic':
      return { type: 'basic', username: rewrite(raw.username ?? ''), password: rewrite(raw.password ?? '') };
    case 'bearer': {
      if (raw.prefix && raw.prefix.toLowerCase() !== 'bearer') {
        recordTransform(report, {
          path: `${jsonPath}.authentication`,
          from: `bearer with prefix "${raw.prefix}"`,
          to: 'bearer',
          reason: 'Custom bearer prefixes are not supported — the standard Bearer scheme is sent instead.',
          tracking: 'PERMANENT: bearer prefix',
        });
      }
      return { type: 'bearer', token: rewrite(raw.token ?? '') };
    }
    case 'apikey': {
      const at: 'header' | 'query' = raw.addTo === 'queryParams' ? 'query' : 'header';
      return { type: 'api-key', key: rewrite(raw.key ?? ''), value: rewrite(raw.value ?? ''), in: at };
    }
    case 'oauth2': {
      recordDrop(report, {
        path: `${jsonPath}.authentication`,
        reason: 'OAuth 2.0 auth not imported — first-class OAuth support lands with §18.',
        tracking: '#todo-oauth',
      });
      return fallback;
    }
    case 'iam': {
      recordDrop(report, {
        path: `${jsonPath}.authentication`,
        reason: 'AWS Signature v4 auth not imported — first-class support lands with §18.',
        tracking: '#todo-aws-sigv4',
      });
      return fallback;
    }
    case 'oauth1':
    case 'digest':
    case 'ntlm':
    case 'hawk':
    case 'netrc':
    case 'asap': {
      recordDrop(report, {
        path: `${jsonPath}.authentication`,
        reason: `${raw.type} auth not imported — only basic/bearer/apikey are supported in v1.`,
        tracking: '#todo-auth-types',
      });
      return fallback;
    }
    default: {
      recordDrop(report, {
        path: `${jsonPath}.authentication`,
        reason: `Unknown auth type "${raw.type}" — ignored.`,
        tracking: 'PERMANENT: auth picklist',
      });
      return fallback;
    }
  }
}

// ── Body ───────────────────────────────────────────────────────────

function buildBody(
  body: InsomniaBody | undefined,
  jsonPath: string,
  report: ImportReport,
  rewrite: (s: string) => string,
): RequestBody {
  if (!body) return { type: 'none' };
  const mime = (body.mimeType ?? '').toLowerCase();
  const text = typeof body.text === 'string' ? rewrite(body.text) : '';

  if (mime.length === 0) {
    return text.length > 0 ? { type: 'text', content: text } : { type: 'none' };
  }
  if (mime.includes('application/json')) {
    return text.length > 0 ? { type: 'json', content: text } : { type: 'none' };
  }
  if (mime.includes('xml')) {
    return text.length > 0 ? { type: 'xml', content: text } : { type: 'none' };
  }
  if (mime.includes('graphql')) return graphqlBody(text);
  if (mime.includes('application/x-www-form-urlencoded')) {
    return {
      type: 'form',
      formParts: (body.params ?? [])
        .filter((p) => p.name)
        .map((p) => ({
          uid: generateUid(),
          key: p.name ?? '',
          value: rewrite(p.value ?? ''),
          enabled: p.disabled ? false : undefined,
          description: p.description,
        })),
    };
  }
  if (mime.includes('multipart/form-data')) return multipartBody(body.params ?? [], jsonPath, report, rewrite);
  if (mime.includes('application/octet-stream')) return fileBody(body.fileName, jsonPath, report);
  if (mime.includes('text/plain')) {
    return text.length > 0 ? { type: 'text', content: text } : { type: 'none' };
  }
  if (text.length === 0) return { type: 'none' };
  recordTransform(report, {
    path: `${jsonPath}.body`,
    from: mime,
    to: 'text',
    reason: `No dedicated body type for "${mime}"; kept as text. Set the Content-Type header manually if it is missing.`,
    tracking: 'PERMANENT: body-type picklist',
  });
  return { type: 'text', content: text };
}

/** Insomnia stores GraphQL bodies as JSON text: `{"query": "…", "variables": {…}}`. */
function graphqlBody(text: string): RequestBody {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const gql = parsed as { query?: unknown; variables?: unknown };
      const query = typeof gql.query === 'string' ? gql.query : '';
      const variables =
        typeof gql.variables === 'string'
          ? gql.variables
          : gql.variables !== undefined && gql.variables !== null
            ? JSON.stringify(gql.variables)
            : undefined;
      return { type: 'graphql', content: query, graphqlVariables: variables };
    }
  } catch {
    // Not the JSON envelope — treat the text as the query itself.
  }
  return { type: 'graphql', content: text };
}

function multipartBody(
  params: InsomniaParameter[],
  jsonPath: string,
  report: ImportReport,
  rewrite: (s: string) => string,
): RequestBody {
  const parts: MultipartPart[] = [];
  let filePlaceholderCount = 0;
  for (const p of params) {
    if (p.disabled) continue;
    const name = p.name ?? '';
    if (p.type === 'file' || typeof p.fileName === 'string') {
      parts.push({
        kind: 'file',
        uid: generateUid(),
        name,
        fileRefs: [placeholderFileRef({ filename: basenameFromPath(p.fileName ?? '') || 'unnamed' })],
      });
      filePlaceholderCount++;
      continue;
    }
    parts.push({ kind: 'text', uid: generateUid(), name, value: rewrite(p.value ?? '') });
  }
  if (filePlaceholderCount > 0) {
    recordTransform(report, {
      path: `${jsonPath}.body.params`,
      from: `multipart (${filePlaceholderCount} file part${filePlaceholderCount === 1 ? '' : 's'})`,
      to: 'multipart with placeholder FileRefs',
      reason: `Exports don't include file bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.`,
      tracking: '#todo-file-blobs',
    });
  }
  if (parts.length === 0) return { type: 'none' };
  return { type: 'multipart', multipartParts: parts };
}

/** Whole-file body (`application/octet-stream` + `fileName`) — same placeholder path as the Postman `file` mode. */
function fileBody(fileName: string | undefined, jsonPath: string, report: ImportReport): RequestBody {
  const filename = fileName ? basenameFromPath(fileName) : 'binary-body';
  recordTransform(report, {
    path: `${jsonPath}.body`,
    from: 'file (raw binary body)',
    to: 'multipart with placeholder FileRef',
    reason: `The raw-file body landed as a one-part multipart placeholder so reconciliation uses the same UI as every other importer. If the target API wants a raw binary body (not multipart), switch the body type after upload.`,
    tracking: '#todo-file-blobs',
  });
  return {
    type: 'multipart',
    multipartParts: [
      {
        kind: 'file',
        uid: generateUid(),
        name: 'file',
        fileRefs: [placeholderFileRef({ filename: filename || 'binary-body' })],
      },
    ],
  };
}

function basenameFromPath(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = cleaned.lastIndexOf('/');
  return slash < 0 ? cleaned : cleaned.slice(slash + 1);
}
