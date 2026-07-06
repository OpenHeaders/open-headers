/**
 * HTTP status-code docs registry — powers the response meta strip's
 * status-chip popover. Same in-app-docs discipline as the http-headers
 * corpus: `getStatusCodeInfoContent` always returns content — curated
 * codes get specific copy, everything else gets an honest range-level
 * fallback.
 */

import type { InfoPopoverContent } from '../../types';

interface StatusInfoEntry {
  /** Canonical reason phrase, shown even when the server sent none. */
  display: string;
  /** One-sentence meaning. */
  summary: string;
  /** Optional extra guidance — what to look at next. */
  body?: string;
}

const STATUS_INFO: ReadonlyMap<number, StatusInfoEntry> = new Map<number, StatusInfoEntry>([
  [
    100,
    {
      display: 'Continue',
      summary: 'Interim response — the server got the request headers and the client should proceed to send the body.',
    },
  ],
  [
    101,
    {
      display: 'Switching Protocols',
      summary: 'The server agreed to switch protocols as requested via the Upgrade header (e.g. to WebSocket).',
    },
  ],
  [
    102,
    {
      display: 'Processing',
      summary: 'Interim WebDAV response — the server accepted the request but has not completed it yet.',
    },
  ],
  [
    103,
    {
      display: 'Early Hints',
      summary: 'Interim response carrying headers (typically Link preloads) ahead of the final response.',
    },
  ],
  [200, { display: 'OK', summary: 'The request succeeded and the response carries the result in its body.' }],
  [
    201,
    {
      display: 'Created',
      summary: 'The request succeeded and a new resource was created.',
      body: 'The Location response header usually points at the new resource.',
    },
  ],
  [
    202,
    {
      display: 'Accepted',
      summary: 'The request was accepted for processing, but processing has not completed.',
      body: 'Common for async jobs — the result must be fetched later, often via a status URL in the body.',
    },
  ],
  [
    203,
    {
      display: 'Non-Authoritative Information',
      summary: 'The response succeeded but was modified by a transforming proxy between server and client.',
    },
  ],
  [
    204,
    {
      display: 'No Content',
      summary: 'The request succeeded and there is deliberately no response body.',
      body: 'An empty Body tab is expected here, not an error.',
    },
  ],
  [
    205,
    {
      display: 'Reset Content',
      summary: 'The request succeeded and the client should reset the view that sent it (e.g. clear the form).',
    },
  ],
  [
    206,
    {
      display: 'Partial Content',
      summary: 'The server returned only the byte range asked for via the Range request header.',
      body: 'Content-Range describes which slice of the full resource this body is.',
    },
  ],
  [
    207,
    {
      display: 'Multi-Status',
      summary: 'WebDAV batch response — the body carries a separate status for each sub-operation.',
    },
  ],
  [
    208,
    {
      display: 'Already Reported',
      summary: 'WebDAV — this member was already listed earlier in the same multi-status response.',
    },
  ],
  [
    226,
    {
      display: 'IM Used',
      summary: 'The response is a diff (instance manipulation) against a prior version, not the full resource.',
    },
  ],
  [
    300,
    {
      display: 'Multiple Choices',
      summary: 'More than one representation is available and the server is not picking one.',
    },
  ],
  [
    301,
    {
      display: 'Moved Permanently',
      summary: 'The resource moved permanently to the URL in the Location header.',
      body: 'Clients and caches remember this; update the request URL to the new address.',
    },
  ],
  [
    302,
    {
      display: 'Found',
      summary: 'The resource is temporarily at the URL in the Location header.',
      body: 'Browsers commonly rewrite the method to GET when following it — use 307 to preserve the method.',
    },
  ],
  [
    303,
    {
      display: 'See Other',
      summary: 'The result lives at the Location URL and should be fetched with GET.',
      body: 'Typical after a POST, redirecting to the created or resulting page.',
    },
  ],
  [
    304,
    {
      display: 'Not Modified',
      summary: 'The cached copy is still valid — the server sent no body on purpose.',
      body: 'Sent in reply to conditional requests (If-None-Match / If-Modified-Since).',
    },
  ],
  [
    305,
    {
      display: 'Use Proxy',
      summary: 'Deprecated — the resource must be accessed through the proxy in Location. Modern clients ignore it.',
    },
  ],
  [
    307,
    {
      display: 'Temporary Redirect',
      summary: 'Temporarily at the Location URL; the method and body must be preserved when following.',
    },
  ],
  [
    308,
    {
      display: 'Permanent Redirect',
      summary: 'Permanently at the Location URL; the method and body must be preserved when following.',
    },
  ],
  [
    400,
    {
      display: 'Bad Request',
      summary: 'The server could not parse or accept the request as sent.',
      body: 'Check the body syntax, query parameters, and required headers — the response body often names the offending field.',
    },
  ],
  [
    401,
    {
      display: 'Unauthorized',
      summary: 'The request lacks valid authentication credentials.',
      body: 'The WWW-Authenticate response header names the expected scheme. Check the Authorization tab / token freshness.',
    },
  ],
  [402, { display: 'Payment Required', summary: 'Reserved code, used by some APIs for quota or billing limits.' }],
  [
    403,
    {
      display: 'Forbidden',
      summary: 'The server understood the request and the credentials, but refuses to allow it.',
      body: 'Unlike 401, re-authenticating will not help — this identity lacks permission for this resource.',
    },
  ],
  [
    404,
    {
      display: 'Not Found',
      summary: 'No resource exists at this URL (or the server hides whether it exists).',
      body: 'Check the path and any IDs in it; some APIs also return 404 instead of 403 to avoid leaking existence.',
    },
  ],
  [
    405,
    {
      display: 'Method Not Allowed',
      summary: 'The resource exists but not for this HTTP method.',
      body: 'The Allow response header lists the methods this URL accepts.',
    },
  ],
  [
    406,
    {
      display: 'Not Acceptable',
      summary: 'The server cannot produce a representation matching the request Accept headers.',
    },
  ],
  [
    407,
    {
      display: 'Proxy Authentication Required',
      summary: 'A proxy between you and the server requires credentials (Proxy-Authenticate names the scheme).',
    },
  ],
  [
    408,
    {
      display: 'Request Timeout',
      summary: 'The server gave up waiting for the rest of the request and closed the exchange.',
    },
  ],
  [
    409,
    {
      display: 'Conflict',
      summary: 'The request conflicts with the current state of the resource.',
      body: 'Typical for concurrent edits or duplicate creates — re-read the resource and retry.',
    },
  ],
  [410, { display: 'Gone', summary: 'The resource existed but was intentionally and permanently removed.' }],
  [
    411,
    {
      display: 'Length Required',
      summary: 'The server requires a Content-Length header and refuses chunked or unsized bodies.',
    },
  ],
  [
    412,
    {
      display: 'Precondition Failed',
      summary: 'A conditional header (If-Match, If-Unmodified-Since, …) did not hold, so the server refused to act.',
    },
  ],
  [413, { display: 'Payload Too Large', summary: 'The request body exceeds what the server accepts.' }],
  [
    414,
    {
      display: 'URI Too Long',
      summary: "The request URL exceeds the server's limit — usually query-string data that belongs in a body.",
    },
  ],
  [
    415,
    {
      display: 'Unsupported Media Type',
      summary: 'The server rejects the body format.',
      body: 'Check the Content-Type request header against what the API expects.',
    },
  ],
  [416, { display: 'Range Not Satisfiable', summary: 'The Range request header asks for bytes outside the resource.' }],
  [
    417,
    {
      display: 'Expectation Failed',
      summary: 'The server cannot meet the Expect request header (typically Expect: 100-continue).',
    },
  ],
  [418, { display: "I'm a Teapot", summary: 'April-fools RFC code; some APIs use it as a playful refusal.' }],
  [
    421,
    {
      display: 'Misdirected Request',
      summary:
        'The request reached a server that is not configured to answer for this authority (common with reused HTTP/2 connections).',
    },
  ],
  [
    422,
    {
      display: 'Unprocessable Entity',
      summary: 'The body is syntactically valid but semantically wrong — validation failed.',
      body: 'The response body usually lists per-field validation errors.',
    },
  ],
  [423, { display: 'Locked', summary: 'WebDAV — the resource is locked by another operation.' }],
  [
    424,
    {
      display: 'Failed Dependency',
      summary: 'WebDAV — this action failed because an earlier action it depended on failed.',
    },
  ],
  [
    425,
    {
      display: 'Too Early',
      summary: 'The server refuses to process a request that might be replayed (early TLS data).',
    },
  ],
  [
    426,
    {
      display: 'Upgrade Required',
      summary: 'The server insists on a different protocol — the Upgrade response header names it.',
    },
  ],
  [
    428,
    {
      display: 'Precondition Required',
      summary: 'The server requires a conditional header (usually If-Match) to prevent lost updates.',
    },
  ],
  [
    429,
    {
      display: 'Too Many Requests',
      summary: 'Rate limit hit — slow down.',
      body: 'The Retry-After response header (when present) says how long to wait; many APIs also send RateLimit-* headers.',
    },
  ],
  [
    431,
    {
      display: 'Request Header Fields Too Large',
      summary:
        "A request header (or all of them together) exceeds the server's size limit — often an oversized cookie.",
    },
  ],
  [
    451,
    {
      display: 'Unavailable For Legal Reasons',
      summary: 'The server refuses access for legal reasons (censorship, court order, GDPR takedown).',
    },
  ],
  [
    500,
    {
      display: 'Internal Server Error',
      summary: 'The server hit an unexpected condition — the failure is on the server side.',
      body: 'Retrying may work if the fault is transient; otherwise the fix is in the server logs, not the request.',
    },
  ],
  [
    501,
    {
      display: 'Not Implemented',
      summary: 'The server does not support the functionality required — often an unrecognized method.',
    },
  ],
  [
    502,
    {
      display: 'Bad Gateway',
      summary: 'A gateway or proxy got an invalid response from the upstream server.',
      body: 'The origin behind the proxy is failing or unreachable — usually transient.',
    },
  ],
  [
    503,
    {
      display: 'Service Unavailable',
      summary: 'The server is temporarily unable to handle the request (overload or maintenance).',
      body: 'Retry-After (when present) says when to try again.',
    },
  ],
  [504, { display: 'Gateway Timeout', summary: 'A gateway or proxy timed out waiting for the upstream server.' }],
  [
    505,
    {
      display: 'HTTP Version Not Supported',
      summary: 'The server refuses the HTTP protocol version used in the request.',
    },
  ],
  [
    506,
    {
      display: 'Variant Also Negotiates',
      summary: 'Server misconfiguration in content negotiation — the chosen variant negotiates itself.',
    },
  ],
  [507, { display: 'Insufficient Storage', summary: 'WebDAV — the server cannot store what the request requires.' }],
  [
    508,
    { display: 'Loop Detected', summary: 'WebDAV — the server found an infinite loop while processing the request.' },
  ],
  [510, { display: 'Not Extended', summary: 'The request needs a further extension for the server to fulfill it.' }],
  [
    511,
    {
      display: 'Network Authentication Required',
      summary: 'The network (typically a captive portal) requires authentication before granting access.',
    },
  ],
]);

interface StatusRange {
  kicker: string;
  fallbackSummary: string;
}

function rangeFor(status: number): StatusRange {
  if (status >= 100 && status < 200)
    return {
      kicker: '1xx Informational',
      fallbackSummary: 'Interim response — the exchange is still in progress and a final status follows.',
    };
  if (status >= 200 && status < 300)
    return { kicker: '2xx Success', fallbackSummary: 'The request was received, understood, and accepted.' };
  if (status >= 300 && status < 400)
    return {
      kicker: '3xx Redirection',
      fallbackSummary: 'Further action is needed to complete the request — look at the Location response header.',
    };
  if (status >= 400 && status < 500)
    return {
      kicker: '4xx Client error',
      fallbackSummary: 'The server rejected the request as sent — something in the request needs to change.',
    };
  if (status >= 500 && status < 600)
    return {
      kicker: '5xx Server error',
      fallbackSummary: 'The server failed to fulfill an apparently valid request — the fault is on the server side.',
    };
  return { kicker: 'Non-standard', fallbackSummary: 'This code is outside the standard HTTP status ranges.' };
}

/** True when we have curated copy for this exact code. */
export function hasStatusCodeInfo(status: number): boolean {
  return STATUS_INFO.has(status);
}

/**
 * Always-returns lookup for the status-chip popover. Curated codes get
 * specific copy; anything else gets the honest range-level fallback.
 * `statusText` is what the server actually sent — shown when it
 * differs from the canonical reason phrase.
 */
export function getStatusCodeInfoContent(status: number, statusText: string): InfoPopoverContent {
  const range = rangeFor(status);
  const entry = STATUS_INFO.get(status);
  if (!entry) {
    return {
      title: `${status}${statusText ? ` ${statusText}` : ''}`,
      kicker: `HTTP status · ${range.kicker}`,
      summary: range.fallbackSummary,
      description: 'This exact code is not documented in our registry — the range above is its standard meaning.',
    };
  }
  const serverPhraseDiffers = statusText !== '' && statusText.toLowerCase() !== entry.display.toLowerCase();
  return {
    title: `${status} ${entry.display}`,
    kicker: `HTTP status · ${range.kicker}`,
    summary: entry.summary,
    description:
      entry.body || serverPhraseDiffers
        ? [entry.body, serverPhraseDiffers ? `The server sent the reason phrase "${statusText}".` : undefined]
            .filter(Boolean)
            .join(' ')
        : undefined,
  };
}

/** Count of curated codes, exposed for tests + sanity checks. */
export function statusCodeInfoCount(): number {
  return STATUS_INFO.size;
}
