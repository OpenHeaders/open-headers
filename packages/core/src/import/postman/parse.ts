import type { AuthConfig } from '../../types/request';
import type { CapturedRequest } from '../../types/response-example';
import type { CurlRequest } from '../curl';
import { createReport, type ImportReport, recordDrop } from '../report';
import { buildHeaders, promoteAuthHeader, resolveAuth } from './auth';
import { buildBody } from './body';
import { coerceMethod } from './method';
import { buildExamples } from './responses';
import { buildScriptFields } from './scripts';
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

  // Collection-level scripts land on the collection's ancestor script
  // slots — translated to the oh.* API where possible, verbatim behind
  // a marker otherwise, exactly like request-level events. At send
  // time they compose ancestor-first: collection pre → folder pre →
  // request pre. Empty scripts are vendor UI residue and vanish
  // silently.
  const collectionScripts = buildScriptFields(collection.event, 'collection', report);

  // Collection-level default auth lands on the collection's own auth
  // slot — requests importing as `inherit` resolve it up the ancestor
  // chain at send time, matching the vendor's inheritance natively.
  // An `inherit` result means nothing was configured at this level
  // (absent block, or an unmappable one that dropped with its note).
  const { auth: collectionAuth } = resolveAuth(collection.auth, { type: 'inherit' }, 'collection.auth', report);

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
    ...(collectionScripts.preRequestScript !== undefined
      ? { collectionPreRequestScript: collectionScripts.preRequestScript }
      : {}),
    ...(collectionScripts.postResponseScript !== undefined
      ? { collectionPostResponseScript: collectionScripts.postResponseScript }
      : {}),
    ...(collectionAuth.type !== 'inherit' ? { collectionAuth } : {}),
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
      // Folder-level scripts land on the folder's ancestor script
      // slots — same translation + landing as the collection level.
      const folderScripts = buildScriptFields(item.event, jsonPath, report);
      // Folder-level default auth lands on the folder's own auth slot —
      // same native inheritance landing as the collection level. An
      // `inherit` result means nothing was configured here.
      const { auth: folderAuth } = resolveAuth(item.auth, { type: 'inherit' }, `${jsonPath}.auth`, report);
      folders.push({
        path,
        description: textOf(item.description),
        ...folderScripts,
        ...(folderAuth.type !== 'inherit' ? { auth: folderAuth } : {}),
      });

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

  // `request` can be a string shorthand for GET <url>. It carries no
  // auth block, so it inherits from its ancestors like any other
  // request without one.
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
        auth: { type: 'inherit' },
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
  // A request with no auth block (and no promoted header) inherits
  // from its ancestors in the vendor model — it imports as `inherit`
  // so the collection/folder default auth applies at send time.
  const requestFallback: AuthConfig = authFromHeader.type === 'none' ? { type: 'inherit' } : authFromHeader;
  const { auth: finalAuth } = resolveAuth(req.auth, requestFallback, `${jsonPath}.request.auth`, report);
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
