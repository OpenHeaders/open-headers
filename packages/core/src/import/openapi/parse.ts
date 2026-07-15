import { parse as parseYaml } from 'yaml';
import type { QueryParam, RequestHeader } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import type { CurlRequest } from '../curl';
import { isRecord } from '../data-scan/json';
import { createReport, type ImportReport, recordDrop, recordTransform } from '../report';
import { createRefResolver, type RefFailure, type RefResolver } from './ref';
import type {
  OpenApiCollectionVariable,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiParsedFolder,
  OpenApiParsedRequest,
  OpenApiParseResult,
  OpenApiServer,
} from './types';
import { OpenApiParseError } from './types';

// ── Entry point ────────────────────────────────────────────────────

/**
 * Parse an OpenAPI 3.x document (JSON or YAML) into one collection of
 * requests: `servers[0]` becomes the `{{baseUrl}}` collection
 * variable, `paths` × operations become requests, first tags become
 * folders, and path templating (`{id}`) rewrites to `{{id}}` template
 * references. This slice maps the request skeleton — bodies, security
 * schemes, and response examples land as honest `#todo-openapi-*`
 * notes until their slices absorb them.
 */
export function parseOpenApi(input: string): OpenApiParseResult {
  const doc = parseDocument(input);

  if (typeof doc.swagger === 'string') {
    throw new OpenApiParseError(
      `Swagger ${doc.swagger} documents aren't supported yet — convert to OpenAPI 3.x and re-import.`,
    );
  }
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new OpenApiParseError('Not a recognized OpenAPI document — expected an `openapi: 3.x` version field.');
  }

  const report = createReport('openapi', 0);
  const resolver = createRefResolver(doc);

  const info = isRecord(doc.info) ? doc.info : {};
  const collectionName =
    typeof info.title === 'string' && info.title.trim() !== '' ? info.title.trim() : 'Imported API';
  const descriptionParts: string[] = [];
  if (typeof info.description === 'string' && info.description.trim() !== '') {
    descriptionParts.push(info.description.trim());
  }
  if (typeof info.version === 'string' && info.version.trim() !== '') {
    descriptionParts.push(`API version: ${info.version.trim()}`);
  }

  const variables = new Map<string, OpenApiCollectionVariable>();
  variables.set('baseUrl', { name: 'baseUrl', value: readRootBaseUrl(doc.servers, report), type: 'default' });

  const assembly: Assembly = {
    report,
    resolver,
    variables,
    folders: [],
    folderTags: new Set<string>(),
    tagDescriptions: readTagDescriptions(doc.tags),
    requests: [],
    cookieParams: 0,
    securedOperations: 0,
    documentedResponses: 0,
    callbacks: 0,
  };

  const paths = isRecord(doc.paths) ? doc.paths : undefined;
  if (paths === undefined || Object.keys(paths).length === 0) {
    recordDrop(report, {
      path: 'paths',
      reason: 'The document declares no paths — there are no requests to import.',
    });
  } else {
    for (const [pathKey, rawItem] of Object.entries(paths)) {
      walkPathItem(pathKey, rawItem, assembly);
    }
  }

  recordAggregates(doc, assembly);
  report.summary = { ...report.summary, imported: assembly.requests.length };

  return {
    collectionName,
    collectionDescription: descriptionParts.join('\n\n'),
    collectionVariables: [...variables.values()],
    folders: assembly.folders,
    requests: assembly.requests,
    report,
  };
}

function parseDocument(input: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    try {
      parsed = parseYaml(input);
    } catch (err) {
      throw new OpenApiParseError(
        `OpenAPI document is not valid JSON or YAML: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!isRecord(parsed)) throw new OpenApiParseError('Expected an OpenAPI document object.');
  return parsed;
}

// ── Servers ────────────────────────────────────────────────────────

/**
 * Resolve a Server Object's URL: `{var}` placeholders substitute their
 * declared `default` (else first `enum` entry), recorded as one
 * transform — the substitution is the spec's own resolution rule, but
 * a rewrite is never silent.
 */
function resolveServerUrl(server: OpenApiServer, jsonPath: string, report: ImportReport): string {
  const raw = typeof server.url === 'string' ? server.url : '';
  const vars: Record<string, unknown> = isRecord(server.variables) ? server.variables : {};
  const substituted: string[] = [];
  const resolved = raw.replace(/\{([^{}]+)\}/g, (whole, name: string) => {
    const declared = vars[name];
    if (!isRecord(declared)) return whole;
    substituted.push(`{${name}}`);
    if (typeof declared.default === 'string') return declared.default;
    const enumFirst = Array.isArray(declared.enum) ? declared.enum[0] : undefined;
    return typeof enumFirst === 'string' ? enumFirst : '';
  });
  if (substituted.length > 0) {
    recordTransform(report, {
      path: jsonPath,
      from: `server variable${substituted.length === 1 ? '' : 's'} ${substituted.join(', ')}`,
      to: 'default values',
      reason: 'Server-URL variables were filled from their declared defaults — the spec resolves them the same way.',
    });
  }
  return resolved;
}

function readRootBaseUrl(rawServers: unknown, report: ImportReport): string {
  const servers = Array.isArray(rawServers) ? rawServers.filter(isRecord) : [];
  if (servers.length === 0) {
    recordTransform(report, {
      path: 'servers',
      from: 'document without servers',
      to: 'empty {{baseUrl}} collection variable',
      reason: 'The document declares no servers — set {{baseUrl}} in the collection variables before sending.',
    });
    return '';
  }
  const first = servers[0] as OpenApiServer;
  const baseUrl = resolveServerUrl(first, 'servers[0]', report);
  if (servers.length > 1) {
    const others = servers
      .slice(1)
      .map((s) => (typeof s.url === 'string' ? s.url : '(no url)'))
      .join(', ');
    recordTransform(report, {
      path: 'servers',
      from: `${servers.length} servers`,
      to: '{{baseUrl}} = first server',
      reason: `Only one base URL imports — the first server became {{baseUrl}}; also declared: ${others}.`,
    });
  }
  return baseUrl;
}

// ── Tags → folders ─────────────────────────────────────────────────

function readTagDescriptions(rawTags: unknown): Map<string, string> {
  const descriptions = new Map<string, string>();
  if (!Array.isArray(rawTags)) return descriptions;
  for (const tag of rawTags) {
    if (!isRecord(tag) || typeof tag.name !== 'string' || tag.name === '') continue;
    if (typeof tag.description === 'string' && tag.description !== '') descriptions.set(tag.name, tag.description);
  }
  return descriptions;
}

// ── Paths × operations ─────────────────────────────────────────────

interface Assembly {
  report: ImportReport;
  resolver: RefResolver;
  variables: Map<string, OpenApiCollectionVariable>;
  folders: OpenApiParsedFolder[];
  folderTags: Set<string>;
  tagDescriptions: Map<string, string>;
  requests: OpenApiParsedRequest[];
  cookieParams: number;
  securedOperations: number;
  documentedResponses: number;
  callbacks: number;
}

const METHOD_KEYS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function refDropReason(failure: RefFailure): string {
  switch (failure.kind) {
    case 'external':
      return `External reference "${failure.ref}" not followed — the importer never fetches remote documents; inline the definition and re-import.`;
    case 'missing':
      return `Reference "${failure.ref}" points at nothing in this document — skipped.`;
    case 'circular':
      return `Reference "${failure.ref}" is circular — skipped.`;
  }
}

function walkPathItem(pathKey: string, rawItem: unknown, assembly: Assembly): void {
  const { report, resolver } = assembly;
  const jsonPath = `paths.${pathKey}`;
  const resolved = resolver.resolve(rawItem);
  if (!resolved.ok) {
    recordDrop(report, { path: jsonPath, reason: refDropReason(resolved.failure) });
    return;
  }
  if (!isRecord(resolved.value)) {
    recordDrop(report, { path: jsonPath, reason: 'Path item is not an object — skipped.' });
    return;
  }
  const item = resolved.value;
  const pathParameters = readParameters(item.parameters, `${jsonPath}.parameters`, assembly);
  const pathServers = Array.isArray(item.servers) ? item.servers.filter(isRecord) : [];

  for (const key of Object.keys(item)) {
    if (!METHOD_KEYS.has(key)) continue;
    const method = key.toUpperCase();
    const opPath = `${jsonPath}.${key}`;
    if (key === 'trace') {
      recordDrop(report, {
        path: opPath,
        reason: 'TRACE operation not imported — browsers refuse to send TRACE requests.',
        tracking: 'PERMANENT: fetch() forbids TRACE',
      });
      continue;
    }
    const rawOp = item[key];
    if (!isRecord(rawOp)) {
      recordDrop(report, { path: opPath, reason: 'Operation is not an object — skipped.' });
      continue;
    }
    convertOperation(pathKey, method, rawOp as OpenApiOperation, pathParameters, pathServers, opPath, assembly);
  }
}

/**
 * Resolve a parameter list. Entries that fail to resolve or carry no
 * usable `name`/`in` drop with a reason; everything else returns as a
 * concrete parameter for the merge step.
 */
function readParameters(raw: unknown, jsonPath: string, assembly: Assembly): OpenApiParameter[] {
  if (!Array.isArray(raw)) return [];
  const parameters: OpenApiParameter[] = [];
  raw.forEach((entry, i) => {
    const resolved = assembly.resolver.resolve(entry);
    if (!resolved.ok) {
      recordDrop(assembly.report, { path: `${jsonPath}[${i}]`, reason: refDropReason(resolved.failure) });
      return;
    }
    const param = resolved.value;
    if (!isRecord(param) || typeof param.name !== 'string' || param.name === '' || typeof param.in !== 'string') {
      recordDrop(assembly.report, {
        path: `${jsonPath}[${i}]`,
        reason: 'Parameter has no usable `name`/`in` — skipped.',
      });
      return;
    }
    parameters.push(param as OpenApiParameter);
  });
  return parameters;
}

/** Operation-level parameters override path-level ones by `name` + `in` (the spec's merge rule). */
function mergeParameters(pathLevel: OpenApiParameter[], opLevel: OpenApiParameter[]): OpenApiParameter[] {
  const byIdentity = new Map<string, OpenApiParameter>();
  for (const param of [...pathLevel, ...opLevel]) {
    byIdentity.set(`${param.in} ${param.name}`, param);
  }
  return [...byIdentity.values()];
}

/**
 * Best-effort example value for a parameter row: `example`, first of
 * `examples`, then the schema's `default` / `example` / first `enum`
 * entry. Scalars stringify plainly; structured values JSON-encode.
 */
function exampleValue(param: OpenApiParameter, resolver: RefResolver): string {
  const direct = scalarString(param.example);
  if (direct !== undefined) return direct;
  if (isRecord(param.examples)) {
    for (const candidate of Object.values(param.examples)) {
      const resolved = resolver.resolve(candidate);
      if (resolved.ok && isRecord(resolved.value)) {
        const fromExample = scalarString(resolved.value.value);
        if (fromExample !== undefined) return fromExample;
      }
    }
  }
  const schema = resolver.resolve(param.schema);
  if (schema.ok && isRecord(schema.value)) {
    const fromDefault = scalarString(schema.value.default);
    if (fromDefault !== undefined) return fromDefault;
    const fromExample = scalarString(schema.value.example);
    if (fromExample !== undefined) return fromExample;
    if (Array.isArray(schema.value.enum)) {
      const fromEnum = scalarString(schema.value.enum[0]);
      if (fromEnum !== undefined) return fromEnum;
    }
  }
  return '';
}

function scalarString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value !== null && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function convertOperation(
  pathKey: string,
  method: string,
  op: OpenApiOperation,
  pathParameters: OpenApiParameter[],
  pathServers: Record<string, unknown>[],
  jsonPath: string,
  assembly: Assembly,
): void {
  const { report, resolver } = assembly;

  const summary = typeof op.summary === 'string' && op.summary.trim() !== '' ? op.summary.trim() : undefined;
  const operationId =
    typeof op.operationId === 'string' && op.operationId.trim() !== '' ? op.operationId.trim() : undefined;
  const name = summary ?? operationId ?? `${method} ${pathKey}`;

  const descriptionParts: string[] = [];
  if (typeof op.description === 'string' && op.description.trim() !== '') descriptionParts.push(op.description.trim());
  if (op.deprecated === true) descriptionParts.push('Deprecated.');
  const description = descriptionParts.join('\n\n');

  // Base URL: {{baseUrl}} unless the operation (or its path item)
  // declares its own servers — those pin the first declared server
  // literally, recorded as a transform.
  let base = '{{baseUrl}}';
  const ownServers = Array.isArray(op.servers) ? op.servers.filter(isRecord) : pathServers;
  if (ownServers.length > 0) {
    base = resolveServerUrl(ownServers[0] as OpenApiServer, `${jsonPath}.servers[0]`, report);
    recordTransform(report, {
      path: `${jsonPath}.servers`,
      from: 'operation-level servers',
      to: base,
      reason: 'This operation declares its own servers — the first one became the request base URL.',
    });
  }

  // Path templating: `{id}` → `{{id}}` template references.
  const templated = pathKey.replace(/\{([^{}]+)\}/g, '{{$1}}');
  if (templated !== pathKey) {
    recordTransform(report, {
      path: `${jsonPath}.url`,
      from: `path template ${pathKey}`,
      to: templated,
      reason: 'OpenAPI path parameters became variable references — values resolve from collection variables.',
    });
  }

  const merged = mergeParameters(pathParameters, readParameters(op.parameters, `${jsonPath}.parameters`, assembly));
  const params: QueryParam[] = [];
  const headers: RequestHeader[] = [];
  for (const param of merged) {
    const paramName = param.name as string;
    const value = exampleValue(param, resolver);
    const rowDescription =
      typeof param.description === 'string' && param.description !== '' ? param.description : undefined;
    const row = {
      uid: generateUid(),
      key: paramName,
      value,
      ...(rowDescription !== undefined ? { description: rowDescription } : {}),
      ...(param.required === true ? {} : { enabled: false }),
    };
    switch (param.in) {
      case 'path':
        // The row itself lives in the URL; a valued parameter seeds a
        // collection variable (first declaration wins) so the template
        // reference resolves out of the box.
        if (value !== '' && !assembly.variables.has(paramName)) {
          assembly.variables.set(paramName, {
            name: paramName,
            value,
            type: 'default',
            ...(rowDescription !== undefined ? { description: rowDescription } : {}),
          });
        }
        break;
      case 'query':
        params.push(row);
        break;
      case 'header':
        headers.push(row);
        break;
      case 'cookie':
        assembly.cookieParams++;
        break;
      default:
        recordDrop(report, {
          path: `${jsonPath}.parameters`,
          reason: `Parameter "${paramName}" has unknown location "${param.in}" — skipped.`,
        });
    }
  }

  const requestBody = resolver.resolve(op.requestBody);
  if (requestBody.ok && isRecord(requestBody.value)) {
    const mediaTypes = isRecord(requestBody.value.content) ? Object.keys(requestBody.value.content) : [];
    recordDrop(report, {
      path: `${jsonPath}.requestBody`,
      reason: `Request body (${mediaTypes.length > 0 ? mediaTypes.join(', ') : 'no media types'}) not imported yet — body import lands in the next slice.`,
      tracking: '#todo-openapi-bodies',
    });
  } else if (!requestBody.ok) {
    recordDrop(report, { path: `${jsonPath}.requestBody`, reason: refDropReason(requestBody.failure) });
  }

  if (Array.isArray(op.security) && op.security.length > 0) assembly.securedOperations++;
  if (isRecord(op.responses) && Object.keys(op.responses).length > 0) assembly.documentedResponses++;
  if (isRecord(op.callbacks)) assembly.callbacks += Object.keys(op.callbacks).length;

  // Folder: the first tag. Additional tags can't be represented — a
  // request lives in one folder — so they're named in a transform.
  const tags = Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === 'string' && t !== '') : [];
  const folderPath: string[] = tags.length > 0 ? [tags[0]] : [];
  if (tags.length > 0 && !assembly.folderTags.has(tags[0])) {
    assembly.folderTags.add(tags[0]);
    const tagDescription = assembly.tagDescriptions.get(tags[0]);
    assembly.folders.push({
      path: [tags[0]],
      ...(tagDescription !== undefined ? { description: tagDescription } : {}),
    });
  }
  if (tags.length > 1) {
    recordTransform(report, {
      path: `${jsonPath}.tags`,
      from: `tags ${tags.join(', ')}`,
      to: `folder "${tags[0]}"`,
      reason: 'A request lives in one folder — the first tag became the folder; the others are not represented.',
    });
  }

  const request: CurlRequest = {
    name,
    ...(description !== '' ? { description } : {}),
    method,
    url: `${base}${templated}`,
    headers,
    params,
    auth: { type: 'none' },
    body: { type: 'none' },
  };
  assembly.requests.push({ folderPath, request });
}

// ── Document-level aggregates ──────────────────────────────────────

function recordAggregates(doc: Record<string, unknown>, assembly: Assembly): void {
  const { report } = assembly;
  if (assembly.cookieParams > 0) {
    recordDrop(report, {
      path: 'paths[parameters in=cookie]',
      reason: `${assembly.cookieParams} cookie parameter${assembly.cookieParams === 1 ? '' : 's'} not imported — cookies are session state the browser manages, not request authoring data.`,
      tracking: 'PERMANENT: cookies out of scope',
    });
  }
  if (Array.isArray(doc.security) && doc.security.length > 0) {
    recordDrop(report, {
      path: 'security',
      reason:
        'The document-level security requirement (default auth for every operation) not imported yet — security-scheme import lands in a later slice.',
      tracking: '#todo-openapi-auth',
    });
  }
  if (assembly.securedOperations > 0) {
    recordDrop(report, {
      path: 'paths[operations with security]',
      reason: `${assembly.securedOperations} operation${assembly.securedOperations === 1 ? ' declares' : 's declare'} security requirements — security-scheme import lands in a later slice.`,
      tracking: '#todo-openapi-auth',
    });
  }
  if (assembly.documentedResponses > 0) {
    recordDrop(report, {
      path: 'paths[operations with responses]',
      reason: `Response documentation (schemas/examples) on ${assembly.documentedResponses} operation${assembly.documentedResponses === 1 ? '' : 's'} not imported yet — response-example import lands in a later slice.`,
      tracking: '#todo-openapi-response-examples',
    });
  }
  if (assembly.callbacks > 0) {
    recordDrop(report, {
      path: 'paths[operations with callbacks]',
      reason: `${assembly.callbacks} callback${assembly.callbacks === 1 ? '' : 's'} not imported — callbacks describe requests the SERVER sends, not client requests.`,
      tracking: 'PERMANENT: server-initiated callbacks',
    });
  }
  if (isRecord(doc.webhooks) && Object.keys(doc.webhooks).length > 0) {
    const count = Object.keys(doc.webhooks).length;
    recordDrop(report, {
      path: 'webhooks',
      reason: `${count} webhook${count === 1 ? '' : 's'} not imported — webhooks describe requests the SERVER sends, not client requests.`,
      tracking: 'PERMANENT: server-initiated webhooks',
    });
  }
}
