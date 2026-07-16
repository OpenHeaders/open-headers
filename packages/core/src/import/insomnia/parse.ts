import { parse as parseYaml } from 'yaml';
import { parseOpenApi } from '../openapi/parse';
import { createReport, type ImportReport, recordDrop, recordTransform } from '../report';
import { collectEnvironments } from './environment';
import { isRecord, normalizeDoc } from './normalize';
import { convertRequest } from './request';
import type { InsomniaDoc, InsomniaParsedCollection, InsomniaParsedSpec, InsomniaParseResult } from './types';
import { InsomniaParseError } from './types';

// ── Entry points ───────────────────────────────────────────────────

/**
 * Parse an Insomnia export: the v4 JSON envelope
 * (`{_type: 'export', __export_format: 4, resources: []}`) or a v5
 * document (`type: <kind>.insomnia.rest/5.x`, YAML or JSON).
 */
export function parseInsomnia(input: string): InsomniaParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    try {
      parsed = parseYaml(input);
    } catch (err) {
      throw new InsomniaParseError(
        `Insomnia export is not valid JSON or YAML: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!isRecord(parsed)) {
    throw new InsomniaParseError('Expected an export object (v4 envelope or v5 document).');
  }

  if (parsed._type === 'export' || typeof parsed.__export_format === 'number') {
    const resources = Array.isArray(parsed.resources) ? parsed.resources : [];
    const report = createReport('insomnia', 0);
    return assemble(resources, report);
  }
  if (typeof parsed.type === 'string' && parsed.type.includes('.insomnia.rest/')) {
    return parseV5Document(parsed);
  }
  throw new InsomniaParseError('Not a recognized Insomnia export — expected a v4 export envelope or a v5 document.');
}

/**
 * Alternate entry point for already-parsed NeDB doc lines (`type:
 * 'Request' | 'RequestGroup' | …`) — the Phase 4 scanner reads the
 * `insomnia.*.db` files and hands the parsed lines over, so this
 * parser stays filesystem-free.
 */
export function parseInsomniaDocs(docs: unknown[]): InsomniaParseResult {
  const report = createReport('insomnia', 0);
  return assemble(docs, report);
}

// ── Assembly (shared by all entry shapes) ──────────────────────────

function assemble(rawDocs: unknown[], report: ImportReport): InsomniaParseResult {
  const docs: InsomniaDoc[] = [];
  const unsupported = new Map<string, number>();
  rawDocs.forEach((raw, i) => {
    const doc = normalizeDoc(raw, i);
    if (!doc) {
      recordDrop(report, {
        path: `resources[${i}]`,
        reason: 'Not an object — skipped.',
        tracking: 'PERMANENT: resource shape validation',
      });
      return;
    }
    if (doc.kind === 'unsupported') {
      const key = doc.rawType || 'unknown';
      unsupported.set(key, (unsupported.get(key) ?? 0) + 1);
      return;
    }
    docs.push(doc);
  });
  for (const [rawType, count] of unsupported) {
    const { reason, tracking } = unsupportedDrop(rawType, count);
    recordDrop(report, { path: `resources[type=${rawType}]`, reason, tracking });
  }

  const knownIds = new Set(docs.map((d) => d.id));
  const visited = new Set<string>();

  const childrenOf = (parentId: string | null): InsomniaDoc[] =>
    docs
      .filter((d) => (d.kind === 'request' || d.kind === 'request-group') && d.parentId === parentId)
      .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0));

  const walkList = (list: InsomniaDoc[], path: string[], collection: InsomniaParsedCollection): void => {
    for (const child of list) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      if (child.kind === 'request-group') {
        const folderPath = [...path, child.name];
        collection.folders.push({ path: folderPath, description: child.description });
        walkList(childrenOf(child.id), folderPath, collection);
      } else {
        collection.requests.push({
          folderPath: path,
          request: convertRequest(child, `resources[${child.id}]`, report),
        });
      }
    }
  };

  const collections: InsomniaParsedCollection[] = [];
  for (const ws of docs.filter((d) => d.kind === 'workspace')) {
    const collection: InsomniaParsedCollection = {
      name: ws.name,
      description: ws.description ?? '',
      folders: [],
      requests: [],
    };
    walkList(childrenOf(ws.id), [], collection);
    collections.push(collection);
  }

  // Strays — request/group docs whose parent chain never reaches a
  // workspace. With no workspace doc at all (filtered NeDB lines),
  // parentless chains root an implicit collection; anything still
  // unreachable (dangling parentId, cycles) drops with a reason.
  const strayRoots = docs
    .filter(
      (d) =>
        (d.kind === 'request' || d.kind === 'request-group') &&
        !visited.has(d.id) &&
        (d.parentId === null || !knownIds.has(d.parentId)),
    )
    .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0));
  if (strayRoots.length > 0) {
    const implicit: InsomniaParsedCollection = {
      name: 'Imported Collection',
      description: '',
      folders: [],
      requests: [],
    };
    walkList(strayRoots, [], implicit);
    collections.push(implicit);
  }
  for (const doc of docs) {
    if ((doc.kind === 'request' || doc.kind === 'request-group') && !visited.has(doc.id)) {
      recordDrop(report, {
        path: `resources[${doc.id}]`,
        reason: `"${doc.name}" is orphaned — its parent chain never reaches a workspace.`,
        tracking: 'PERMANENT: resource shape validation',
      });
    }
  }

  // Embedded API specs — design documents carry their OpenAPI source
  // verbatim in `contents`; each importable spec becomes its own
  // collection through the OpenAPI importer, with that parser's notes
  // folded in under the resource path, AND is retained verbatim in
  // `specs[]` so the landing surface can mint the spec entity beside
  // the collection. Unparseable specs drop with the parser's own
  // honest error (Swagger 2.0 names the conversion) — only parseable
  // documents retain (the format vocabulary has no value for them).
  const specs: InsomniaParsedSpec[] = [];
  for (const spec of docs.filter((d) => d.kind === 'apispec')) {
    const raw = typeof spec.contents === 'string' ? spec.contents : '';
    const contents = raw.trim();
    if (contents === '') {
      recordDrop(report, {
        path: `resources[${spec.id}]`,
        reason: `API spec "${spec.name}" carries no contents — nothing to import.`,
      });
      continue;
    }
    try {
      const parsed = parseOpenApi(contents);
      specs.push({ name: spec.name, contents: raw, format: parsed.specFormat, collectionIndex: collections.length });
      collections.push({
        name: parsed.collectionName,
        description: parsed.collectionDescription,
        folders: parsed.folders.map((f) => ({
          path: f.path,
          ...(f.description !== undefined ? { description: f.description } : {}),
        })),
        requests: parsed.requests.map((r) => ({ folderPath: r.folderPath, request: r.request })),
        ...(parsed.collectionVariables.length > 0 ? { variables: parsed.collectionVariables } : {}),
        ...(parsed.collectionAuth !== undefined ? { auth: parsed.collectionAuth } : {}),
      });
      recordTransform(report, {
        path: `resources[${spec.id}]`,
        from: 'API spec resource',
        to: `collection "${parsed.collectionName}"`,
        reason:
          'The embedded OpenAPI document imported through the OpenAPI importer — its notes follow under this resource path.',
      });
      for (const drop of parsed.report.drops) {
        recordDrop(report, { ...drop, path: `resources[${spec.id}].${drop.path}` });
      }
      for (const transform of parsed.report.transforms) {
        recordTransform(report, { ...transform, path: `resources[${spec.id}].${transform.path}` });
      }
    } catch (err) {
      recordDrop(report, {
        path: `resources[${spec.id}]`,
        reason: `API spec "${spec.name}" not imported — ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const environments = collectEnvironments(docs, report);
  const requestCount = collections.reduce((n, c) => n + c.requests.length, 0);
  report.summary = { ...report.summary, imported: requestCount + environments.length };

  return { collections, environments, specs, report };
}

function unsupportedDrop(rawType: string, count: number): { reason: string; tracking: string } {
  const label = count === 1 ? '1 resource' : `${count} resources`;
  const kind = rawType.toLowerCase().replace(/_/g, '');
  if (kind === 'cookiejar') {
    return {
      reason: `${label} of type "${rawType}" not imported — cookie jars are session state, not authoring data.`,
      tracking: 'PERMANENT: cookies out of scope',
    };
  }
  if (kind === 'websocketrequest' || kind === 'grpcrequest') {
    return {
      reason: `${label} of type "${rawType}" not imported — no matching request type yet.`,
      tracking: '#todo-request-kinds',
    };
  }
  return {
    reason: `${label} of type "${rawType || 'unknown'}" not supported — skipped.`,
    tracking: 'PERMANENT: resource-type support',
  };
}

// ── v5 documents ───────────────────────────────────────────────────

/**
 * A v5 document is converted to the v4 resource vocabulary and fed
 * through the same assembly: the document itself becomes a workspace,
 * `collection[]` items become requests (have `url`/`method`) or
 * request groups (have `children`), `environments` becomes the base
 * environment (+ `subEnvironments`).
 */
function parseV5Document(doc: Record<string, unknown>): InsomniaParseResult {
  const report = createReport('insomnia', 0);
  const type = typeof doc.type === 'string' ? doc.type : '';
  const rawDocs: Record<string, unknown>[] = [];
  let seq = 0;
  const nextId = (prefix: string): string => `${prefix}-v5-${seq++}`;

  if (type.startsWith('collection.')) {
    const wsId = nextId('wrk');
    rawDocs.push({
      _id: wsId,
      _type: 'workspace',
      name: typeof doc.name === 'string' ? doc.name : undefined,
      description: typeof doc.description === 'string' ? doc.description : undefined,
    });
    walkV5Items(Array.isArray(doc.collection) ? doc.collection : [], wsId, rawDocs, nextId, report);
    pushV5Environments(doc.environments, wsId, rawDocs, nextId);
    if (isRecord(doc.cookieJar)) {
      recordDrop(report, {
        path: 'cookieJar',
        reason: 'Cookie jars are session state, not authoring data — not imported.',
        tracking: 'PERMANENT: cookies out of scope',
      });
    }
  } else if (type.startsWith('environment.') || type.startsWith('globals.')) {
    pushV5Environments({ name: doc.name, data: doc.data, subEnvironments: doc.subEnvironments }, null, rawDocs, nextId);
  } else {
    throw new InsomniaParseError(
      `Unsupported document type "${type}" — only collection and environment documents are supported.`,
    );
  }
  return assemble(rawDocs, report);
}

function walkV5Items(
  items: unknown[],
  parentId: string,
  rawDocs: Record<string, unknown>[],
  nextId: (prefix: string) => string,
  report: ImportReport,
): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isRecord(item)) {
      recordDrop(report, {
        path: `collection[${i}]`,
        reason: 'Not an object — skipped.',
        tracking: 'PERMANENT: resource shape validation',
      });
      continue;
    }
    const meta = isRecord(item.meta) ? item.meta : {};
    const id = typeof meta.id === 'string' && meta.id.length > 0 ? meta.id : null;
    const sortKey = typeof meta.sortKey === 'number' ? meta.sortKey : undefined;
    if (Array.isArray(item.children)) {
      const folderId = id ?? nextId('fld');
      rawDocs.push({
        _id: folderId,
        _type: 'request_group',
        parentId,
        name: item.name,
        description: item.description,
        metaSortKey: sortKey,
      });
      walkV5Items(item.children, folderId, rawDocs, nextId, report);
      continue;
    }
    if (typeof item.url === 'string' || typeof item.method === 'string') {
      const requestId = id ?? nextId('req');
      rawDocs.push({
        _id: requestId,
        _type: 'request',
        parentId,
        name: item.name,
        description: item.description,
        url: item.url,
        method: item.method,
        headers: item.headers,
        parameters: item.parameters,
        body: item.body,
        authentication: item.authentication,
        metaSortKey: sortKey,
      });
      if (isRecord(item.scripts)) {
        for (const [hook, script] of Object.entries(item.scripts)) {
          if (typeof script !== 'string' || script.trim().length === 0) continue;
          recordDrop(report, {
            path: `resources[${requestId}].scripts.${hook}`,
            reason: `${hook} script not imported — pre-request/test scripts need the offscreen-document sandbox (§19).`,
            tracking: '#todo-scripts',
          });
        }
      }
      continue;
    }
    recordDrop(report, {
      path: `collection[${i}]`,
      reason: 'Unrecognized collection item (neither a request nor a folder) — skipped.',
      tracking: 'PERMANENT: resource shape validation',
    });
  }
}

function pushV5Environments(
  envs: unknown,
  parentId: string | null,
  rawDocs: Record<string, unknown>[],
  nextId: (prefix: string) => string,
): void {
  const scopes = Array.isArray(envs) ? envs : envs !== undefined && envs !== null ? [envs] : [];
  for (const scope of scopes) {
    if (!isRecord(scope) || !isRecord(scope.data)) continue;
    const baseId = nextId('env');
    rawDocs.push({
      _id: baseId,
      _type: 'environment',
      parentId,
      name: typeof scope.name === 'string' ? scope.name : 'Base Environment',
      data: scope.data,
    });
    if (Array.isArray(scope.subEnvironments)) {
      for (const sub of scope.subEnvironments) {
        if (!isRecord(sub) || !isRecord(sub.data)) continue;
        rawDocs.push({
          _id: nextId('env'),
          _type: 'environment',
          parentId: baseId,
          name: typeof sub.name === 'string' ? sub.name : undefined,
          data: sub.data,
        });
      }
    }
  }
}
