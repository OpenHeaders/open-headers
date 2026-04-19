/**
 * Multipart body execution — Phase 12 coverage. Verifies the
 * executor:
 *   • Builds a FormData body from `body.multipartParts`.
 *   • Resolves `fileRef.hash` → bytes via the BlobStore (mocked).
 *   • Strips any manually-set `Content-Type: multipart/form-data`
 *     header so the browser sets the boundary itself.
 *   • Skips parts marked `enabled: false` and file parts whose
 *     blobs don't resolve.
 *   • Honors `filenameOverride` for file parts.
 */

import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
  fetchMock(input, init);
  return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
});

vi.mock('@/background/modules/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as V5.Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, version: 1, variables: [] }) as V5.WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, version: 1, secrets: [] }) as V5.Vault),
}));

vi.mock('@/background/modules/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as V5.Collection[]),
}));

vi.mock('@/background/modules/rule-store', () => ({
  getCollections: vi.fn(() => [] as V5.Collection[]),
}));

vi.mock('@/background/modules/files-store', () => ({
  listFiles: vi.fn(async () => []),
  getFileBlob: vi.fn(async (hash: string) => {
    if (hash === 'sha256:' + 'a'.repeat(64)) {
      return new Blob(['apple-bytes'], { type: 'text/plain' });
    }
    if (hash === 'sha256:' + 'b'.repeat(64)) {
      return new Blob(['pdf-bytes'], { type: 'application/pdf' });
    }
    return null; // unknown hash
  }),
}));

import { executeRequestDraft } from '@/background/modules/request-executor';

function makeMultipartRequest(
  parts: V5.MultipartPart[],
  headers: Array<{ key: string; value: string }> = [],
): V5.Request {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'rMP',
    path: 'requests/default-xxxx/rMP',
    name: 'MP',
    method: 'POST',
    url: 'https://api.openheaders.io/upload',
    headers,
    params: [],
    auth: { type: 'none' },
    body: { type: 'multipart', multipartParts: parts },
  };
}

async function readFormData(init: RequestInit): Promise<FormData> {
  // When init.body is a FormData, we can inspect it directly.
  // Node's undici FormData supports the standard API.
  expect(init.body).toBeInstanceOf(FormData);
  return init.body as FormData;
}

describe('executor — multipart bodies', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('attaches text parts verbatim', async () => {
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'name', value: 'alice' },
        { kind: 'text', name: 'role', value: 'admin' },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('name')).toBe('alice');
    expect(form.get('role')).toBe('admin');
  });

  it('attaches file parts with resolved bytes + filename', async () => {
    const hash = 'sha256:' + 'a'.repeat(64);
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'attachment',
          fileRef: { hash, filename: 'apple.txt', size: 11, mimeType: 'text/plain' },
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    const part = form.get('attachment');
    expect(part).toBeInstanceOf(File);
    expect((part as File).name).toBe('apple.txt');
    expect((part as File).type).toBe('text/plain');
    const text = await (part as File).text();
    expect(text).toBe('apple-bytes');
  });

  it('skips parts marked enabled: false', async () => {
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'live', value: '1' },
        { kind: 'text', name: 'dead', value: 'IGNORED', enabled: false },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('live')).toBe('1');
    expect(form.get('dead')).toBeNull();
  });

  it('skips file parts whose blobs resolve to null', async () => {
    const missing = 'sha256:' + 'c'.repeat(64);
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'present', value: 'yes' },
        {
          kind: 'file',
          name: 'missing',
          fileRef: { hash: missing, filename: 'gone.bin', size: 0 },
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('present')).toBe('yes');
    expect(form.get('missing')).toBeNull();
  });

  it('honors filenameOverride on file parts', async () => {
    const hash = 'sha256:' + 'a'.repeat(64);
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'attachment',
          fileRef: { hash, filename: 'apple.txt', size: 11 },
          filenameOverride: 'served-as.txt',
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect((form.get('attachment') as File).name).toBe('served-as.txt');
  });

  it('strips a manually-set Content-Type: multipart/form-data header', async () => {
    // If the user explicitly sets Content-Type: multipart/form-data
    // in the headers panel (common mistake when porting curl --form
    // commands), the boundary is omitted and the server rejects the
    // request. The executor must drop the header so the browser
    // generates one with its own boundary.
    await executeRequestDraft(
      makeMultipartRequest(
        [{ kind: 'text', name: 'k', value: 'v' }],
        [{ key: 'Content-Type', value: 'multipart/form-data' }],
      ),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    // The browser will re-set Content-Type via FormData; what matters
    // is that the user-set header is no longer present.
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('keeps other headers when stripping a multipart Content-Type', async () => {
    await executeRequestDraft(
      makeMultipartRequest(
        [{ kind: 'text', name: 'k', value: 'v' }],
        [
          { key: 'Content-Type', value: 'multipart/form-data' },
          { key: 'X-Trace', value: 'abc' },
        ],
      ),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('X-Trace')).toBe('abc');
  });

  it('leaves non-multipart Content-Type headers untouched', async () => {
    await executeRequestDraft(
      makeMultipartRequest(
        [{ kind: 'text', name: 'k', value: 'v' }],
        [{ key: 'Content-Type', value: 'application/json' }],
      ),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    // Not stripped; the user chose it explicitly for some reason.
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('produces an empty FormData when multipartParts is absent', async () => {
    const req = makeMultipartRequest([]);
    req.body = { type: 'multipart' }; // multipartParts omitted
    await executeRequestDraft(req);
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    let count = 0;
    for (const _ of form.entries()) count += 1;
    expect(count).toBe(0);
  });

  it('skips placeholder-hash file parts (no blob resolves)', async () => {
    // Importer-emitted placeholders land with `placeholder:` hashes.
    // BlobStore.getFileBlob returns null for anything not sha256, so
    // the part silently drops out of the FormData until the user
    // reconciles it via the multipart body editor.
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'ok', value: '1' },
        {
          kind: 'file',
          name: 'pending',
          fileRef: { hash: 'placeholder:invoice.pdf', filename: 'invoice.pdf', size: 0 },
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('ok')).toBe('1');
    expect(form.get('pending')).toBeNull();
  });
});

describe('executor — multipart templating (Phase 12.4b)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('resolves {{VAR}} in text part values via the environment-store workspace vars', async () => {
    const { getWorkspaceVariables } = await import('@/background/modules/environment-store');
    (getWorkspaceVariables as ReturnType<typeof vi.fn>).mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [
        { name: 'USER', value: 'alice', type: 'default' },
        { name: 'ROLE', value: 'admin', type: 'default' },
      ],
    } as V5.WorkspaceVariables);

    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'name', value: '{{USER}}' },
        { kind: 'text', name: '{{ROLE}}-field', value: 'static' },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('name')).toBe('alice');
    expect(form.get('admin-field')).toBe('static');
  });

  it('resolves {{VAR}} in file-part filenameOverride', async () => {
    const { getWorkspaceVariables } = await import('@/background/modules/environment-store');
    (getWorkspaceVariables as ReturnType<typeof vi.fn>).mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ name: 'STEM', value: 'renamed', type: 'default' }],
    } as V5.WorkspaceVariables);

    const hash = 'sha256:' + 'a'.repeat(64);
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'attachment',
          fileRef: { hash, filename: 'apple.txt', size: 11 },
          filenameOverride: '{{STEM}}.txt',
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect((form.get('attachment') as File).name).toBe('renamed.txt');
  });
});
