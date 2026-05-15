/**
 * Canonical content-hash helper. Pure — no I/O, no storage seam. Both
 * the IDB backend and the filesystem backend call this when ingesting a
 * blob so the `sha256:<hex>` digest semantics stay identical across
 * hosts (and the renderer's `{{file.X}}` resolution by content works
 * uniformly).
 */

/**
 * Compute the canonical `sha256:<hex>` digest of a blob. Uses the
 * WebCrypto subtle API — available in the SW, the renderer, and Node
 * 19+ without a shim.
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
