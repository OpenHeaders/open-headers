/**
 * Shared info-popover corpus — HTTP status codes. Prose for the
 * status-chip popover (workbench response meta strip; the corpus is
 * shared-plane so panel surfaces can key the same entries). Wire
 * vocabulary stays raw in the data registry: codes and canonical
 * reason phrases never localize — only summaries, guidance bodies,
 * range fallbacks, and the popover chrome live here.
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'HTTP status · {range}',
  'shared.info.status.undocumented':
    'This exact code is not documented in our registry — the range above is its standard meaning.',
  'shared.info.status.serverPhrase': 'The server sent the reason phrase "{statusText}".',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Informational',
  'shared.info.status.range1xx.fallback':
    'Interim response — the exchange is still in progress and a final status follows.',
  'shared.info.status.range2xx.kicker': '2xx Success',
  'shared.info.status.range2xx.fallback': 'The request was received, understood, and accepted.',
  'shared.info.status.range3xx.kicker': '3xx Redirection',
  'shared.info.status.range3xx.fallback':
    'Further action is needed to complete the request — look at the Location response header.',
  'shared.info.status.range4xx.kicker': '4xx Client error',
  'shared.info.status.range4xx.fallback':
    'The server rejected the request as sent — something in the request needs to change.',
  'shared.info.status.range5xx.kicker': '5xx Server error',
  'shared.info.status.range5xx.fallback':
    'The server failed to fulfill an apparently valid request — the fault is on the server side.',
  'shared.info.status.rangeOther.kicker': 'Non-standard',
  'shared.info.status.rangeOther.fallback': 'This code is outside the standard HTTP status ranges.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Interim response — the server got the request headers and the client should proceed to send the body.',
  'shared.info.status.s101.summary':
    'The server agreed to switch protocols as requested via the Upgrade header (e.g. to WebSocket).',
  'shared.info.status.s102.summary':
    'Interim WebDAV response — the server accepted the request but has not completed it yet.',
  'shared.info.status.s103.summary':
    'Interim response carrying headers (typically Link preloads) ahead of the final response.',
  'shared.info.status.s200.summary': 'The request succeeded and the response carries the result in its body.',
  'shared.info.status.s201.summary': 'The request succeeded and a new resource was created.',
  'shared.info.status.s201.body': 'The Location response header usually points at the new resource.',
  'shared.info.status.s202.summary': 'The request was accepted for processing, but processing has not completed.',
  'shared.info.status.s202.body':
    'Common for async jobs — the result must be fetched later, often via a status URL in the body.',
  'shared.info.status.s203.summary':
    'The response succeeded but was modified by a transforming proxy between server and client.',
  'shared.info.status.s204.summary': 'The request succeeded and there is deliberately no response body.',
  'shared.info.status.s204.body': 'An empty Body tab is expected here, not an error.',
  'shared.info.status.s205.summary':
    'The request succeeded and the client should reset the view that sent it (e.g. clear the form).',
  'shared.info.status.s206.summary': 'The server returned only the byte range asked for via the Range request header.',
  'shared.info.status.s206.body': 'Content-Range describes which slice of the full resource this body is.',
  'shared.info.status.s207.summary':
    'WebDAV batch response — the body carries a separate status for each sub-operation.',
  'shared.info.status.s208.summary':
    'WebDAV — this member was already listed earlier in the same multi-status response.',
  'shared.info.status.s226.summary':
    'The response is a diff (instance manipulation) against a prior version, not the full resource.',
  'shared.info.status.s300.summary': 'More than one representation is available and the server is not picking one.',
  'shared.info.status.s301.summary': 'The resource moved permanently to the URL in the Location header.',
  'shared.info.status.s301.body': 'Clients and caches remember this; update the request URL to the new address.',
  'shared.info.status.s302.summary': 'The resource is temporarily at the URL in the Location header.',
  'shared.info.status.s302.body':
    'Browsers commonly rewrite the method to GET when following it — use 307 to preserve the method.',
  'shared.info.status.s303.summary': 'The result lives at the Location URL and should be fetched with GET.',
  'shared.info.status.s303.body': 'Typical after a POST, redirecting to the created or resulting page.',
  'shared.info.status.s304.summary': 'The cached copy is still valid — the server sent no body on purpose.',
  'shared.info.status.s304.body': 'Sent in reply to conditional requests (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    'Deprecated — the resource must be accessed through the proxy in Location. Modern clients ignore it.',
  'shared.info.status.s307.summary':
    'Temporarily at the Location URL; the method and body must be preserved when following.',
  'shared.info.status.s308.summary':
    'Permanently at the Location URL; the method and body must be preserved when following.',
  'shared.info.status.s400.summary': 'The server could not parse or accept the request as sent.',
  'shared.info.status.s400.body':
    'Check the body syntax, query parameters, and required headers — the response body often names the offending field.',
  'shared.info.status.s401.summary': 'The request lacks valid authentication credentials.',
  'shared.info.status.s401.body':
    'The WWW-Authenticate response header names the expected scheme. Check the Authorization tab / token freshness.',
  'shared.info.status.s402.summary': 'Reserved code, used by some APIs for quota or billing limits.',
  'shared.info.status.s403.summary': 'The server understood the request and the credentials, but refuses to allow it.',
  'shared.info.status.s403.body':
    'Unlike 401, re-authenticating will not help — this identity lacks permission for this resource.',
  'shared.info.status.s404.summary': 'No resource exists at this URL (or the server hides whether it exists).',
  'shared.info.status.s404.body':
    'Check the path and any IDs in it; some APIs also return 404 instead of 403 to avoid leaking existence.',
  'shared.info.status.s405.summary': 'The resource exists but not for this HTTP method.',
  'shared.info.status.s405.body': 'The Allow response header lists the methods this URL accepts.',
  'shared.info.status.s406.summary': 'The server cannot produce a representation matching the request Accept headers.',
  'shared.info.status.s407.summary':
    'A proxy between you and the server requires credentials (Proxy-Authenticate names the scheme).',
  'shared.info.status.s408.summary': 'The server gave up waiting for the rest of the request and closed the exchange.',
  'shared.info.status.s409.summary': 'The request conflicts with the current state of the resource.',
  'shared.info.status.s409.body': 'Typical for concurrent edits or duplicate creates — re-read the resource and retry.',
  'shared.info.status.s410.summary': 'The resource existed but was intentionally and permanently removed.',
  'shared.info.status.s411.summary':
    'The server requires a Content-Length header and refuses chunked or unsized bodies.',
  'shared.info.status.s412.summary':
    'A conditional header (If-Match, If-Unmodified-Since, …) did not hold, so the server refused to act.',
  'shared.info.status.s413.summary': 'The request body exceeds what the server accepts.',
  'shared.info.status.s414.summary':
    "The request URL exceeds the server's limit — usually query-string data that belongs in a body.",
  'shared.info.status.s415.summary': 'The server rejects the body format.',
  'shared.info.status.s415.body': 'Check the Content-Type request header against what the API expects.',
  'shared.info.status.s416.summary': 'The Range request header asks for bytes outside the resource.',
  'shared.info.status.s417.summary':
    'The server cannot meet the Expect request header (typically Expect: 100-continue).',
  'shared.info.status.s418.summary': 'April-fools RFC code; some APIs use it as a playful refusal.',
  'shared.info.status.s421.summary':
    'The request reached a server that is not configured to answer for this authority (common with reused HTTP/2 connections).',
  'shared.info.status.s422.summary': 'The body is syntactically valid but semantically wrong — validation failed.',
  'shared.info.status.s422.body': 'The response body usually lists per-field validation errors.',
  'shared.info.status.s423.summary': 'WebDAV — the resource is locked by another operation.',
  'shared.info.status.s424.summary': 'WebDAV — this action failed because an earlier action it depended on failed.',
  'shared.info.status.s425.summary': 'The server refuses to process a request that might be replayed (early TLS data).',
  'shared.info.status.s426.summary':
    'The server insists on a different protocol — the Upgrade response header names it.',
  'shared.info.status.s428.summary':
    'The server requires a conditional header (usually If-Match) to prevent lost updates.',
  'shared.info.status.s429.summary': 'Rate limit hit — slow down.',
  'shared.info.status.s429.body':
    'The Retry-After response header (when present) says how long to wait; many APIs also send RateLimit-* headers.',
  'shared.info.status.s431.summary':
    "A request header (or all of them together) exceeds the server's size limit — often an oversized cookie.",
  'shared.info.status.s451.summary':
    'The server refuses access for legal reasons (censorship, court order, GDPR takedown).',
  'shared.info.status.s500.summary': 'The server hit an unexpected condition — the failure is on the server side.',
  'shared.info.status.s500.body':
    'Retrying may work if the fault is transient; otherwise the fix is in the server logs, not the request.',
  'shared.info.status.s501.summary':
    'The server does not support the functionality required — often an unrecognized method.',
  'shared.info.status.s502.summary': 'A gateway or proxy got an invalid response from the upstream server.',
  'shared.info.status.s502.body': 'The origin behind the proxy is failing or unreachable — usually transient.',
  'shared.info.status.s503.summary':
    'The server is temporarily unable to handle the request (overload or maintenance).',
  'shared.info.status.s503.body': 'Retry-After (when present) says when to try again.',
  'shared.info.status.s504.summary': 'A gateway or proxy timed out waiting for the upstream server.',
  'shared.info.status.s505.summary': 'The server refuses the HTTP protocol version used in the request.',
  'shared.info.status.s506.summary':
    'Server misconfiguration in content negotiation — the chosen variant negotiates itself.',
  'shared.info.status.s507.summary': 'WebDAV — the server cannot store what the request requires.',
  'shared.info.status.s508.summary': 'WebDAV — the server found an infinite loop while processing the request.',
  'shared.info.status.s510.summary': 'The request needs a further extension for the server to fulfill it.',
  'shared.info.status.s511.summary':
    'The network (typically a captive portal) requires authentication before granting access.',
} as const satisfies Catalog;
