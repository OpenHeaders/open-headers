import type { HttpMethod } from '../../types/request';
import type { CurlRequest } from '../curl';
import { createReport, type ImportReport, recordDrop, recordTransform } from '../report';
import { buildHeaders, promoteAuthHeader, resolveAuth } from './auth';
import { buildBody } from './body';
import type {
  PostmanCollection,
  PostmanCollectionVariable,
  PostmanItem,
  PostmanParsedFolder,
  PostmanParsedRequest,
  PostmanParseResult,
} from './types';
import { PostmanParseError } from './types';
import { buildUrl, splitUrl } from './url';

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
    const itemDescription = textOf(item.description);
    return {
      name,
      ...(itemDescription !== undefined && itemDescription !== '' ? { description: itemDescription } : {}),
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

  // Request docs live on `request.description`; some exports carry
  // them on the item instead. First non-empty one wins.
  const description = textOf(req.description) ?? textOf(item.description);

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
    ...(description !== undefined && description !== '' ? { description } : {}),
    method,
    url: base,
    headers: headersWithoutAuth,
    params,
    auth: finalAuth,
    body,
  };
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

function textOf(raw: string | { content?: string } | undefined): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.content === 'string') return raw.content;
  return undefined;
}
