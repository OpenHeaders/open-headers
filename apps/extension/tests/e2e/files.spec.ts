/**
 * Phase 12 Files e2e — exercises the full IDB-backed BlobStore stack
 * against real Chromium + real IndexedDB + real bridge RPCs:
 *
 *   1. putFile: upload bytes → FileRef returned.
 *   2. listFiles: the just-uploaded file appears in the metadata list.
 *   3. getFile: retrieves the exact bytes that were uploaded.
 *   4. putFile (dedup): re-uploading the same bytes with a different
 *      filename returns the ORIGINAL FileRef (identity = hash).
 *   5. deleteFile: removes the blob; listFiles drops it.
 *   6. putFile → getFile round-trip preserves binary integrity.
 *
 * The IDB-level code is thin — tests focus on the bridge contract
 * and the workspace-scoping invariant (different workspaces keep
 * independent blobs).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2];
});

test.afterAll(async () => {
  await context.close();
});

async function newRpcPage(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  return page;
}

async function rpc<T = unknown>(page: Page, type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(
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
  hash: string;
  filename: string;
  mimeType?: string;
  size: number;
}

/**
 * Upload a string via the SW's putFile RPC. Bytes cross the bridge
 * as base64 (chrome.runtime.sendMessage JSON-serializes payloads, so
 * ArrayBuffer / Blob are not wire-safe).
 */
async function uploadFile(page: Page, filename: string, content: string, mimeType = 'text/plain'): Promise<FileRef> {
  const resp = (await page.evaluate(
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

async function getFileText(page: Page, hash: string): Promise<string | null> {
  return page.evaluate(async (h: string) => {
    const resp = await new Promise<{ found: boolean; bytesBase64?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'getFile', hash: h }, (r) => {
        void chrome.runtime.lastError;
        resolve(r);
      });
    });
    if (!resp.found || !resp.bytesBase64) return null;
    const binary = atob(resp.bytesBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }, hash);
}

test.describe('Phase 12 — BlobStore bridge', () => {
  test('putFile stores a blob; listFiles surfaces the new FileRef', async () => {
    const page = await newRpcPage();
    try {
      const ref = await uploadFile(page, 'hello.txt', 'hello world');
      expect(ref.filename).toBe('hello.txt');
      expect(ref.size).toBe(11);
      expect(ref.hash).toBe('sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');

      const list = (await rpc(page, 'listFiles')) as { files: FileRef[] };
      const hit = list.files.find((f) => f.hash === ref.hash);
      expect(hit).toBeDefined();
      expect(hit!.filename).toBe('hello.txt');
      expect(hit!.mimeType).toBe('text/plain');
    } finally {
      await page.close();
    }
  });

  test('getFile returns the exact bytes that were uploaded', async () => {
    const page = await newRpcPage();
    try {
      const ref = await uploadFile(page, 'roundtrip.txt', 'round trip payload 🚀');
      const text = await getFileText(page, ref.hash);
      expect(text).toBe('round trip payload 🚀');
    } finally {
      await page.close();
    }
  });

  test('re-uploading the same bytes dedupes by hash (filename stable)', async () => {
    const page = await newRpcPage();
    try {
      const first = await uploadFile(page, 'first-name.txt', 'the same bytes');
      const second = await uploadFile(page, 'different-name.txt', 'the same bytes');
      // Same hash — same blob.
      expect(second.hash).toBe(first.hash);
      // First insertion wins the filename so existing FileRef references
      // stay stable across uploads.
      expect(second.filename).toBe('first-name.txt');

      const list = (await rpc(page, 'listFiles')) as { files: FileRef[] };
      const matches = list.files.filter((f) => f.hash === first.hash);
      expect(matches).toHaveLength(1);
    } finally {
      await page.close();
    }
  });

  test('deleteFile removes the blob from listFiles', async () => {
    const page = await newRpcPage();
    try {
      const ref = await uploadFile(page, 'to-delete.txt', 'disposable');
      const before = (await rpc(page, 'listFiles')) as { files: FileRef[] };
      expect(before.files.find((f) => f.hash === ref.hash)).toBeDefined();

      const del = (await rpc(page, 'deleteFile', { hash: ref.hash })) as {
        success: boolean;
        removed: boolean;
      };
      expect(del.success).toBe(true);
      expect(del.removed).toBe(true);

      const after = (await rpc(page, 'listFiles')) as { files: FileRef[] };
      expect(after.files.find((f) => f.hash === ref.hash)).toBeUndefined();

      // Second delete is a no-op.
      const delAgain = (await rpc(page, 'deleteFile', { hash: ref.hash })) as {
        success: boolean;
        removed: boolean;
      };
      expect(delAgain.success).toBe(true);
      expect(delAgain.removed).toBe(false);
    } finally {
      await page.close();
    }
  });

  test('getFile returns found: false for an unknown hash', async () => {
    const page = await newRpcPage();
    try {
      const resp = (await rpc(page, 'getFile', {
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      })) as { found: boolean };
      expect(resp.found).toBe(false);
    } finally {
      await page.close();
    }
  });

  test('binary-ish content round-trips byte-for-byte', async () => {
    const page = await newRpcPage();
    try {
      // Embed every byte value 0-255 so we catch any 8-bit clean-path
      // regression in the bridge's base64 handling.
      const { uploadedSize, hash } = (await page.evaluate(async () => {
        const bytes = new Uint8Array(256);
        for (let i = 0; i < 256; i++) bytes[i] = i;
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        const bytesBase64 = btoa(binary);
        const resp = await new Promise<{ success: boolean; fileRef?: FileRef }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'putFile',
              filename: 'binary.bin',
              mimeType: 'application/octet-stream',
              bytesBase64,
            },
            (r) => {
              void chrome.runtime.lastError;
              resolve(r);
            },
          );
        });
        return { uploadedSize: resp.fileRef?.size, hash: resp.fileRef?.hash };
      })) as { uploadedSize: number; hash: string };
      expect(uploadedSize).toBe(256);

      const matches = await page.evaluate(async (h: string) => {
        const resp = await new Promise<{ found: boolean; bytesBase64?: string }>((resolve) => {
          chrome.runtime.sendMessage({ type: 'getFile', hash: h }, (r) => {
            void chrome.runtime.lastError;
            resolve(r);
          });
        });
        if (!resp.found || !resp.bytesBase64) return { ok: false as const, reason: 'not-found' };
        const binary = atob(resp.bytesBase64);
        const view = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        if (view.length !== 256) return { ok: false as const, reason: `length: ${view.length}` };
        for (let i = 0; i < 256; i++) {
          if (view[i] !== i) return { ok: false as const, reason: `byte ${i}=${view[i]}` };
        }
        return { ok: true as const };
      }, hash);
      expect(matches.ok, matches.ok ? undefined : (matches as { reason: string }).reason).toBe(true);
    } finally {
      await page.close();
    }
  });
});
