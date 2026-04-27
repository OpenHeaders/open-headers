/**
 * Deep-link encode/decode coverage.
 *
 * Two axes:
 *   1. Round-trip — utf-8 YAML → encode → decode → utf-8 equality.
 *   2. Bomb defense — a maliciously-crafted gzip stream that blows past
 *      the per-decoder cap aborts mid-stream rather than consuming
 *      arbitrary memory.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEEP_LINK_MAX_DECOMPRESSED_BYTES,
  DeepLinkDecompressionBombError,
  DeepLinkPayloadTooLargeError,
  decodeWorkspaceExportDeepLink,
  encodeWorkspaceExportDeepLink,
} from '../../src/workspace-export/deep-link';

const MIN_YAML = `kind: workspace-export
schemaVersion: 5
exportFormatVersion: 1
exportId: a1b2c3d4
exportedAt: 2026-04-27T00:00:00.000Z
scope: workspace
source:
  app: extension
  appVersion: 5.0.0
  platform: chrome
  workspaceLabel: Demo
workspace:
  uid: 11111111
  name: Demo
  kind: personal
meta:
  redactions:
    vault: omitted
  counts:
    rules: 0
    requests: 0
    templates: 0
    environments: 0
    workflows: 0
    liveVariables: 0
    secrets: 0
entities: {}
`;

describe('encodeWorkspaceExportDeepLink / decodeWorkspaceExportDeepLink', () => {
  it('round-trips a minimal YAML envelope', async () => {
    const encoded = await encodeWorkspaceExportDeepLink(MIN_YAML);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    // base64url alphabet — no `+`, `/`, or `=`.
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeWorkspaceExportDeepLink(encoded);
    expect(decoded).toBe(MIN_YAML);
  });

  it('round-trips a YAML payload with non-ASCII content', async () => {
    const yaml = `${MIN_YAML}# 🚀 emoji + RTL: عربي + accented: café\n`;
    const encoded = await encodeWorkspaceExportDeepLink(yaml);
    const decoded = await decodeWorkspaceExportDeepLink(encoded);
    expect(decoded).toBe(yaml);
  });

  it('refuses to encode past maxCompressedBytes (sender-side guard)', async () => {
    // 100 KB of well-compressing zeros still won't gzip below ~1 KB.
    // Set the cap below that to force the rejection.
    const big = 'a'.repeat(100 * 1024);
    await expect(encodeWorkspaceExportDeepLink(big, { maxCompressedBytes: 16 })).rejects.toBeInstanceOf(
      DeepLinkPayloadTooLargeError,
    );
  });

  it('refuses to decode past maxDecompressedBytes (recipient-side bomb defense)', async () => {
    // Build a gzip payload that legitimately decodes to ~1 MB so we can
    // verify the streaming cap aborts mid-stream when the cap is below
    // the payload size. We can't trivially craft a synthetic compression
    // bomb without a third-party gzip library, but a real 1 MB payload
    // exercises the same bounded-read path.
    const oneMb = 'a'.repeat(1024 * 1024);
    const encoded = await encodeWorkspaceExportDeepLink(oneMb);
    await expect(decodeWorkspaceExportDeepLink(encoded, { maxDecompressedBytes: 64 * 1024 })).rejects.toBeInstanceOf(
      DeepLinkDecompressionBombError,
    );
  });

  it('default decoder cap permits a healthy export envelope', async () => {
    // Sanity check: anything below 4 MB decoded fits comfortably under
    // the default ceiling.
    expect(DEFAULT_DEEP_LINK_MAX_DECOMPRESSED_BYTES).toBeGreaterThan(MIN_YAML.length);
    const encoded = await encodeWorkspaceExportDeepLink(MIN_YAML);
    const decoded = await decodeWorkspaceExportDeepLink(encoded);
    expect(decoded).toBe(MIN_YAML);
  });

  it('rejects a malformed base64url input', async () => {
    // `~~~~` is outside the base64url alphabet and atob will throw.
    await expect(decodeWorkspaceExportDeepLink('~~~~')).rejects.toBeTruthy();
  });

  it('rejects a non-gzip byte stream', async () => {
    // A valid base64url that decodes to bytes which are not a gzip
    // header. DecompressionStream throws on the first chunk.
    const notGzip = btoa('not a gzip stream at all').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await expect(decodeWorkspaceExportDeepLink(notGzip)).rejects.toBeTruthy();
  });
});
