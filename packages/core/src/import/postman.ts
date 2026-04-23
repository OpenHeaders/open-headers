/**
 * Postman Collection v2.1 import — parse a Postman collection JSON
 * into V5-request-shaped entries + one `ImportReport` covering the
 * whole collection.
 *
 * Scope (v1, ARCHITECTURE.md §23):
 *   • Collection metadata — name, description, collection variables.
 *   • Folder tree — nested `item[]` with `name` + child `item[]` maps
 *     directly to a V5 folder path. Every folder's description is
 *     carried forward.
 *   • Requests — `name` + `request.{method,url,header,body,auth}`
 *     → `CurlRequest` shape for unified downstream handling with
 *     curl + HAR imports.
 *   • URL — string form passed through; object form collapsed to its
 *     `raw` field (Postman's documented canonical form) and query +
 *     path-variable arrays folded back into the URL string.
 *   • Auth — `basic` / `bearer` / `apikey` (header + query) promoted
 *     to first-class V5 auth types. `oauth2` / `awsv4` / `digest` /
 *     `hawk` / `ntlm` / `edgegrid` DROPPED with tracking pointers to
 *     §18 (first-class auth).
 *   • Body — `raw` (content-type from `options.raw.language`),
 *     `urlencoded`, `graphql`, `formdata` (text parts only — file
 *     parts tracked for §6 content-addressed storage). `file` /
 *     `binary` body modes DROPPED with tracking.
 *   • Scripts — `event: prerequest | test` DROPPED with tracking
 *     for §19 (scripts via offscreen document).
 *   • Responses — saved `response[]` entries ignored (they're capture
 *     artifacts, not authoring data).
 *   • Protocol-profile behavior, auth inheritance, cert config —
 *     ignored (extension context can't honor any of them).
 *
 * Format reference: schema v2.1.0 — https://schema.getpostman.com/json/collection/v2.1.0/collection.json
 *
 * One deliberate design choice: this parser does NOT rewrite the
 * `{{var}}` syntax. Postman and V5 both resolve flat `{{var}}`
 * against a scope chain (Postman: globals → environment → collection
 * → local; V5: env → collection → workspace → secret → vault). A
 * reference imported verbatim resolves correctly as long as the
 * referenced variable is defined somewhere in the chain.
 *
 * Postman's collection variables ARE imported here (`collectionVariables`
 * in the result). Postman's environments live in separate
 * `.postman_environment.json` files — import those via
 * `parsePostmanEnvironment` (same module) and wire them as V5
 * environments. The resolver's error-as-spec pipeline (Phase 3) then
 * surfaces any remaining unresolved references with a concrete hint.
 */

import { placeholderFileRef } from '../files';
import type {
  AuthConfig,
  HttpMethod,
  MultipartPart,
  QueryParam,
  RequestBody,
  RequestHeader,
} from '../types/v5/request';
import type { CurlRequest } from './curl';
import { createReport, type ImportReport, recordDrop, recordTransform } from './report';

// ── Types we read (subset of Postman Collection v2.1) ──────────────

interface PostmanCollection {
  info?: {
    name?: string;
    description?: string | { content?: string };
    _postman_id?: string;
    schema?: string;
  };
  item?: PostmanItem[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
  event?: PostmanEvent[];
  protocolProfileBehavior?: unknown;
}

interface PostmanItem {
  name?: string;
  description?: string | { content?: string };
  item?: PostmanItem[];
  request?: PostmanRequest | string;
  event?: PostmanEvent[];
  response?: unknown[];
  auth?: PostmanAuth;
}

interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
  description?: string | { content?: string };
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  path?: string | string[];
  port?: string;
  query?: Array<{ key?: string; value?: string; disabled?: boolean; description?: string }>;
  variable?: Array<{ key?: string; value?: string; description?: string }>;
  hash?: string;
}

interface PostmanHeader {
  key?: string;
  value?: string;
  disabled?: boolean;
  type?: string;
  description?: string | { content?: string };
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'binary' | string;
  raw?: string;
  urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean; description?: string }>;
  formdata?: Array<{
    key?: string;
    value?: string;
    type?: 'text' | 'file' | string;
    src?: string | string[];
    disabled?: boolean;
    description?: string;
  }>;
  file?: { src?: string; content?: string };
  graphql?: { query?: string; variables?: string };
  options?: {
    raw?: { language?: string };
  };
  disabled?: boolean;
}

interface PostmanAuth {
  type?:
    | 'noauth'
    | 'basic'
    | 'bearer'
    | 'apikey'
    | 'oauth1'
    | 'oauth2'
    | 'digest'
    | 'hawk'
    | 'awsv4'
    | 'ntlm'
    | 'edgegrid'
    | string;
  basic?: PostmanAuthParam[];
  bearer?: PostmanAuthParam[];
  apikey?: PostmanAuthParam[];
  [k: string]: unknown;
}

interface PostmanAuthParam {
  key?: string;
  value?: string;
  type?: string;
}

interface PostmanVariable {
  key?: string;
  value?: string;
  type?: string;
  description?: string;
}

interface PostmanEvent {
  listen?: 'prerequest' | 'test' | string;
  script?: { exec?: string | string[]; type?: string };
  disabled?: boolean;
}

// ── Output ─────────────────────────────────────────────────────────

/**
 * One request extracted from the collection — the V5-shaped
 * `CurlRequest` (reused so curl + HAR + Postman share one write
 * path downstream) plus the folder path it was nested under. The
 * path is ordered root→leaf and empty when the request lives at the
 * collection root.
 */
export interface PostmanParsedRequest {
  folderPath: string[];
  request: CurlRequest;
}

/**
 * Folders discovered during traversal. Callers may want to create
 * matching V5 folders and attach requests; or flatten entirely. The
 * parser only reports the structure — the UI decides the write
 * strategy.
 */
export interface PostmanParsedFolder {
  path: string[];
  description?: string;
}

/**
 * Normalized collection variable. Postman has no secret/default
 * split — every variable is effectively `default`, matching the V5
 * collection-variables model. The `type` is pinned to `'default'`
 * here; callers promoting to secret do so via UI.
 */
export interface PostmanCollectionVariable {
  name: string;
  value: string;
  type: 'default';
  description?: string;
}

export interface PostmanParseResult {
  collectionName: string;
  collectionDescription: string;
  collectionVariables: PostmanCollectionVariable[];
  folders: PostmanParsedFolder[];
  requests: PostmanParsedRequest[];
  report: ImportReport;
}

export class PostmanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostmanParseError';
  }
}

// ── Postman Environment (.postman_environment.json) ────────────────

/**
 * A Postman environment file has a different top-level shape than a
 * collection — no `info` or `item`, just `name` + `values[]`. Users
 * export environments separately in Postman, so this parser handles
 * them as a sibling flow. Both share the same ImportReport scaffold.
 */
interface PostmanEnvironmentFile {
  id?: string;
  name?: string;
  values?: Array<{
    key?: string;
    value?: string;
    type?: 'default' | 'secret' | 'any' | string;
    enabled?: boolean;
    description?: string;
  }>;
  _postman_variable_scope?: string;
}

/**
 * Normalized variable — matches `V5.Variable`. `type: 'secret'`
 * lands verbatim so the V5 secret/default split is preserved.
 */
export interface PostmanParsedEnvironmentVariable {
  name: string;
  value: string;
  type: 'default' | 'secret';
  description?: string;
}

export interface PostmanEnvironmentParseResult {
  name: string;
  variables: PostmanParsedEnvironmentVariable[];
  report: ImportReport;
}

/**
 * Parse a Postman environment JSON. Returns the name + a list of
 * variables ready to be attached to a fresh V5 Environment.
 * Disabled entries are dropped with tracking. Non-string values are
 * coerced via `String(...)` rather than dropped — an environment
 * with a numeric port number is still useful to import.
 */
export function parsePostmanEnvironment(input: string): PostmanEnvironmentParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new PostmanParseError(
      `Postman environment is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new PostmanParseError('Expected a JSON object with `name` + `values` fields.');
  }
  const file = parsed as PostmanEnvironmentFile;
  const scope = file._postman_variable_scope ?? '';
  if (scope && scope !== 'environment') {
    throw new PostmanParseError(`Expected a Postman environment file (scope: "environment"), got scope "${scope}".`);
  }

  const name = (file.name ?? 'Imported Environment').trim() || 'Imported Environment';
  const report = createReport('postman-v2.1', 0);
  const variables: PostmanParsedEnvironmentVariable[] = [];

  if (Array.isArray(file.values)) {
    for (let i = 0; i < file.values.length; i++) {
      const v = file.values[i];
      const jsonPath = `environment.values[${i}]`;
      const key = v?.key?.trim();
      if (!key) {
        recordDrop(report, {
          path: jsonPath,
          reason: 'Variable has no `key` — skipped.',
          tracking: 'PERMANENT: Postman environment shape',
        });
        continue;
      }
      if (v?.enabled === false) {
        recordDrop(report, {
          path: jsonPath,
          reason: `Variable "${key}" is disabled — not imported.`,
          tracking: 'PERMANENT: Postman disabled-variable policy',
        });
        continue;
      }
      const value = typeof v?.value === 'string' ? v.value : String(v?.value ?? '');
      const type: 'default' | 'secret' = v?.type === 'secret' ? 'secret' : 'default';
      variables.push({
        name: key,
        value,
        type,
        description: v?.description,
      });
    }
  }

  report.summary = { ...report.summary, imported: variables.length };
  return { name, variables, report };
}

// ── Entry point ────────────────────────────────────────────────────

const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export function parsePostman(input: string): PostmanParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new PostmanParseError(
      `Postman collection is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new PostmanParseError('Expected a JSON object with `info` + `item` fields.');
  }
  const collection = parsed as PostmanCollection;

  const schema = collection.info?.schema ?? '';
  if (schema && !/collection\/v2\.1/.test(schema)) {
    // Non-fatal: we can often still read v2.0 / v1 exports but the
    // user should know they're off the documented path. v1 is
    // structurally different and will probably drop most requests;
    // we try anyway rather than hard-fail.
    // (No report entry yet — the per-request drops will tell the
    // whole story.)
  }

  const collectionName = (collection.info?.name ?? 'Imported Collection').trim() || 'Imported Collection';
  const collectionDescription = textOf(collection.info?.description) ?? '';
  const report = createReport('postman-v2.1', 0);

  // Collection-level scripts — drop with one aggregate entry.
  if (Array.isArray(collection.event) && collection.event.length > 0) {
    for (const ev of collection.event) {
      if (ev.disabled) continue;
      recordDrop(report, {
        path: `collection.event[${ev.listen}]`,
        reason: `Collection-level ${ev.listen ?? 'unknown'} script not imported — pre-request/test scripts need the offscreen-document sandbox (§19).`,
        tracking: '#todo-scripts',
      });
    }
  }

  // Collection-level auth at the top level is inherited by every
  // request that doesn't override. We'd need a full inheritance
  // walker to apply it correctly; v1 only applies auth declared on
  // the request itself. Log as a transform so users know.
  if (collection.auth?.type && collection.auth.type !== 'noauth') {
    recordTransform(report, {
      path: 'collection.auth',
      from: `collection default: ${collection.auth.type}`,
      to: 'ignored',
      reason:
        'Collection-level default auth inheritance not supported; set auth on each request (or the folder) instead.',
      tracking: '#todo-auth-inheritance',
    });
  }

  // Variables.
  const collectionVariables: PostmanCollectionVariable[] = [];
  if (Array.isArray(collection.variable)) {
    for (const v of collection.variable) {
      const name = v?.key?.trim();
      if (!name) continue;
      collectionVariables.push({
        name,
        value: typeof v.value === 'string' ? v.value : '',
        type: 'default',
        description: v.description,
      });
    }
  }

  // Walk the item tree.
  const folders: PostmanParsedFolder[] = [];
  const requests: PostmanParsedRequest[] = [];
  walkItems(collection.item ?? [], [], 'collection.item', folders, requests, report);

  report.summary = { ...report.summary, imported: requests.length };

  return {
    collectionName,
    collectionDescription,
    collectionVariables,
    folders,
    requests,
    report,
  };
}

// ── Traversal ──────────────────────────────────────────────────────

function walkItems(
  items: PostmanItem[],
  parentPath: string[],
  pathPointer: string,
  folders: PostmanParsedFolder[],
  requests: PostmanParsedRequest[],
  report: ImportReport,
): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') continue;
    const jsonPath = `${pathPointer}[${i}]`;

    const isFolder = Array.isArray(item.item);
    if (isFolder) {
      const folderName = (item.name ?? 'Untitled Folder').trim() || 'Untitled Folder';
      const path = [...parentPath, folderName];
      folders.push({
        path,
        description: textOf(item.description),
      });

      // Folder-level scripts.
      if (Array.isArray(item.event) && item.event.length > 0) {
        for (const ev of item.event) {
          if (ev.disabled) continue;
          recordDrop(report, {
            path: `${jsonPath}.event[${ev.listen}]`,
            reason: `Folder-level ${ev.listen ?? 'unknown'} script not imported — pre-request/test scripts need the offscreen-document sandbox (§19).`,
            tracking: '#todo-scripts',
          });
        }
      }

      // Folder-level auth (same inheritance limitation as collection level).
      if (item.auth?.type && item.auth.type !== 'noauth') {
        recordTransform(report, {
          path: `${jsonPath}.auth`,
          from: `folder default: ${item.auth.type}`,
          to: 'ignored',
          reason: 'Folder-level default auth inheritance not supported; set auth on each request instead.',
          tracking: '#todo-auth-inheritance',
        });
      }

      walkItems(item.item ?? [], path, `${jsonPath}.item`, folders, requests, report);
      continue;
    }

    // Request item.
    const request = tryConvertRequest(item, jsonPath, report);
    if (request) {
      requests.push({ folderPath: parentPath, request });
    }
  }
}

function tryConvertRequest(item: PostmanItem, jsonPath: string, report: ImportReport): CurlRequest | null {
  const name = (item.name ?? 'Untitled Request').trim() || 'Untitled Request';

  // `request` can be a string shorthand for GET <url>.
  if (typeof item.request === 'string') {
    const { base, params } = splitUrl(item.request);
    return {
      name,
      method: 'GET',
      url: base,
      headers: [],
      params,
      auth: { type: 'none' },
      body: { type: 'none' },
    };
  }

  const req = item.request;
  if (!req || typeof req !== 'object') {
    recordDrop(report, {
      path: `${jsonPath}.request`,
      reason: 'Item has no `request` field — skipped.',
      tracking: 'PERMANENT: Postman shape validation',
    });
    return null;
  }

  const method = coerceMethod(req.method, jsonPath, report);
  const url = buildUrl(req.url, jsonPath, report);
  const headerCollection = buildHeaders(req.header ?? [], jsonPath, report);
  // Promote Authorization header BEFORE layering the explicit auth
  // on top — explicit Postman auth wins over any implicit header.
  const { auth: authFromHeader, headers: headersWithoutAuth } = promoteAuthHeader(headerCollection);
  const { auth: finalAuth } = resolveAuth(req.auth, authFromHeader, jsonPath, report);
  const body = buildBody(req.body, headersWithoutAuth, jsonPath, report);

  // Item-level event scripts.
  if (Array.isArray(item.event) && item.event.length > 0) {
    for (const ev of item.event) {
      if (ev.disabled) continue;
      recordDrop(report, {
        path: `${jsonPath}.event[${ev.listen}]`,
        reason: `${ev.listen ?? 'unknown'} script not imported — pre-request/test scripts need the offscreen-document sandbox (§19).`,
        tracking: '#todo-scripts',
      });
    }
  }

  // Saved responses.
  if (Array.isArray(item.response) && item.response.length > 0) {
    recordDrop(report, {
      path: `${jsonPath}.response`,
      reason: `${item.response.length} saved response${item.response.length === 1 ? '' : 's'} ignored — responses aren't authoring data.`,
      tracking: 'PERMANENT: response history lives in IDB (§8), not in imports',
    });
  }

  const { base, params } = splitUrl(url);

  return {
    name,
    method,
    url: base,
    headers: headersWithoutAuth,
    params,
    auth: finalAuth,
    body,
  };
}

// ── URL handling ────────────────────────────────────────────────────

function buildUrl(url: PostmanUrl | string | undefined, jsonPath: string, report: ImportReport): string {
  if (typeof url === 'string') return url;
  if (!url || typeof url !== 'object') {
    recordDrop(report, {
      path: `${jsonPath}.request.url`,
      reason: 'URL missing — defaulting to empty string.',
      tracking: 'PERMANENT: Postman shape validation',
    });
    return '';
  }
  if (typeof url.raw === 'string' && url.raw.length > 0) {
    // Path variables: `{{foo}}` in raw stays literal so the V5
    // resolver can fill it. `:foo` in the path is Postman's own
    // placeholder syntax — substitute from `variable[]` if present.
    return substitutePathVars(url.raw, url.variable);
  }
  // Build from structured parts. This is the fallback for exports
  // where `raw` is missing.
  const protocol = url.protocol ?? 'https';
  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '');
  const port = url.port ? `:${url.port}` : '';
  const path = Array.isArray(url.path) ? `/${url.path.join('/')}` : (url.path ?? '');
  const query = Array.isArray(url.query)
    ? url.query
        .filter((q) => !q.disabled && q.key)
        .map((q) => `${encodeURIComponent(q.key ?? '')}=${encodeURIComponent(q.value ?? '')}`)
        .join('&')
    : '';
  const queryStr = query.length > 0 ? `?${query}` : '';
  return `${protocol}://${host}${port}${path}${queryStr}`;
}

function substitutePathVars(raw: string, variables: PostmanUrl['variable']): string {
  if (!Array.isArray(variables) || variables.length === 0) return raw;
  let out = raw;
  for (const v of variables) {
    if (!v.key) continue;
    const pattern = new RegExp(`:${escapeRegExp(v.key)}(?![a-zA-Z0-9_])`, 'g');
    out = out.replace(pattern, encodeURIComponent(v.value ?? ''));
  }
  return out;
}

function splitUrl(raw: string): { base: string; params: QueryParam[] } {
  if (!raw) return { base: '', params: [] };
  const hashIndex = raw.indexOf('#');
  const withoutFragment = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) return { base: withoutFragment, params: [] };
  const base = withoutFragment.slice(0, queryIndex);
  const query = withoutFragment.slice(queryIndex + 1);
  const params: QueryParam[] = [];
  for (const entry of query.split('&')) {
    if (entry.length === 0) continue;
    const eq = entry.indexOf('=');
    if (eq < 0) {
      params.push({ key: safeDecode(entry), value: '' });
    } else {
      params.push({ key: safeDecode(entry.slice(0, eq)), value: safeDecode(entry.slice(eq + 1)) });
    }
  }
  return { base, params };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Headers + auth ─────────────────────────────────────────────────

function buildHeaders(raw: PostmanHeader[], _jsonPath: string, _report: ImportReport): RequestHeader[] {
  const out: RequestHeader[] = [];
  for (const h of raw) {
    const key = h.key?.trim();
    if (!key) continue;
    const value = typeof h.value === 'string' ? h.value : '';
    // Disabled headers land as explicit `enabled: false` so the
    // editor can preserve the user's intent rather than silently
    // dropping the header.
    if (h.disabled) {
      out.push({ key, value, enabled: false });
    } else {
      out.push({ key, value });
    }
  }
  return out;
}

function promoteAuthHeader(headers: RequestHeader[]): { auth: AuthConfig; headers: RequestHeader[] } {
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
    const decoded = safeBase64Decode(b64);
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

function safeBase64Decode(value: string): string | null {
  try {
    return typeof atob === 'function' ? atob(value) : Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function resolveAuth(
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

// ── Body ───────────────────────────────────────────────────────────

function buildBody(
  body: PostmanBody | undefined,
  headers: RequestHeader[],
  jsonPath: string,
  report: ImportReport,
): RequestBody {
  if (!body || body.disabled || !body.mode) return { type: 'none' };

  switch (body.mode) {
    case 'raw': {
      const content = typeof body.raw === 'string' ? body.raw : '';
      if (content.length === 0) return { type: 'none' };
      const language = body.options?.raw?.language?.toLowerCase();
      if (language === 'json') return { type: 'json', content };
      if (language === 'xml') return { type: 'xml', content };
      if (language === 'graphql') return { type: 'graphql', content };
      if (language === 'html') {
        recordTransform(report, {
          path: `${jsonPath}.request.body`,
          from: 'raw/html',
          to: 'text',
          reason: 'No dedicated HTML body type in V5; kept as text. Set Content-Type manually.',
          tracking: 'PERMANENT: body-type picklist',
        });
        return { type: 'text', content };
      }
      if (language === 'javascript') {
        recordTransform(report, {
          path: `${jsonPath}.request.body`,
          from: 'raw/javascript',
          to: 'text',
          reason: 'No dedicated JavaScript body type in V5; kept as text.',
          tracking: 'PERMANENT: body-type picklist',
        });
        return { type: 'text', content };
      }
      // Infer from Content-Type header if language isn't set.
      const contentType = contentTypeOf(headers) ?? '';
      if (/application\/json/i.test(contentType)) return { type: 'json', content };
      if (/application\/xml|text\/xml/i.test(contentType)) return { type: 'xml', content };
      if (/application\/x-www-form-urlencoded/i.test(contentType)) {
        // Promote the raw text to structured form fields so the editor's
        // form-urlencoded tab renders them. Importers seeing a `raw`
        // body with a urlencoded Content-Type usually mean the user
        // copy-pasted `key=value&key2=value2` into the raw box.
        return { type: 'form', formParts: parseUrlEncodedToFormFields(content) };
      }
      return { type: 'text', content };
    }
    case 'urlencoded': {
      const items = Array.isArray(body.urlencoded) ? body.urlencoded : [];
      // Postman's urlencoded mode is structured already — preserve the
      // per-row enabled flag + description so importing a Postman
      // collection round-trips through our editor without losing any
      // metadata. Disabled rows persist; description goes into the per
      // row note column.
      const formParts = items
        .filter((p) => p.key)
        .map((p) => ({
          key: p.key ?? '',
          value: typeof p.value === 'string' ? p.value : '',
          enabled: p.disabled ? false : undefined,
          description: typeof p.description === 'string' && p.description ? p.description : undefined,
        }));
      return { type: 'form', formParts };
    }
    case 'graphql': {
      const gql = body.graphql ?? {};
      return {
        type: 'graphql',
        content: typeof gql.query === 'string' ? gql.query : '',
        graphqlVariables: typeof gql.variables === 'string' ? gql.variables : undefined,
      };
    }
    case 'formdata': {
      const raw = Array.isArray(body.formdata) ? body.formdata : [];
      const parts: MultipartPart[] = [];
      let filePlaceholderCount = 0;
      for (const p of raw) {
        if (p.disabled) continue;
        const name = typeof p.key === 'string' ? p.key : '';
        if (p.type === 'file') {
          // `src` can be a single string or an array (multi-file pick).
          // Emit one placeholder FileRef per entry; empty `src` falls
          // back to a single unnamed placeholder.
          const srcArr = Array.isArray(p.src) ? p.src : typeof p.src === 'string' ? [p.src] : [];
          const fileRefs =
            srcArr.length > 0
              ? srcArr.map((s) => placeholderFileRef({ filename: basenameFromPath(s ?? '') || 'unnamed' }))
              : [placeholderFileRef({ filename: (typeof p.value === 'string' ? p.value : name) || 'unnamed' })];
          parts.push({ kind: 'file', name, fileRefs });
          filePlaceholderCount += fileRefs.length;
          continue;
        }
        parts.push({ kind: 'text', name, value: typeof p.value === 'string' ? p.value : '' });
      }
      if (filePlaceholderCount > 0) {
        recordTransform(report, {
          path: `${jsonPath}.request.body.formdata`,
          from: `formdata (${filePlaceholderCount} file part${filePlaceholderCount === 1 ? '' : 's'})`,
          to: 'multipart with placeholder FileRefs',
          reason: `Postman collections don't include file bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.`,
          tracking: '#todo-file-blobs',
        });
      }
      if (parts.length === 0) return { type: 'none' };
      return { type: 'multipart', multipartParts: parts };
    }
    case 'file': {
      // Postman's `file` body mode ships an entire file as the request
      // body (not inside a multipart envelope). V5 expresses this as a
      // multipart body with a single file part so the UI can prompt
      // for reconciliation through the same affordance.
      const src = typeof body.file?.src === 'string' ? body.file.src : undefined;
      const filename = src ? basenameFromPath(src) : 'binary-body';
      recordTransform(report, {
        path: `${jsonPath}.request.body`,
        from: 'file (raw binary body)',
        to: 'multipart with placeholder FileRef',
        reason: `Postman's raw-file body landed as a one-part multipart placeholder so reconciliation uses the same UI as every other importer. If the target API wants a raw binary body (not multipart), switch the body type after upload.`,
        tracking: '#todo-file-blobs',
      });
      return {
        type: 'multipart',
        multipartParts: [
          {
            kind: 'file',
            name: 'file',
            fileRefs: [placeholderFileRef({ filename: filename || 'binary-body' })],
          },
        ],
      };
    }
    case 'binary': {
      recordDrop(report, {
        path: `${jsonPath}.request.body`,
        reason:
          'Binary body not imported — Postman does not record the bytes. Open the request editor, switch Body type to Multipart, and upload the file manually.',
        tracking: '#todo-file-blobs',
      });
      return { type: 'none' };
    }
    default: {
      recordDrop(report, {
        path: `${jsonPath}.request.body`,
        reason: `Unknown body mode "${body.mode}" — dropped.`,
        tracking: 'PERMANENT: body-mode picklist',
      });
      return { type: 'none' };
    }
  }
}

function contentTypeOf(headers: readonly RequestHeader[]): string | null {
  for (const h of headers) {
    if (h.key.toLowerCase() === 'content-type') return h.value;
  }
  return null;
}

/**
 * Split a `key=value&key2=value2` string into structured form fields.
 * URL-decoding of both key and value matches what the wire decoder
 * does, so what the user sees in the editor is what the executor will
 * send. Empty `=` keys (`=value`, `key=`) are kept — the executor
 * preserves them too. A bare `?` row with no `=` becomes a key-only
 * field with empty value.
 */
function parseUrlEncodedToFormFields(encoded: string): Array<{ key: string; value: string }> {
  if (!encoded) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const segment of encoded.split('&')) {
    if (segment.length === 0) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq < 0 ? segment : segment.slice(0, eq);
    const rawValue = eq < 0 ? '' : segment.slice(eq + 1);
    out.push({ key: safeUrlDecode(rawKey), value: safeUrlDecode(rawValue) });
  }
  return out;
}

function safeUrlDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function coerceMethod(raw: string | undefined, jsonPath: string, report: ImportReport): HttpMethod {
  if (typeof raw !== 'string' || raw.length === 0) {
    recordDrop(report, {
      path: `${jsonPath}.request.method`,
      reason: 'Method missing — defaulting to GET.',
      tracking: 'PERMANENT: Postman shape validation',
    });
    return 'GET';
  }
  const upper = raw.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) return upper as HttpMethod;
  recordDrop(report, {
    path: `${jsonPath}.request.method`,
    reason: `Unknown HTTP method "${raw}" — defaulting to GET.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}

function basenameFromPath(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = cleaned.lastIndexOf('/');
  return slash < 0 ? cleaned : cleaned.slice(slash + 1);
}

function textOf(raw: string | { content?: string } | undefined): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.content === 'string') return raw.content;
  return undefined;
}
