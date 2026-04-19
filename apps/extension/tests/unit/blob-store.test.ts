/**
 * Coverage for `hashBlob` — the pure WebCrypto identity function.
 * The remaining IDB-backed BlobStore surface is exercised by the
 * Phase 12 e2e spec against real Chromium (jsdom has no IDB worth
 * trusting, and a fake-indexeddb dep is overkill for this shape).
 */

import { describe, expect, it } from 'vitest';
import { hashBlob } from '@/shared/files/blob-store';

describe('hashBlob', () => {
  it('computes the sha256 of a Blob', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const hash = await hashBlob(blob);
    // Known sha256 of "hello world".
    expect(hash).toBe('sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('gives the same hash for identical bytes regardless of mime', async () => {
    const asText = new Blob(['same bytes'], { type: 'text/plain' });
    const asBinary = new Blob(['same bytes'], { type: 'application/octet-stream' });
    expect(await hashBlob(asText)).toBe(await hashBlob(asBinary));
  });

  it('gives a distinct hash for different bytes', async () => {
    const a = new Blob(['apple']);
    const b = new Blob(['banana']);
    expect(await hashBlob(a)).not.toBe(await hashBlob(b));
  });

  it('emits the sha256: prefix followed by 64 hex chars', async () => {
    const hash = await hashBlob(new Blob(['anything']));
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('hashes the empty blob to the canonical empty-input digest', async () => {
    const empty = new Blob([]);
    const hash = await hashBlob(empty);
    expect(hash).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
