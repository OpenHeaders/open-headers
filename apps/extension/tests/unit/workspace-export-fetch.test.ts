/**
 * URL-fetch import source — host allowlist + redirect validation +
 * 1 MB streaming cap (design §5.1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const real = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
  return {
    ...real,
    extensionStorage: {
      get: mockGet,
      set: vi.fn(async () => undefined),
      getMany: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
    },
  };
});

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

import {
  fetchWorkspaceExportYaml,
  getAllowedFetchHosts,
  parseAllowedHostsList,
  URL_FETCH_MAX_BYTES,
} from '@/background/modules/workspace-export-fetch';

const realFetch = globalThis.fetch;

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): void {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = impl as unknown as typeof fetch;
}

afterEach(() => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = realFetch;
  mockGet.mockReset().mockResolvedValue(undefined);
});

describe('parseAllowedHostsList', () => {
  it('splits on commas and whitespace, lowercases, de-dupes', () => {
    expect(parseAllowedHostsList('Github.com, raw.githubusercontent.com,gist.github.com')).toEqual([
      'github.com',
      'raw.githubusercontent.com',
      'gist.github.com',
    ]);
    expect(parseAllowedHostsList('a.com a.com   a.com')).toEqual(['a.com']);
    expect(parseAllowedHostsList('')).toEqual([]);
  });
});

describe('getAllowedFetchHosts', () => {
  it('falls back to defaults when settings dict is empty', async () => {
    mockGet.mockResolvedValue({});
    const hosts = await getAllowedFetchHosts();
    expect(hosts).toEqual(['github.com', 'raw.githubusercontent.com', 'gist.github.com']);
  });

  it('reads the user-configured value from oh.settings.user', async () => {
    mockGet.mockResolvedValue({ 'workspaceSharing.allowedFetchHosts': 'example.openheaders.io, x.openheaders.io' });
    const hosts = await getAllowedFetchHosts();
    expect(hosts).toEqual(['example.openheaders.io', 'x.openheaders.io']);
  });

  it('falls back to defaults when the user value parses empty', async () => {
    mockGet.mockResolvedValue({ 'workspaceSharing.allowedFetchHosts': '   ' });
    const hosts = await getAllowedFetchHosts();
    expect(hosts).toEqual(['github.com', 'raw.githubusercontent.com', 'gist.github.com']);
  });
});

describe('fetchWorkspaceExportYaml — pre-flight rejections', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({});
  });

  it('rejects http:// URLs without making a network call', async () => {
    let called = false;
    mockFetch(async () => {
      called = true;
      return new Response('');
    });
    const res = await fetchWorkspaceExportYaml('http://github.com/x.yaml');
    expect(called).toBe(false);
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.reason).toBe('not-https');
  });

  it('rejects off-allowlist hosts before any network call', async () => {
    let called = false;
    mockFetch(async () => {
      called = true;
      return new Response('');
    });
    const res = await fetchWorkspaceExportYaml('https://evil.openheaders.io/x.yaml');
    expect(called).toBe(false);
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.reason).toBe('host-not-allowlisted');
  });

  it('accepts allowlisted hosts (and subdomains)', async () => {
    mockFetch(async () => new Response('kind: workspace-export', { status: 200 }));
    const res = await fetchWorkspaceExportYaml('https://raw.githubusercontent.com/u/r/x.yaml');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.yaml).toBe('kind: workspace-export');
  });
});

describe('fetchWorkspaceExportYaml — redirects', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({});
  });

  it('refuses to follow a redirect to a non-allowlisted host', async () => {
    mockFetch(async (url) => {
      if (String(url) === 'https://github.com/start.yaml') {
        return new Response(null, { status: 302, headers: { Location: 'https://evil.openheaders.io/leaked.yaml' } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const res = await fetchWorkspaceExportYaml('https://github.com/start.yaml');
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.reason).toBe('redirect-host-not-allowlisted');
  });

  it('follows a redirect when the target is allowlisted', async () => {
    let hop = 0;
    mockFetch(async (url) => {
      hop++;
      if (String(url) === 'https://github.com/start.yaml') {
        return new Response(null, { status: 302, headers: { Location: 'https://raw.githubusercontent.com/x.yaml' } });
      }
      if (String(url) === 'https://raw.githubusercontent.com/x.yaml') {
        return new Response('ok', { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const res = await fetchWorkspaceExportYaml('https://github.com/start.yaml');
    expect(hop).toBe(2);
    expect(res.ok).toBe(true);
  });
});

describe('fetchWorkspaceExportYaml — size cap', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({});
  });

  it('rejects bodies larger than 1 MB', async () => {
    const huge = 'a'.repeat(URL_FETCH_MAX_BYTES + 100);
    mockFetch(async () => new Response(huge, { status: 200 }));
    const res = await fetchWorkspaceExportYaml('https://github.com/x.yaml');
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.reason).toBe('body-too-large');
  });
});
