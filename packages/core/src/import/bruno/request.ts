import { placeholderFileRef } from '../../files';
import type { AuthConfig, HttpMethod, MultipartPart, RequestBody, RequestHeader } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import type { CurlRequest } from '../curl';
import { promoteAuthHeader } from '../postman/auth';
import { splitUrl } from '../postman/url';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { BruBlock, BruEntry } from './tokenize';

// ── Per-file request conversion ────────────────────────────────────

const METHOD_BLOCKS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'connect', 'trace'] as const;
const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export interface BrunoConvertedRequest {
  request: CurlRequest;
  /** `meta.seq` — user ordering inside the folder. */
  seq: number | undefined;
}

function entryValue(entries: BruEntry[], key: string): string | undefined {
  const hit = entries.find((e) => e.key === key && !e.disabled);
  return hit?.value;
}

function findBlock(blocks: BruBlock[], name: string): BruBlock | undefined {
  return blocks.find((b) => b.name === name);
}

/**
 * Convert one request file's block list to a `CurlRequest`. `jsonPath`
 * is the collection-relative file path — report entries anchor to it
 * so users can find the source file.
 */
export function convertBruRequest(
  blocks: BruBlock[],
  fallbackName: string,
  jsonPath: string,
  report: ImportReport,
): BrunoConvertedRequest {
  const meta = findBlock(blocks, 'meta');
  const name = (meta && entryValue(meta.entries, 'name')?.trim()) || fallbackName;
  const seqRaw = meta && entryValue(meta.entries, 'seq');
  const seq =
    seqRaw !== undefined && seqRaw.trim() !== '' && !Number.isNaN(Number(seqRaw)) ? Number(seqRaw) : undefined;

  const methodBlock = blocks.find((b) => (METHOD_BLOCKS as readonly string[]).includes(b.name));
  const method = coerceMethod(methodBlock?.name, jsonPath, report);
  const rawUrl = methodBlock ? (entryValue(methodBlock.entries, 'url') ?? '') : '';
  if (!methodBlock) {
    recordDrop(report, {
      path: jsonPath,
      reason: 'No method block (get/post/…) — imported as an empty GET.',
      tracking: 'PERMANENT: bru shape validation',
    });
  } else if (!rawUrl) {
    recordDrop(report, {
      path: `${jsonPath}.${methodBlock.name}.url`,
      reason: 'URL missing — defaulting to empty string.',
      tracking: 'PERMANENT: bru shape validation',
    });
  }
  const { base, params } = splitUrl(substitutePathParams(rawUrl, blocks));

  const headers: RequestHeader[] = [];
  const headersBlock = findBlock(blocks, 'headers');
  for (const e of headersBlock?.entries ?? []) {
    if (!e.key) continue;
    if (e.disabled) {
      headers.push({ uid: generateUid(), key: e.key, value: e.value, enabled: false });
    } else {
      headers.push({ uid: generateUid(), key: e.key, value: e.value });
    }
  }
  const { auth: authFromHeader, headers: headersWithoutAuth } = promoteAuthHeader(headers);
  const auth = resolveAuth(blocks, methodBlock, authFromHeader, jsonPath, report);

  // `params:query` is the current spelling; early collections used a
  // bare `query` block — both fold into the URL's own query params.
  const queryBlock = findBlock(blocks, 'params:query') ?? findBlock(blocks, 'query');
  for (const e of queryBlock?.entries ?? []) {
    if (!e.key) continue;
    params.push({
      uid: generateUid(),
      key: e.key,
      value: e.value,
      enabled: e.disabled ? false : undefined,
    });
  }

  const body = buildBody(blocks, methodBlock, meta, jsonPath, report);
  reportUnsupportedBlocks(blocks, jsonPath, report);

  return { request: { name, method, url: base, headers: headersWithoutAuth, params, auth, body }, seq };
}

/** `params:path` rows substitute the `:name` placeholders in the URL — same convention as Postman `url.variable`. */
function substitutePathParams(rawUrl: string, blocks: BruBlock[]): string {
  const pathBlock = findBlock(blocks, 'params:path');
  if (!pathBlock || rawUrl.length === 0) return rawUrl;
  let out = rawUrl;
  for (const e of pathBlock.entries) {
    if (!e.key || e.disabled) continue;
    const pattern = new RegExp(`:${escapeRegExp(e.key)}(?![a-zA-Z0-9_])`, 'g');
    out = out.replace(pattern, encodeURIComponent(e.value));
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coerceMethod(blockName: string | undefined, jsonPath: string, report: ImportReport): HttpMethod {
  if (!blockName) return 'GET';
  const upper = blockName.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) return upper as HttpMethod;
  recordDrop(report, {
    path: `${jsonPath}.${blockName}`,
    reason: `Unsupported HTTP method "${upper}" — defaulting to GET.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}

// ── Auth ───────────────────────────────────────────────────────────

function resolveAuth(
  blocks: BruBlock[],
  methodBlock: BruBlock | undefined,
  fallback: AuthConfig,
  jsonPath: string,
  report: ImportReport,
): AuthConfig {
  const selector = methodBlock ? (entryValue(methodBlock.entries, 'auth') ?? 'none') : 'none';
  // The selector names the active mode; a file can carry several
  // `auth:*` blocks with only one selected.
  switch (selector) {
    case 'none':
      return fallback;
    case 'basic': {
      const b = findBlock(blocks, 'auth:basic');
      return {
        type: 'basic',
        username: (b && entryValue(b.entries, 'username')) ?? '',
        password: (b && entryValue(b.entries, 'password')) ?? '',
      };
    }
    case 'bearer': {
      const b = findBlock(blocks, 'auth:bearer');
      return { type: 'bearer', token: (b && entryValue(b.entries, 'token')) ?? '' };
    }
    case 'apikey': {
      const b = findBlock(blocks, 'auth:apikey');
      const placement = (b && entryValue(b.entries, 'placement')) ?? 'header';
      return {
        type: 'api-key',
        key: (b && entryValue(b.entries, 'key')) ?? '',
        value: (b && entryValue(b.entries, 'value')) ?? '',
        in: placement === 'queryparams' ? 'query' : 'header',
      };
    }
    case 'inherit': {
      recordDrop(report, {
        path: `${jsonPath}.auth`,
        reason:
          'Auth is inherited from the folder/collection — collection-level auth is not imported; set auth on the request after import.',
        tracking: '#todo-collection-defaults',
      });
      return fallback;
    }
    case 'oauth2': {
      recordDrop(report, {
        path: `${jsonPath}.auth`,
        reason: 'OAuth 2.0 auth not imported — first-class OAuth support lands with §18.',
        tracking: '#todo-oauth',
      });
      return fallback;
    }
    case 'awsv4': {
      recordDrop(report, {
        path: `${jsonPath}.auth`,
        reason: 'AWS Signature v4 auth not imported — first-class support lands with §18.',
        tracking: '#todo-aws-sigv4',
      });
      return fallback;
    }
    case 'digest':
    case 'ntlm':
    case 'wsse': {
      recordDrop(report, {
        path: `${jsonPath}.auth`,
        reason: `${selector} auth not imported — only basic/bearer/apikey are supported in v1.`,
        tracking: '#todo-auth-types',
      });
      return fallback;
    }
    default: {
      recordDrop(report, {
        path: `${jsonPath}.auth`,
        reason: `Unknown auth mode "${selector}" — ignored.`,
        tracking: 'PERMANENT: auth picklist',
      });
      return fallback;
    }
  }
}

// ── Body ───────────────────────────────────────────────────────────

function buildBody(
  blocks: BruBlock[],
  methodBlock: BruBlock | undefined,
  meta: BruBlock | undefined,
  jsonPath: string,
  report: ImportReport,
): RequestBody {
  // The method block's `body:` value selects the active body; GraphQL
  // requests (`meta.type: graphql`) imply it when the selector is
  // absent.
  const metaType = meta && entryValue(meta.entries, 'type');
  const selector =
    (methodBlock && entryValue(methodBlock.entries, 'body')) ?? (metaType === 'graphql' ? 'graphql' : 'none');

  const textOf = (name: string): string => findBlock(blocks, name)?.text ?? '';

  switch (selector) {
    case 'none':
      return { type: 'none' };
    case 'json': {
      // Bare `body { … }` is the legacy spelling of `body:json { … }`.
      const content = textOf('body:json') || textOf('body');
      return content.length > 0 ? { type: 'json', content } : { type: 'none' };
    }
    case 'text': {
      const content = textOf('body:text');
      return content.length > 0 ? { type: 'text', content } : { type: 'none' };
    }
    case 'xml': {
      const content = textOf('body:xml');
      return content.length > 0 ? { type: 'xml', content } : { type: 'none' };
    }
    case 'graphql': {
      const query = textOf('body:graphql');
      const vars = textOf('body:graphql:vars');
      if (query.length === 0 && vars.length === 0) return { type: 'none' };
      return { type: 'graphql', content: query, graphqlVariables: vars.length > 0 ? vars : undefined };
    }
    case 'sparql': {
      const content = textOf('body:sparql');
      if (content.length === 0) return { type: 'none' };
      recordTransform(report, {
        path: `${jsonPath}.body`,
        from: 'sparql',
        to: 'text',
        reason: 'No dedicated SPARQL body type; kept as text. Set the Content-Type header manually if it is missing.',
        tracking: 'PERMANENT: body-type picklist',
      });
      return { type: 'text', content };
    }
    case 'formUrlEncoded':
    case 'form-urlencoded': {
      const block = findBlock(blocks, 'body:form-urlencoded');
      return {
        type: 'form',
        formParts: (block?.entries ?? [])
          .filter((e) => e.key)
          .map((e) => ({
            uid: generateUid(),
            key: e.key,
            value: e.value,
            enabled: e.disabled ? false : undefined,
          })),
      };
    }
    case 'multipartForm':
    case 'multipart-form':
      return multipartBody(findBlock(blocks, 'body:multipart-form'), jsonPath, report);
    case 'file':
      return fileBody(jsonPath, report);
    default: {
      recordDrop(report, {
        path: `${jsonPath}.body`,
        reason: `Unknown body mode "${selector}" — no body imported.`,
        tracking: 'PERMANENT: body-type picklist',
      });
      return { type: 'none' };
    }
  }
}

/** `@file(path/to/file)` values mark file parts; exports carry paths, never bytes. */
const FILE_VALUE = /^@file\(([^)]*)\)/;

function multipartBody(block: BruBlock | undefined, jsonPath: string, report: ImportReport): RequestBody {
  const parts: MultipartPart[] = [];
  let filePlaceholderCount = 0;
  for (const e of block?.entries ?? []) {
    if (!e.key || e.disabled) continue;
    const fileMatch = FILE_VALUE.exec(e.value.trim());
    if (fileMatch) {
      parts.push({
        kind: 'file',
        uid: generateUid(),
        name: e.key,
        fileRefs: [placeholderFileRef({ filename: basenameFromPath(fileMatch[1] ?? '') || 'unnamed' })],
      });
      filePlaceholderCount++;
      continue;
    }
    parts.push({ kind: 'text', uid: generateUid(), name: e.key, value: e.value });
  }
  if (filePlaceholderCount > 0) {
    recordTransform(report, {
      path: `${jsonPath}.body:multipart-form`,
      from: `multipart (${filePlaceholderCount} file part${filePlaceholderCount === 1 ? '' : 's'})`,
      to: 'multipart with placeholder FileRefs',
      reason: `.bru files reference file paths, not bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.`,
      tracking: '#todo-file-blobs',
    });
  }
  if (parts.length === 0) return { type: 'none' };
  return { type: 'multipart', multipartParts: parts };
}

/** Whole-file body — same placeholder path as the Postman/Insomnia raw-file modes. */
function fileBody(jsonPath: string, report: ImportReport): RequestBody {
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
      { kind: 'file', uid: generateUid(), name: 'file', fileRefs: [placeholderFileRef({ filename: 'binary-body' })] },
    ],
  };
}

function basenameFromPath(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = cleaned.lastIndexOf('/');
  return slash < 0 ? cleaned : cleaned.slice(slash + 1);
}

// ── Unsupported blocks ─────────────────────────────────────────────

const HANDLED_BLOCKS = new Set([
  'meta',
  ...METHOD_BLOCKS,
  'headers',
  'query',
  'params:query',
  'params:path',
  'body',
  'body:json',
  'body:text',
  'body:xml',
  'body:sparql',
  'body:graphql',
  'body:graphql:vars',
  'body:form-urlencoded',
  'body:multipart-form',
  'body:file',
  'auth:basic',
  'auth:bearer',
  'auth:apikey',
  'auth:oauth2',
  'auth:awsv4',
  'auth:digest',
  'auth:ntlm',
  'auth:wsse',
]);

function unsupportedDrop(name: string): { reason: string; tracking: string } {
  const head = name.split(':')[0] ?? name;
  if (head === 'script' || head === 'tests' || head === 'assert' || head === 'vars') {
    return {
      reason: `\`${name}\` block not imported — pre/post-request scripts, tests, and runtime vars need the offscreen-document sandbox (§19).`,
      tracking: '#todo-scripts',
    };
  }
  if (head === 'docs') {
    return {
      reason: '`docs` block not imported — request documentation has no destination field yet.',
      tracking: '#todo-request-docs',
    };
  }
  if (head === 'settings') {
    return {
      reason: '`settings` block not imported — per-request settings mapping is not wired to this importer yet.',
      tracking: '#todo-request-settings',
    };
  }
  return {
    reason: `Unknown block \`${name}\` — skipped.`,
    tracking: 'PERMANENT: block-type support',
  };
}

function reportUnsupportedBlocks(blocks: BruBlock[], jsonPath: string, report: ImportReport): void {
  const dropped = new Set<string>();
  for (const block of blocks) {
    if (HANDLED_BLOCKS.has(block.name) || dropped.has(block.name)) continue;
    dropped.add(block.name);
    const { reason, tracking } = unsupportedDrop(block.name);
    recordDrop(report, { path: `${jsonPath}.${block.name}`, reason, tracking });
  }
  for (const block of blocks) {
    if (block.kind === 'dict' && block.stray.length > 0 && HANDLED_BLOCKS.has(block.name)) {
      recordDrop(report, {
        path: `${jsonPath}.${block.name}`,
        reason: `${block.stray.length} line${block.stray.length === 1 ? '' : 's'} in \`${block.name}\` did not parse as \`key: value\` — skipped.`,
        tracking: 'PERMANENT: bru shape validation',
      });
    }
  }
}
