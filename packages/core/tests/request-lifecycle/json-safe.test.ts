/**
 * Wire-contract backstop: `RequestLifecycle` must survive a JSON
 * round-trip with structural equality preserved.
 *
 * `chrome.runtime.Port.postMessage` serializes messages across process
 * boundaries (service worker ↔ devtools panel) via JSON. Any field that
 * loses information through `JSON.parse(JSON.stringify(x))` — `Map`,
 * `Set`, `Date`, class instances, functions — breaks the panel at
 * render time and the regression is invisible to in-realm reducer
 * tests. This file pins the contract from both sides:
 *
 *   1. Compile-time: imports `RequestLifecycleJsonSafeProof` from core
 *      and assigns `true` to it. The proof type resolves to `true` only
 *      when `RequestLifecycle` is structurally JSON-safe; if a future
 *      field violates that (e.g. someone adds `readonly seen: Set<…>`),
 *      the assignment fails to typecheck.
 *
 *   2. Runtime: round-trips a fully-populated lifecycle (every optional
 *      set, multi-hop redirect, populated `har`/`harBodyByHop` arrays)
 *      through JSON and asserts deep equality.
 */

import { describe, expect, it } from 'vitest';

import type {
  RequestLifecycle,
  RequestLifecycleJsonSafeProof,
} from '../../src/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '../../src/types/har-source';

const _PROOF: RequestLifecycleJsonSafeProof = true;
void _PROOF;

function harEntry(url: string): InspectorHarEntry {
  return {
    startedDateTime: new Date(0).toISOString(),
    time: 12,
    request: {
      method: 'GET',
      url,
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'accept', value: '*/*' }],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'HTTP/1.1',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: 'text/plain' },
      headersSize: -1,
      bodySize: 0,
      redirectURL: '',
    },
    cache: {},
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
  };
}

function harBody(text: string): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://openheaders.io/',
    startedDateTime: new Date(0).toISOString(),
    content: text,
    encoding: '',
  };
}

describe('RequestLifecycle JSON-safe wire contract', () => {
  it('survives JSON round-trip with structural equality', () => {
    const lifecycle: RequestLifecycle = {
      tabId: 7,
      requestId: 'req-42',
      url: 'https://openheaders.io/final',
      method: 'GET',
      resourceType: 'xmlhttprequest',
      initiator: 'https://openheaders.io/app.js',
      phase: 'completed',
      redirectHopCount: 1,
      redirectHops: [
        {
          sourceUrl: 'https://openheaders.io/start',
          redirectUrl: 'https://openheaders.io/final',
          statusCode: 301,
          timestampMs: 1000,
        },
      ],
      startedAtMs: 1000,
      hopStartedAtMs: 1500,
      completedAtMs: 2000,
      statusCode: 200,
      statusText: 'OK',
      fromCache: false,
      error: { code: 'oh:none', reason: 'ok' },
      har: [harEntry('https://openheaders.io/start'), harEntry('https://openheaders.io/final')],
      harBodyByHop: [null, harBody('hello')],
    };

    const roundTripped = JSON.parse(JSON.stringify(lifecycle));
    expect(roundTripped).toEqual(lifecycle);
  });

  it('preserves null padding in sparse hop slots', () => {
    const lifecycle: RequestLifecycle = {
      tabId: 1,
      requestId: 'req-pad',
      url: 'https://openheaders.io/',
      method: 'GET',
      resourceType: 'xmlhttprequest',
      phase: 'pending',
      redirectHopCount: 2,
      redirectHops: [],
      startedAtMs: 0,
      hopStartedAtMs: 0,
      har: [null, null, harEntry('https://openheaders.io/')],
      harBodyByHop: [],
    };

    const roundTripped: RequestLifecycle = JSON.parse(JSON.stringify(lifecycle));
    expect(roundTripped.har).toHaveLength(3);
    expect(roundTripped.har[0]).toBeNull();
    expect(roundTripped.har[1]).toBeNull();
    expect(roundTripped.har[2]?.request?.url).toBe('https://openheaders.io/');
  });
});
