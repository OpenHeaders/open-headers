/**
 * Request-executor body sub-cases e2e — the wire-confirmation gate for
 * the body variants the auth × body matrix doesn't reach.
 *
 * The matrix (`request-executor.spec.ts`) covers the seven top-level
 * body types once each. This spec drills into the sub-cases that only
 * the body dimension exercises:
 *   - `text` with a `rawFormat` hint (JavaScript / HTML) tuning the
 *     default Content-Type,
 *   - `graphql` WITHOUT variables (the matrix only sends with-vars),
 *   - `form` / `multipart` rows flagged `enabled: false` being skipped
 *     on the wire,
 *   - `multipart` FILE parts — real bytes uploaded through the
 *     BlobStore bridge, referenced by `fileId`, and reflected back by
 *     the decoder as `{ filename, size, contentType }`.
 *
 * Assertions read the playground decoder's `echo.body`, so a green run
 * means the executor serialized each shape onto the actual wire.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  rpcPage = await context.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await rpcPage.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
});

test.afterAll(async () => {
  await context.close();
});

async function rpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return rpcPage.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  ) as Promise<T>;
}

interface FileRef {
  fileId: string;
  hash: string;
  filename: string;
  mimeType?: string;
  size: number;
}

/** Upload a string through the SW putFile RPC; returns the FileRef. */
async function uploadFile(filename: string, content: string, mimeType = 'text/plain'): Promise<FileRef> {
  const resp = (await rpcPage.evaluate(
    async ({ filename: fn, content: c, mimeType: mt }) => {
      const bytes = new TextEncoder().encode(c);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const bytesBase64 = btoa(binary);
      return await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'putFile', filename: fn, mimeType: mt, bytesBase64 }, (r) => {
          void chrome.runtime.lastError;
          resolve(r);
        });
      });
    },
    { filename, content, mimeType },
  )) as { success: boolean; fileRef?: FileRef };
  expect(resp.success).toBe(true);
  expect(resp.fileRef).toBeDefined();
  return resp.fileRef!;
}

interface MultipartEchoPart {
  name: string;
  value?: string;
  filename?: string;
  contentType?: string | null;
  size?: number;
}

interface EchoResponse {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body:
    | { kind: 'none'; contentType: string | null }
    | { kind: 'json'; contentType: string | null; parsed: unknown; raw: string }
    | { kind: 'xml'; contentType: string | null; raw: string }
    | { kind: 'text'; contentType: string | null; raw: string }
    | { kind: 'urlencoded'; contentType: string | null; parsed: Record<string, string | string[]>; raw: string }
    | { kind: 'multipart'; contentType: string | null; parts: MultipartEchoPart[] };
}

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

let nextUid = 0;
function draft(body: Record<string, unknown>): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-body-${nextUid}`,
    path: `requests/body-e2e/req-${nextUid}`,
    name: 'body extras e2e',
    method: 'POST',
    url: API_ECHO_URL,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body,
  };
}

async function send(d: Record<string, unknown>): Promise<EchoResponse> {
  const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft: d });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

let partUid = 0;
function nextPartUid(): string {
  partUid += 1;
  return `part-${partUid}`;
}

test.describe('Request executor — body sub-cases on the wire', () => {
  test('text rawFormat=javascript defaults Content-Type to text/javascript', async () => {
    const echo = await send(draft({ type: 'text', content: 'const x = 1;\n', rawFormat: 'javascript' }));
    expect(echo.body.kind).toBe('text');
    expect(echo.body.contentType).toContain('text/javascript');
    expect((echo.body as Extract<EchoResponse['body'], { kind: 'text' }>).raw).toBe('const x = 1;\n');
  });

  test('text rawFormat=html defaults Content-Type to text/html', async () => {
    const echo = await send(draft({ type: 'text', content: '<p>hi</p>', rawFormat: 'html' }));
    expect(echo.body.kind).toBe('text');
    expect(echo.body.contentType).toContain('text/html');
  });

  test('text with no rawFormat defaults Content-Type to text/plain', async () => {
    const echo = await send(draft({ type: 'text', content: 'plain words' }));
    expect(echo.body.kind).toBe('text');
    expect(echo.body.contentType).toContain('text/plain');
  });

  test('graphql with no variables ships {"query":...} only', async () => {
    const echo = await send(draft({ type: 'graphql', content: '{ viewer { id } }' }));
    expect(echo.body.kind).toBe('json');
    const parsed = (echo.body as Extract<EchoResponse['body'], { kind: 'json' }>).parsed as Record<string, unknown>;
    expect(parsed).toEqual({ query: '{ viewer { id } }' });
    expect('variables' in parsed).toBe(false);
  });

  test('graphql with whitespace-only variables omits the variables field', async () => {
    const echo = await send(draft({ type: 'graphql', content: 'query { x }', graphqlVariables: '   ' }));
    const parsed = (echo.body as Extract<EchoResponse['body'], { kind: 'json' }>).parsed as Record<string, unknown>;
    expect(parsed).toEqual({ query: 'query { x }' });
  });

  test('form drops disabled rows on the wire', async () => {
    const echo = await send(
      draft({
        type: 'form',
        formParts: [
          { uid: nextPartUid(), key: 'kept', value: '1', enabled: true },
          { uid: nextPartUid(), key: 'dropped', value: '2', enabled: false },
          { uid: nextPartUid(), key: 'implicit', value: '3' }, // enabled omitted ⇒ sent
        ],
      }),
    );
    expect(echo.body.kind).toBe('urlencoded');
    const parsed = (echo.body as Extract<EchoResponse['body'], { kind: 'urlencoded' }>).parsed;
    expect(parsed).toEqual({ kept: '1', implicit: '3' });
  });

  test('multipart drops disabled text parts on the wire', async () => {
    const echo = await send(
      draft({
        type: 'multipart',
        multipartParts: [
          { kind: 'text', uid: nextPartUid(), name: 'kept', value: 'a', enabled: true },
          { kind: 'text', uid: nextPartUid(), name: 'dropped', value: 'b', enabled: false },
        ],
      }),
    );
    expect(echo.body.kind).toBe('multipart');
    const parts = (echo.body as Extract<EchoResponse['body'], { kind: 'multipart' }>).parts;
    expect(parts).toEqual([{ name: 'kept', value: 'a' }]);
  });

  test('multipart FILE part ships real BlobStore bytes with filename + size', async () => {
    const content = 'attachment payload 🚀';
    const byteLength = Buffer.byteLength(content, 'utf8');
    const ref = await uploadFile('note.txt', content, 'text/plain');

    const echo = await send(
      draft({
        type: 'multipart',
        multipartParts: [
          { kind: 'text', uid: nextPartUid(), name: 'caption', value: 'hello', enabled: true },
          { kind: 'file', uid: nextPartUid(), name: 'upload', fileRefs: [ref], enabled: true },
        ],
      }),
    );

    expect(echo.body.kind).toBe('multipart');
    const parts = (echo.body as Extract<EchoResponse['body'], { kind: 'multipart' }>).parts;
    expect(parts).toContainEqual({ name: 'caption', value: 'hello' });
    expect(parts).toContainEqual({
      name: 'upload',
      filename: 'note.txt',
      contentType: 'text/plain',
      size: byteLength,
    });
  });

  test('multipart FILE part with a missing blob is silently skipped', async () => {
    // A fileRef pointing at bytes that aren't in the store drops out of
    // the outgoing FormData (the placeholder-not-reconciled contract).
    const echo = await send(
      draft({
        type: 'multipart',
        multipartParts: [
          { kind: 'text', uid: nextPartUid(), name: 'present', value: 'x', enabled: true },
          {
            kind: 'file',
            uid: nextPartUid(),
            name: 'ghost',
            fileRefs: [
              {
                fileId: 'file:does-not-exist',
                hash: 'placeholder:missing',
                filename: 'ghost.bin',
                mimeType: 'application/octet-stream',
                size: 0,
              },
            ],
            enabled: true,
          },
        ],
      }),
    );
    expect(echo.body.kind).toBe('multipart');
    const parts = (echo.body as Extract<EchoResponse['body'], { kind: 'multipart' }>).parts;
    expect(parts).toEqual([{ name: 'present', value: 'x' }]);
  });
});
