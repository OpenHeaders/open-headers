/**
 * Request Executor — runs a Request through `fetch()` from the
 * service worker and returns a response snapshot the UI can render.
 *
 * Design:
 *   - Variables resolve against the same 4-scope chain the DNR pipeline
 *     uses (vault > environment > collection > workspace) so requests
 *     see the same values the rules would. Collection scope is derived
 *     from the request's path.
 *   - Fetch runs inside the SW, which holds `<all_urls>` host
 *     permission — no CORS gating. User-defined DNR rules DO apply to
 *     SW fetches (they hit webRequest like any other request), which
 *     is intentional: users can test their own rules end-to-end.
 *   - Body types: `none`, `json`, `xml`, `text`, `form` (urlencoded).
 *     `graphql` and `multipart` land in a later phase — the shape
 *     variant is declared in `BodyType` but the executor falls back
 *     to `none` if asked to send one.
 *   - Auth: `none` | `inherit` are no-ops (nothing to inject). `basic`
 *     and `bearer` add Authorization; `api-key` adds either a header or
 *     a query param depending on its `in` field. `inherit` at the
 *     request level defaults to `none` — inheritance from containing
 *     collections is scheduled for v2 alongside request scripts.
 *
 * Response size cap: 2 MiB for the body preview. Larger responses are
 * truncated with a flag so the UI can render a message instead of
 * trying to display megabytes in a <pre>.
 */

export type { ExecutedRequestSnapshot } from '@openheaders/core/types';
// `ensureScheme` lives in the shared fetch module so the renderer
// (RequestEditor URL bar) and the executor apply the exact same
// normalization. Re-exported here so the request-executor unit
// test keeps importing from one place.
export { ensureScheme } from '@openheaders/ui/shared/fetch';
export { type ExecuteRequestOptions, executeRequest, executeRequestDraft } from './api';
export {
  executeForLiveChain,
  LIVE_BYPASS_HEADER,
  type LiveChainExecuteOptions,
  liveBypassHeaderValue,
} from './live-chain';
export { UnresolvedRequestError } from './resolve';
