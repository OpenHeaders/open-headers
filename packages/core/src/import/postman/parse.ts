import type { CapturedRequest } from '../../types/response-example';
import type { CurlRequest } from '../curl';
import { createReport, type ImportReport, recordDrop, recordTransform } from '../report';
import { buildHeaders, promoteAuthHeader, resolveAuth } from './auth';
import { buildBody } from './body';
import { coerceMethod } from './method';
import { buildExamples } from './responses';
import { buildScriptFields, eventSource } from './scripts';
import { mapProtocolProfileBehavior } from './settings';
import type {
  PostmanCollection,
  PostmanCollectionVariable,
  PostmanItem,
  PostmanParsedExample,
  PostmanParsedFolder,
  PostmanParsedRequest,
  PostmanParseOptions,
  PostmanParseResult,
} from './types';
import { PostmanParseError } from './types';
import { buildUrl, splitUrl } from './url';

// ── Entry point ────────────────────────────────────────────────────

export function parsePostman(input: string, options: PostmanParseOptions = {}): PostmanParseResult {
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

  // Collection-level scripts have no landing slot yet (the request
  // slots exist; collection/folder slots are model work). Non-empty
  // ones keep an honest drop; empty ones are vendor UI residue with
  // no logic to lose and vanish silently.
  recordAncestorScripts(collection.event, 'collection', 'collection', report);

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

  // Collection-level protocol settings would need inheritance to apply
  // to requests — note instead of silently ignoring.
  recordAncestorProtocolBehavior(collection.protocolProfileBehavior, 'collection', 'collection', report);

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
  walkItems(collection.item ?? [], [], 'collection.item', folders, requests, options, report);

  const exampleCount = requests.reduce((sum, entry) => sum + (entry.examples?.length ?? 0), 0);
  report.summary = { ...report.summary, imported: requests.length + exampleCount };

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
  options: PostmanParseOptions,
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

      // Folder-level scripts — same no-landing-slot posture as the
      // collection level.
      recordAncestorScripts(item.event, 'folder', jsonPath, report);

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

      recordAncestorProtocolBehavior(item.protocolProfileBehavior, 'folder', jsonPath, report);

      walkItems(item.item ?? [], path, `${jsonPath}.item`, folders, requests, options, report);
      continue;
    }

    // Request item.
    const converted = tryConvertRequest(item, jsonPath, options, report);
    if (converted) {
      requests.push({ folderPath: parentPath, ...converted });
    }
  }
}

/** A converted request item — the request plus any emitted examples. */
interface ConvertedItem {
  request: CurlRequest;
  examples?: PostmanParsedExample[];
}

function tryConvertRequest(
  item: PostmanItem,
  jsonPath: string,
  options: PostmanParseOptions,
  report: ImportReport,
): ConvertedItem | null {
  const name = (item.name ?? 'Untitled Request').trim() || 'Untitled Request';

  // Item-level event scripts land on the request's script slots —
  // translated to the oh.* API where possible, verbatim behind a
  // marker otherwise.
  const scripts = buildScriptFields(item.event, jsonPath, report);

  // `request` can be a string shorthand for GET <url>.
  if (typeof item.request === 'string') {
    const { base, params } = splitUrl(item.request);
    const itemDescription = textOf(item.description);
    return {
      request: {
        name,
        ...(itemDescription !== undefined && itemDescription !== '' ? { description: itemDescription } : {}),
        method: 'GET',
        url: base,
        headers: [],
        params,
        auth: { type: 'none' },
        body: { type: 'none' },
        ...scripts,
      },
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
  const settings = mapProtocolProfileBehavior(item.protocolProfileBehavior, jsonPath, report);

  const { base, params } = splitUrl(url);

  // Saved responses — Response Example payloads when the consumer can
  // mint them; an honest note otherwise (never a silent discard).
  let examples: PostmanParsedExample[] | undefined;
  if (Array.isArray(item.response) && item.response.length > 0) {
    if (options.responseExamples) {
      const parentShape: CapturedRequest = { method, url: base, headers: headersWithoutAuth, params, body };
      examples = buildExamples(item.response, parentShape, jsonPath, report);
    } else {
      recordDrop(report, {
        path: `${jsonPath}.response`,
        reason: `${item.response.length} saved response${item.response.length === 1 ? '' : 's'} not imported here — saved responses land as Response Examples on the migration pull path only for now.`,
        tracking: '#todo-file-import-examples',
      });
    }
  }

  return {
    request: {
      name,
      ...(description !== undefined && description !== '' ? { description } : {}),
      method,
      url: base,
      headers: headersWithoutAuth,
      params,
      auth: finalAuth,
      body,
      ...(settings !== undefined ? { settings } : {}),
      ...scripts,
    },
    ...(examples !== undefined && examples.length > 0 ? { examples } : {}),
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Collection/folder-level scripts have no landing slot until the
 * model grows script fields on those levels — non-empty ones keep an
 * honest drop per event; empty ones (vendor UI residue) are silently
 * lossless.
 */
function recordAncestorScripts(
  events: PostmanItem['event'],
  level: 'collection' | 'folder',
  jsonPath: string,
  report: ImportReport,
): void {
  if (!Array.isArray(events)) return;
  for (const ev of events) {
    if (!ev || ev.disabled) continue;
    if (eventSource(ev).trim().length === 0) continue;
    recordDrop(report, {
      path: `${jsonPath}.event[${ev.listen ?? 'unknown'}]`,
      reason: `${level === 'collection' ? 'Collection' : 'Folder'}-level ${ev.listen ?? 'unknown'} script not imported — ${level} scripts aren't supported yet; attach it to the requests that need it.`,
      tracking: '#todo-scripts',
    });
  }
}

/**
 * Collection/folder-level `protocolProfileBehavior` would need
 * settings inheritance to apply to descendant requests — until that
 * exists, one note per level keeps the loss visible.
 */
function recordAncestorProtocolBehavior(
  raw: unknown,
  level: 'collection' | 'folder',
  jsonPath: string,
  report: ImportReport,
): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length === 0) return;
  recordDrop(report, {
    path: `${jsonPath}.protocolProfileBehavior`,
    reason: `${level === 'collection' ? 'Collection' : 'Folder'}-level protocol settings (${keys.join(', ')}) aren't inherited by requests — set the request's own Settings tab instead.`,
    tracking: '#todo-settings-inheritance',
  });
}

function textOf(raw: string | { content?: string } | undefined): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.content === 'string') return raw.content;
  return undefined;
}
