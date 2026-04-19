/**
 * File blob reference model for V5 (ARCHITECTURE.md §6).
 *
 * A `FileRef` is a content-addressed pointer to a user-uploaded blob.
 * The BYTES live in the extension's IndexedDB (or the desktop's OPFS
 * in v2+). The reference carries only the metadata needed to
 * recognize and attach the blob at request-execution time:
 *
 *   • `hash`     — `sha256:<64-hex>`, the identity.
 *   • `filename` — user-facing label, mirrored into the `Content-
 *     Disposition` of multipart parts unless overridden per-part.
 *   • `mimeType` — optional, defaults to `application/octet-stream`
 *     when the executor attaches the blob.
 *   • `size`     — byte count; kept on the reference so UIs can
 *     render totals without reading every blob.
 *
 * The hash IS the identity: two uploads of the same bytes dedupe to
 * one blob. Renaming a file is free (filename only); re-uploading
 * the same content under a different name produces a duplicate
 * registry entry but a single blob.
 *
 * # {{file.X}} resolution
 *
 * The `file` namespace (see `variables/namespaces.ts`) resolves to
 * the STRING `sha256:<hex>` — NOT the bytes. Callers that need the
 * bytes resolve the hash through the platform BlobStore.
 *
 * Rationale: keeping the template-resolution tier string-only
 * preserves the resolver's purity (no async, no I/O) and keeps the
 * same template machinery usable in DNR rule values + log lines +
 * wherever else `{{VAR}}` is interpolated. Binary attachment is a
 * separate concern, handled by the request executor at send time.
 *
 * This file intentionally lives in `@openheaders/core` because both
 * the extension and the desktop need the FileRef shape + registry
 * semantics. The actual blob store (IDB on one side, OPFS on the
 * other) is per-platform.
 */

import type { FileRef } from '../types/v5/request';

export type { FileRef };

/**
 * Placeholder hash prefix used by importers that recognized a file
 * reference (curl `-F ...@path`, HAR multipart, Postman formdata file
 * parts, Postman `file` body) without being able to carry the bytes
 * across. The hash field is required by the FileRef contract so
 * importers can't just emit `null`; a sentinel lets the UI surface a
 * "Upload required" badge and offer an inline replacement without
 * introducing a second not-yet-a-FileRef shape.
 *
 * The executor silently skips parts whose fileRef.hash does not
 * resolve in the BlobStore — placeholders never will, so they drop
 * out of the outgoing FormData until the user uploads the real file.
 *
 * Format: `placeholder:<opaque-label>` where `<opaque-label>` is the
 * importer's best guess at the original filename (URL-encoded to
 * tolerate any byte sequence). Not used as a lookup key — pure UI
 * signal.
 */
export const PLACEHOLDER_HASH_PREFIX = 'placeholder:';

/** `true` when a FileRef is an importer-emitted placeholder awaiting a real upload. */
export function isPlaceholderFileRef(ref: FileRef): boolean {
  return ref.hash.startsWith(PLACEHOLDER_HASH_PREFIX);
}

/**
 * Build a placeholder FileRef from an importer. `filename` is the
 * label the importer recovered; `mimeType` / `size` are best-effort.
 * `size: 0` is correct — no bytes are known yet.
 */
export function placeholderFileRef(input: { filename: string; mimeType?: string; size?: number }): FileRef {
  const label = encodeURIComponent(input.filename || 'missing');
  return {
    hash: `${PLACEHOLDER_HASH_PREFIX}${label}`,
    filename: input.filename || 'missing',
    mimeType: input.mimeType,
    size: typeof input.size === 'number' && input.size >= 0 ? input.size : 0,
  };
}

/**
 * In-memory snapshot of the workspace's file registry — passed to
 * the VariableResolver so `{{file.X}}` can resolve synchronously.
 * Two indices for two lookup styles:
 *
 *   • `byLabel` — `{{file.invoice.pdf}}` resolves by filename. If
 *     multiple FileRefs share the same filename, the first insertion
 *     wins (registrations are stable across resolver snapshots —
 *     user-observable collisions surface as import-report entries).
 *   • `byHash`  — `{{file.sha256:abc…}}` resolves by explicit hash.
 *     Rare in hand-written requests; common in YAML emitted by the
 *     codec where the hash is the canonical form.
 */
export interface FileRegistry {
  byLabel: ReadonlyMap<string, FileRef>;
  byHash: ReadonlyMap<string, FileRef>;
}

/**
 * Build a FileRegistry from a flat list of FileRefs. Duplicate-label
 * entries are resolved by first-insertion-wins (per the registry
 * contract above). Duplicate hashes should never occur — the hash IS
 * the identity; surfaced as a last-wins collapse if they do.
 */
export function buildFileRegistry(refs: readonly FileRef[]): FileRegistry {
  const byLabel = new Map<string, FileRef>();
  const byHash = new Map<string, FileRef>();
  for (const ref of refs) {
    if (!byLabel.has(ref.filename)) byLabel.set(ref.filename, ref);
    byHash.set(ref.hash, ref);
  }
  return { byLabel, byHash };
}

/**
 * Look up a file by the name used in `{{file.X}}`. Accepts either a
 * filename (`invoice.pdf`) or an explicit hash (`sha256:abc…`).
 * Returns `null` when the registry has no matching entry.
 */
export function resolveFileRef(registry: FileRegistry, name: string): FileRef | null {
  if (name.startsWith('sha256:')) {
    return registry.byHash.get(name) ?? null;
  }
  return registry.byLabel.get(name) ?? null;
}

/** Empty registry — convenient default when no files are uploaded yet. */
export const EMPTY_FILE_REGISTRY: FileRegistry = {
  byLabel: new Map(),
  byHash: new Map(),
};
