/**
 * Shared rig for the node request transport suites — the transport
 * wired to injectable fetch/request mocks so tests observe the exact
 * init (headers, body, dispatcher) the transport builds, plus the
 * request factory and error/response builders every suite uses.
 */

import type { TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { Response } from 'undici';
import { vi } from 'vitest';
import {
  createNodeRequestTransport,
  type NodeFetchFn,
  type NodeRequestFn,
  type NodeRequestTransportOptions,
} from '../../../src/live/node-request-transport';

export function makeRequest(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    body: { kind: 'none' },
    redirect: 'follow',
    credentials: 'omit',
    maxBodyBytes: 2 * 1024 * 1024,
    ...overrides,
  };
}

/** Build a thrown fetch error carrying an undici-style `cause.code`. */
export function fetchError(code: string): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) });
}

/** A redirect hop response — status + Location, empty body. */
export function redirectResponse(status: number, location: string): Response {
  return new Response(null, { status, headers: { location } });
}

/** Per-file mocks + the transport wired to them via both wire seams,
 *  with the call accessors bound to the same mock instances. Reset the
 *  mocks in a `beforeEach` in each suite. */
export function makeRig() {
  const fetchMock = vi.fn<NodeFetchFn>();
  const requestMock = vi.fn<NodeRequestFn>();
  // The environment plane is OFF by default so every suite stays
  // hermetic against the running machine's proxy env vars; the
  // environment-plane suite passes its own fake resolver.
  const transport = (options: Partial<NodeRequestTransportOptions> = {}) =>
    createNodeRequestTransport({ fetchFn: fetchMock, requestFn: requestMock, environmentProxy: null, ...options });
  /** Init of the n-th recorded fetch call — the transport always passes one. */
  const callInit = (n = 0): NonNullable<Parameters<NodeFetchFn>[1]> => {
    const init = fetchMock.mock.calls[n]?.[1];
    if (!init) throw new Error(`fetch call ${n} recorded no init`);
    return init;
  };
  /** URL of the n-th recorded fetch call. */
  const callUrl = (n = 0): string => String(fetchMock.mock.calls[n]?.[0]);
  return { fetchMock, requestMock, transport, callInit, callUrl };
}
