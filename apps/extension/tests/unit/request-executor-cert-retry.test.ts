/**
 * Certificate-exception retry — the offscreen wire-fetch fallback for
 * sends the SW's fetch rejects with a certificate-family net error
 * (execute.ts → offscreen-retry.ts → offscreen-host.runWireFetch).
 * Covers the retry gating (`isCertRejection`), the ResolvedRequest →
 * WirePlan fold, and the executor-level outcome: a successful
 * offscreen retry replaces the error snapshot, a failed one falls
 * back to the classified certificate error.
 */

import type { Collection, Environment, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
// Registers the `requests.*` setting definitions (import side effect) —
// the retry path reads the response-body cap.
import '@openheaders/ui/workbench/settings/schema/requests';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every send in this file fails at the SW fetch layer with the opaque
// generic failure — the retry path is what's under test.
vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

Object.defineProperty(globalThis.navigator, 'onLine', {
  value: true,
  configurable: true,
  writable: true,
});

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as Collection[]),
  getRequestCollectionsForWorkspace: vi.fn(() => [] as Collection[]),
  getRequestFolders: vi.fn(() => []),
  getRequestFoldersForWorkspace: vi.fn(() => []),
  getRequestUidsForWorkspace: vi.fn(() => null),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: vi.fn(() => [] as Collection[]),
}));

vi.mock('@openheaders/oracle/entity/files-store', () => ({
  getFileBlob: vi.fn(async () => new Blob(['file-bytes'], { type: 'text/plain' })),
}));

// The wire capture is the netError source — pin it to a certificate
// rejection so the executor takes the retry branch.
const mockSettleNetError = vi.fn(async () => 'net::ERR_CERT_AUTHORITY_INVALID' as string | undefined);
vi.mock('@/background/modules/request-executor/wire-capture', () => ({
  startWireCapture: vi.fn(() => ({
    settle: async () => undefined,
    settleNetError: mockSettleNetError,
    cancel: () => {},
  })),
}));

const mockRunWireFetch = vi.fn();
const mockIsOffscreenSupported = vi.fn(() => true);
vi.mock('@/background/modules/offscreen-host', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isOffscreenSupported: () => mockIsOffscreenSupported(),
  runWireFetch: (plan: unknown) => mockRunWireFetch(plan),
}));

import { executeRequestDraft } from '@/background/modules/request-executor';
import { buildWirePlan, isCertRejection } from '@/background/modules/request-executor/offscreen-retry';
import type { ResolvedRequest } from '@/background/modules/request-executor/resolve';
import type { WirePlan } from '@/shared/wire-fetch/plan';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'r1',
    path: 'requests/default-xxxx/r1',
    name: 'R',
    method: 'GET',
    url: 'https://localhost.openheaders.io:3443/echo',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function makeResolved(overrides: Partial<ResolvedRequest> = {}): ResolvedRequest {
  return {
    method: 'GET',
    url: 'https://localhost.openheaders.io:3443/echo',
    headers: [],
    params: [],
    body: { type: 'none' },
    credentialsMode: 'omit',
    ...overrides,
  };
}

const okRetry = {
  ok: true as const,
  status: 200,
  statusText: 'OK',
  url: 'https://localhost.openheaders.io:3443/echo',
  headers: [{ key: 'content-type', value: 'application/json' }],
  bodyBase64: btoa('{"echoed":true}'),
  bodyBytes: 15,
  truncated: false,
  durationMs: 12,
};

beforeEach(() => {
  mockRunWireFetch.mockReset();
  mockIsOffscreenSupported.mockReturnValue(true);
  mockSettleNetError.mockResolvedValue('net::ERR_CERT_AUTHORITY_INVALID');
});

describe('isCertRejection', () => {
  it('matches certificate-family codes', () => {
    expect(isCertRejection('net::ERR_CERT_AUTHORITY_INVALID')).toBe(true);
    expect(isCertRejection('net::ERR_CERT_COMMON_NAME_INVALID')).toBe(true);
    expect(isCertRejection('net::ERR_CERT_DATE_INVALID')).toBe(true);
  });

  it('rejects non-certificate and client-auth codes', () => {
    expect(isCertRejection(undefined)).toBe(false);
    expect(isCertRejection('net::ERR_CONNECTION_REFUSED')).toBe(false);
    expect(isCertRejection('net::ERR_SSL_PROTOCOL_ERROR')).toBe(false);
    expect(isCertRejection('net::ERR_SSL_CLIENT_AUTH_CERT_NEEDED')).toBe(false);
    expect(isCertRejection('net::ERR_BAD_SSL_CLIENT_AUTH_CERT')).toBe(false);
  });
});

describe('buildWirePlan', () => {
  it('folds text-family bodies and carries wire options', async () => {
    const plan = await buildWirePlan(
      makeResolved({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"a":1}' },
        credentialsMode: 'include',
        followRedirects: false,
        timeoutMs: 5000,
      }),
      1024,
    );
    expect(plan).toEqual({
      url: 'https://localhost.openheaders.io:3443/echo',
      method: 'POST',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: { kind: 'text', content: '{"a":1}' },
      redirect: 'manual',
      credentials: 'include',
      timeoutMs: 5000,
      capBytes: 1024,
    });
  });

  it('folds graphql to the JSON wire body', async () => {
    const plan = await buildWirePlan(
      makeResolved({ body: { type: 'graphql', content: 'query Q { ok }', graphqlVariables: '{"v":2}' } }),
      1024,
    );
    expect(plan.body).toEqual({ kind: 'text', content: '{"query":"query Q { ok }","variables":{"v":2}}' });
  });

  it('keeps enabled form entries only', async () => {
    const plan = await buildWirePlan(
      makeResolved({
        body: {
          type: 'form',
          formParts: [
            { uid: 'f1', key: 'a', value: '1', enabled: true },
            { uid: 'f2', key: 'b', value: '2', enabled: false },
          ],
        },
      }),
      1024,
    );
    expect(plan.body).toEqual({ kind: 'form', entries: [{ key: 'a', value: '1' }] });
  });

  it('inlines multipart file bytes as base64 and strips the user multipart Content-Type', async () => {
    const plan = await buildWirePlan(
      makeResolved({
        headers: [
          { key: 'X-Keep', value: 'yes' },
          { key: 'Content-Type', value: 'multipart/form-data' },
        ],
        body: {
          type: 'multipart',
          multipartParts: [
            { kind: 'text', uid: 'p1', name: 'field', value: 'v', enabled: true },
            {
              kind: 'file',
              uid: 'p2',
              name: 'upload',
              fileRefs: [
                { fileId: 'file-1', hash: 'placeholder:test', filename: 'a.txt', mimeType: 'text/plain', size: 10 },
              ],
              enabled: true,
            },
          ],
        },
      }),
      1024,
    );
    expect(plan.headers).toEqual([{ key: 'X-Keep', value: 'yes' }]);
    expect(plan.body).toEqual({
      kind: 'multipart',
      parts: [
        { kind: 'text', name: 'field', value: 'v' },
        { kind: 'file', name: 'upload', bytesBase64: btoa('file-bytes'), filename: 'a.txt', mimeType: 'text/plain' },
      ],
    });
  });
});

describe('executor certificate retry', () => {
  it('returns the offscreen result when the retry succeeds after a cert rejection', async () => {
    mockRunWireFetch.mockResolvedValue(okRetry);
    const res = await executeRequestDraft(makeRequest(), {});
    expect(res.error).toBeNull();
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"echoed":true}');
    expect(res.headers).toEqual([{ key: 'content-type', value: 'application/json' }]);
    expect(res.durationMs).toBe(12);
    const plan = mockRunWireFetch.mock.calls[0]?.[0] as WirePlan;
    expect(plan.url).toBe('https://localhost.openheaders.io:3443/echo');
    expect(plan.method).toBe('GET');
  });

  it('keeps the classified certificate error when the retry fails too', async () => {
    mockRunWireFetch.mockResolvedValue({ ok: false, message: 'Failed to fetch' });
    const res = await executeRequestDraft(makeRequest(), {});
    expect(res.status).toBe(0);
    expect(res.error).toContain('ERR_CERT_AUTHORITY_INVALID');
    expect(res.errorHint).toEqual({
      kind: 'open-in-tab',
      url: 'https://localhost.openheaders.io:3443/echo',
      netError: 'net::ERR_CERT_AUTHORITY_INVALID',
    });
  });

  it('skips the retry when the runtime has no offscreen API (Firefox)', async () => {
    mockIsOffscreenSupported.mockReturnValue(false);
    const res = await executeRequestDraft(makeRequest(), {});
    expect(mockRunWireFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(0);
    expect(res.error).toContain('ERR_CERT_AUTHORITY_INVALID');
  });

  it('does not retry non-certificate failures', async () => {
    mockSettleNetError.mockResolvedValue('net::ERR_CONNECTION_REFUSED');
    const res = await executeRequestDraft(makeRequest(), {});
    expect(mockRunWireFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(0);
    expect(res.error).toContain('refused the connection');
  });
});
