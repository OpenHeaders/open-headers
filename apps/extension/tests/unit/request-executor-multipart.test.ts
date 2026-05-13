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

import type { Collection, Environment, MultipartPart, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
  fetchMock(input, init);
  return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
});

vi.mock('@/background/modules/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
}));

vi.mock('@/background/modules/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as Collection[]),
}));

vi.mock('@/background/modules/rule-store', () => ({
  getCollections: vi.fn(() => [] as Collection[]),
}));

vi.mock('@/background/modules/files-store', () => ({
  listFiles: vi.fn(async () => []),
  getFileBlob: vi.fn(async (fileId: string) => {
    if (fileId === 'file:apple') return new Blob(['apple-bytes'], { type: 'text/plain' });
    if (fileId === 'file:banana') return new Blob(['banana-bytes'], { type: 'text/plain' });
    if (fileId === 'file:pdf') return new Blob(['pdf-bytes'], { type: 'application/pdf' });
    return null;
  }),
}));

import { executeRequestDraft } from '@/background/modules/request-executor';

type MultipartPartLike =
  | (Omit<Extract<MultipartPart, { kind: 'text' }>, 'uid'> & { uid?: string })
  | (Omit<Extract<MultipartPart, { kind: 'file' }>, 'uid'> & { uid?: string });

function makeMultipartRequest(
  parts: MultipartPartLike[],
  headers: Array<{ key: string; value: string }> = [],
): Request {
  const withUids: MultipartPart[] = parts.map((p, i) => {
    const uid = p.uid ?? `mp${String(i).padStart(6, '0')}`;
    if (p.kind === 'text') return { ...p, uid, kind: 'text' };
    return { ...p, uid, kind: 'file' };
  });
  return {
    schemaVersion: 5,
    uid: 'rMP',
    path: 'requests/default-xxxx/rMP',
    name: 'MP',
    method: 'POST',
    url: 'https://api.openheaders.io/upload',
    headers: headers.map((h, i) => ({ uid: `hdrmp${String(i).padStart(3, '0')}`, key: h.key, value: h.value })),
    params: [],
    auth: { type: 'none' },
    body: { type: 'multipart', multipartParts: withUids },
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
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'attachment',
          fileRefs: [
            {
              fileId: 'file:apple',
              hash: `sha256:${'a'.repeat(64)}`,
              filename: 'apple.txt',
              size: 11,
              mimeType: 'text/plain',
            },
          ],
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

  it('emits one FormData entry per FileRef on a multi-file row', async () => {
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'attachments',
          fileRefs: [
            {
              fileId: 'file:apple',
              hash: `sha256:${'a'.repeat(64)}`,
              filename: 'apple.txt',
              size: 11,
              mimeType: 'text/plain',
            },
            {
              fileId: 'file:banana',
              hash: `sha256:${'b'.repeat(64)}`,
              filename: 'banana.txt',
              size: 12,
              mimeType: 'text/plain',
            },
          ],
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    const entries = form.getAll('attachments');
    expect(entries).toHaveLength(2);
    expect((entries[0] as File).name).toBe('apple.txt');
    expect((entries[1] as File).name).toBe('banana.txt');
  });

  it('treats two file refs with identical hashes but different fileIds as independent', async () => {
    // Two uploads of the same bytes under different filenames produce
    // two distinct file entries. The executor must emit them both —
    // deduping at the row level would leak the old content-addressed
    // model back into the wire.
    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: 'logs',
          fileRefs: [
            {
              fileId: 'file:apple',
              hash: `sha256:${'a'.repeat(64)}`,
              filename: 'console.log',
              size: 11,
              mimeType: 'text/plain',
            },
            {
              fileId: 'file:banana',
              hash: `sha256:${'a'.repeat(64)}`,
              filename: 'console_backup.log',
              size: 11,
              mimeType: 'text/plain',
            },
          ],
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    const entries = form.getAll('logs');
    expect(entries).toHaveLength(2);
    expect((entries[0] as File).name).toBe('console.log');
    expect((entries[1] as File).name).toBe('console_backup.log');
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
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'present', value: 'yes' },
        {
          kind: 'file',
          name: 'missing',
          fileRefs: [
            {
              fileId: 'file:gone',
              hash: `sha256:${'c'.repeat(64)}`,
              filename: 'gone.bin',
              size: 0,
            },
          ],
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('present')).toBe('yes');
    expect(form.get('missing')).toBeNull();
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

  it('produces an empty FormData when multipartParts is empty', async () => {
    // The multipart variant requires `multipartParts: MultipartPart[]`,
    // so the absent-array shape is unrepresentable — we test the
    // empty-array case instead, which is the practical equivalent.
    const req = makeMultipartRequest([]);
    await executeRequestDraft(req);
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    let count = 0;
    for (const _ of form.entries()) count += 1;
    expect(count).toBe(0);
  });

  it('skips placeholder-hash file parts (no blob resolves)', async () => {
    // Importer-emitted placeholders land with `placeholder:` fileIds.
    // BlobStore.getFileBlob returns null for anything that's not a
    // real stored fileId, so the part silently drops out of the
    // FormData until the user reconciles it via the multipart editor.
    await executeRequestDraft(
      makeMultipartRequest([
        { kind: 'text', name: 'ok', value: '1' },
        {
          kind: 'file',
          name: 'pending',
          fileRefs: [
            {
              fileId: 'placeholder:invoice.pdf',
              hash: 'placeholder:invoice.pdf',
              filename: 'invoice.pdf',
              size: 0,
            },
          ],
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
      variables: [
        { uid: 'b643106b', name: 'USER', value: 'alice', type: 'default' },
        { uid: '400ea01b', name: 'ROLE', value: 'admin', type: 'default' },
      ],
    } as WorkspaceVariables);

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

  it('resolves {{VAR}} in multi-file row name via template', async () => {
    const { getWorkspaceVariables } = await import('@/background/modules/environment-store');
    (getWorkspaceVariables as ReturnType<typeof vi.fn>).mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: 'b0e41848', name: 'FIELD', value: 'upload', type: 'default' }],
    } as WorkspaceVariables);

    await executeRequestDraft(
      makeMultipartRequest([
        {
          kind: 'file',
          name: '{{FIELD}}',
          fileRefs: [
            {
              fileId: 'file:apple',
              hash: `sha256:${'a'.repeat(64)}`,
              filename: 'apple.txt',
              size: 11,
            },
          ],
        },
      ]),
    );
    const [, init] = fetchMock.mock.calls[0];
    const form = await readFormData(init);
    expect(form.get('upload')).toBeInstanceOf(File);
    expect((form.get('upload') as File).name).toBe('apple.txt');
  });
});
