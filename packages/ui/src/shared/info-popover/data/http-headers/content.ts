/**
 * HTTP-header docs — Content.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CONTENT_HEADERS: HeaderInfoEntries = [
  [
    'content-type',
    {
      display: 'Content-Type',
      direction: 'both',
      category: 'Content',
      summary: 'Media type of the request or response body.',
      body: [
        'Drives how the browser parses the body — wrong values cause silent failures (JSON parsed as HTML, etc.).',
        'For `text/*` types, include `charset=utf-8` unless you have a reason not to.',
      ],
      commonValues: [
        { value: 'application/json', desc: 'JSON body.' },
        { value: 'application/x-www-form-urlencoded', desc: 'URL-encoded form fields.' },
        { value: 'multipart/form-data', desc: 'Multipart form / file uploads.' },
        { value: 'text/html; charset=utf-8', desc: 'HTML document.' },
        { value: 'application/octet-stream', desc: 'Opaque binary.' },
      ],
    },
  ],
  [
    'content-length',
    {
      display: 'Content-Length',
      direction: 'both',
      category: 'Content',
      summary: 'Body size in bytes (decoded).',
      body: ['Mutually exclusive with `Transfer-Encoding: chunked`. Wrong values cause connection desync.'],
    },
  ],
  [
    'content-encoding',
    {
      display: 'Content-Encoding',
      direction: 'response',
      category: 'Content',
      summary: 'Compression applied to the body — the browser decodes before exposing it to JS.',
      body: ['Common: `gzip`, `br` (Brotli), `zstd` (newer). The decoded size is what `response.body` sees.'],
    },
  ],
  [
    'content-disposition',
    {
      display: 'Content-Disposition',
      direction: 'response',
      category: 'Content',
      summary: 'Tells the browser whether the response is inline or a download.',
      body: ['`inline` (default) renders in the browser. `attachment; filename="x"` triggers a download with the given default filename.'],
    },
  ],
  [
    'accept',
    {
      display: 'Accept',
      direction: 'request',
      category: 'Content',
      summary: 'Media types the client is willing to receive.',
      body: ['Q-values express preference (`text/html;q=0.9`). Most servers ignore everything but the first type today.'],
    },
  ],
  [
    'accept-encoding',
    {
      display: 'Accept-Encoding',
      direction: 'request',
      category: 'Content',
      summary: 'Compressions the client can decode.',
      body: ['Typical browser value: `gzip, deflate, br, zstd`. Servers pick one and answer with `Content-Encoding`.'],
    },
  ],
  [
    'accept-language',
    {
      display: 'Accept-Language',
      direction: 'request',
      category: 'Content',
      summary: 'Human languages the client prefers.',
      body: ['Server selects a `Content-Language` from this list, often falling back to a default.'],
    },
  ],
  [
    'transfer-encoding',
    {
      display: 'Transfer-Encoding',
      direction: 'both',
      category: 'Content',
      summary: 'Encoding applied for transport only — stripped before the body reaches the application.',
      body: ['Almost always `chunked`. Mutually exclusive with `Content-Length`.'],
    },
  ],
  [
    'range',
    {
      display: 'Range',
      direction: 'request',
      category: 'Content',
      summary: 'Asks for a byte range of the resource instead of the whole body.',
      body: ['Format: `bytes=<start>-<end>` (inclusive). Server responds with `206 Partial Content` and `Content-Range`.'],
    },
  ],
  [
    'content-range',
    {
      display: 'Content-Range',
      direction: 'response',
      category: 'Content',
      summary: 'Identifies which byte range of the resource is in the body.',
      body: ['Format: `bytes <start>-<end>/<total>`. Returned with `206 Partial Content`.'],
    },
  ],
  [
    'accept-ranges',
    {
      display: 'Accept-Ranges',
      direction: 'response',
      category: 'Content',
      summary: 'Tells the client whether range requests are supported (`bytes`) or not (`none`).',
    },
  ],
  [
    'content-md5',
    {
      display: 'Content-MD5',
      direction: 'both',
      category: 'Content',
      summary: 'Base64-encoded MD5 digest of the body, for integrity checking. Obsolete in HTTP/1.1 RFC 7231 but still emitted by some servers.',
      body: ['Modern integrity is done via `Digest` / `Want-Digest` or via TLS itself.'],
    },
  ],
  [
    'content-language',
    {
      display: 'Content-Language',
      direction: 'response',
      category: 'Content',
      summary: 'Natural language(s) of the response body.',
      body: ['Negotiated against the request’s `Accept-Language`. Values are BCP-47 tags (`en-US`, `de-DE`, etc.).'],
    },
  ],
  [
    'content-location',
    {
      display: 'Content-Location',
      direction: 'response',
      category: 'Content',
      summary: 'Alternate URL that uniquely identifies the entity in this response.',
      body: ['Distinct from `Location`: `Content-Location` describes the resource you got, not where to redirect to.'],
    },
  ],
  [
    'accept-charset',
    {
      display: 'Accept-Charset',
      direction: 'request',
      category: 'Content',
      summary: 'Character encodings the client accepts. Deprecated — modern browsers always send UTF-8 and don’t emit this.',
      body: ['Most servers can safely ignore it.'],
    },
  ],
  [
    'if-range',
    {
      display: 'If-Range',
      direction: 'request',
      category: 'Content',
      summary: 'Conditional range request: serve the range only if the resource still matches the given ETag or date.',
      body: ['If the resource changed, server returns the full body with `200 OK` instead of `206 Partial Content`.'],
    },
  ],
  [
    'trailer',
    {
      display: 'Trailer',
      direction: 'response',
      category: 'Content',
      summary: 'Declares which header field names will appear in the trailer after a chunked body.',
      body: ['Only meaningful with `Transfer-Encoding: chunked`. The client must opt in via `TE: trailers`.'],
    },
  ],
];
