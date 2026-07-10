/**
 * API-request handoff — builds a `RequestSeed` from a captured
 * lifecycle, stashes it in the background via `createRequestDraft`,
 * and opens the workbench at `#/create-api-request/draft-<nonce>`.
 * The workbench lands on a scratch request-create tab pre-filled with
 * the captured request; nothing persists until the user saves it.
 *
 * The structural conversion is core's HAR importer (`convertHarRequest`)
 * — the same auth promotion, query-param split, and body typing the
 * file-import path uses — fed the row's current HAR entry directly, so
 * the handoff never round-trips through a lossy text form (curl).
 * Panel-side policy on top of it:
 *
 *   • Replay-hostile headers are filtered BEFORE conversion: transport
 *     headers the executor regenerates (`host`, `connection`,
 *     `content-length`), browser-managed client hints and fetch
 *     metadata (`sec-ch-*`, `sec-fetch-*`), and `cookie` — cookie
 *     handling is per-workspace (§14), and fetch forbids the header
 *     anyway, so a seeded row would silently not be sent.
 *   • GraphQL upgrade: when the captured request classifies as GraphQL
 *     (endpoint path or body shape) and carries a single-operation JSON
 *     body, the seed opens in the editor's GraphQL body mode with query
 *     and variables split out. Batched operations stay raw JSON.
 *   • JSON bodies are pretty-printed so the editor opens formatted
 *     (same courtesy as the rule-draft bridge).
 *
 * The converter's ImportReport is a required sink but there is no
 * import-preview modal on this one-click path, so it's discarded — the
 * user audits the result in the opened editor itself.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { convertHarRequest, createReport, type HarRequest } from '@openheaders/core/import';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { RequestSeed } from '@openheaders/core/types';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { detectApiResourceType } from './api-resource-type';
import { currentHarEntry } from './inspector-row-projection';

/** Headers the executor regenerates or the browser refuses to resend. */
const REPLAY_EXCLUDED_HEADERS = new Set(['host', 'connection', 'content-length', 'cookie']);
const REPLAY_EXCLUDED_PREFIXES = ['sec-ch-', 'sec-fetch-'];

function replayableHeaders(
  headers: readonly { name: string; value: string }[] | undefined,
): Array<{ name: string; value: string }> {
  return (headers ?? [])
    .filter((h) => {
      const name = h.name.toLowerCase();
      if (REPLAY_EXCLUDED_HEADERS.has(name)) return false;
      return !REPLAY_EXCLUDED_PREFIXES.some((p) => name.startsWith(p));
    })
    .map((h) => ({ name: h.name, value: h.value }));
}

/** Pretty-print a JSON body so the editor opens already formatted —
 *  unparseable content passes through untouched. */
function formatJsonContent(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

/**
 * Upgrade a single-operation GraphQL JSON body to the editor's native
 * graphql body mode (query + variables split). Batched arrays and
 * non-GraphQL bodies pass through unchanged.
 */
function upgradeGraphqlBody(seed: RequestSeed, lc: RequestLifecycle): RequestSeed {
  if (seed.body.type !== 'json') return seed;
  if (detectApiResourceType(lc, currentHarEntry(lc)) !== 'graphql') return seed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(seed.body.content);
  } catch {
    return seed;
  }
  if (Array.isArray(parsed)) return seed;
  const op = parsed as { query?: unknown; variables?: unknown };
  if (typeof op.query !== 'string') return seed;
  return {
    ...seed,
    body: {
      type: 'graphql',
      content: op.query,
      ...(op.variables !== undefined ? { graphqlVariables: JSON.stringify(op.variables, null, 2) } : {}),
    },
  };
}

/**
 * Build a `RequestSeed` from the lifecycle's current hop. Until a HAR
 * lands for the hop, falls back to the lifecycle's url + method + the
 * cooked request headers — same degradation as the copy formatters.
 */
export function buildRequestSeedFromLifecycle(lc: RequestLifecycle): RequestSeed {
  const har = currentHarEntry(lc);
  const source: HarRequest = har?.request
    ? { ...har.request, headers: replayableHeaders(har.request.headers) }
    : { method: lc.method, url: lc.url, headers: replayableHeaders(lc.requestHeaders) };

  // Report is a required sink for the converter; discarded here (see
  // file-level docs). One entry, index 0.
  const converted = convertHarRequest(source, 0, createReport('har', 1));
  if (!converted) {
    // Only reachable for a URL-less entry, which a rendered row never
    // is — but degrade to an empty seed rather than throw.
    return {
      name: lc.url,
      method: 'GET',
      url: lc.url,
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
  }

  const body =
    converted.body.type === 'json'
      ? { type: 'json' as const, content: formatJsonContent(converted.body.content) }
      : converted.body;
  const seed: RequestSeed = {
    name: converted.name,
    method: converted.method,
    url: converted.url,
    headers: converted.headers,
    params: converted.params,
    auth: converted.auth,
    body,
  };
  return upgradeGraphqlBody(seed, lc);
}

/**
 * Stash the seed in the background and dispatch a `create-api-request`
 * intent to the workbench via the SW navigator — same nonce handoff as
 * `handOffRuleDraft`. The workbench's intent router fetches the seed
 * via `takeRequestDraft` and opens a pre-filled scratch tab.
 */
export async function handOffApiRequestSeed(lc: RequestLifecycle): Promise<void> {
  const seed = buildRequestSeedFromLifecycle(lc);
  const res = await hostBridge.call('createRequestDraft', { seed });
  if (!res.success || !res.nonce) {
    throw new Error(res.error ?? 'Failed to create request draft');
  }
  await openWorkspace({ kind: 'create-api-request', draftNonce: res.nonce }, 'devpanel');
}
