/**
 * File blob reference model for V5 (ARCHITECTURE.md §6).
 *
 * A `FileRef` is a pointer to a user-uploaded blob. The BYTES live in
 * the extension's IndexedDB (or the desktop's OPFS in v2+). The
 * reference carries:
 *
 *   • `fileId`   — stable per-file identity. Independent of content:
 *     uploading identical bytes under two different filenames produces
 *     TWO distinct `fileId`s. This is what the blob store keys by.
 *   • `hash`     — `sha256:<64-hex>` content digest. Multiple FileRefs
 *     MAY share a hash when users upload the same content under
 *     different names; that's intended. Used by `{{file.X}}` template
 *     resolution when users reference files by content.
 *   • `filename` — user-facing label, mirrored into `Content-Disposition`
 *     on multipart parts.
 *   • `mimeType` — optional, defaults to `application/octet-stream`
 *     when the executor attaches the blob.
 *   • `size`     — byte count; kept on the reference so UIs can
 *     render totals without reading every blob.
 *
 * Identity split rationale: users think of files by their filename +
 * upload event, not by the hash of their content. A user who uploads
 * `console.log` and `console_backup.log` (same bytes) expects to see
 * two files. The fileId carries file identity; the hash carries
 * content identity. Same bytes still dedupe at the IDB layer when we
 * want (e.g., shared blob pool with reference counting); for now each
 * fileId gets its own row.
 *
 * # {{file.X}} resolution
 *
 * The `file` namespace (see `variables/namespaces.ts`) resolves to a
 * hash STRING — NOT the bytes. Callers that need the bytes resolve
 * the fileId through the platform BlobStore. Lookup accepts either
 * a filename (`{{file.invoice.pdf}}`) or an explicit hash
 * (`{{file.sha256:abc…}}`) or a fileId (`{{file.file:<uuid>}}`).
 *
 * This file intentionally lives in `@openheaders/core` because both
 * the extension and the desktop need the FileRef shape + registry
 * semantics. The actual blob store (IDB on one side, OPFS on the
 * other) is per-platform.
 */

import type { FileRef } from '../types/request';

export type { FileRef };

/** Prefix for placeholder hashes + fileIds emitted by importers. */
export const PLACEHOLDER_HASH_PREFIX = 'placeholder:';
export const PLACEHOLDER_FILE_ID_PREFIX = 'placeholder:';
export const REAL_FILE_ID_PREFIX = 'file:';

/** `true` when a FileRef is an importer-emitted placeholder awaiting a real upload. */
export function isPlaceholderFileRef(ref: FileRef): boolean {
  return ref.hash.startsWith(PLACEHOLDER_HASH_PREFIX);
}

/**
 * Build a placeholder FileRef from an importer. `filename` is the
 * label the importer recovered; `mimeType` / `size` are best-effort.
 * Each call emits a fresh `fileId` so two placeholders with the same
 * filename are still two distinct entries.
 */
export function placeholderFileRef(input: { filename: string; mimeType?: string; size?: number }): FileRef {
  const label = encodeURIComponent(input.filename || 'missing');
  return {
    fileId: `${PLACEHOLDER_FILE_ID_PREFIX}${generateFileIdSuffix()}`,
    hash: `${PLACEHOLDER_HASH_PREFIX}${label}`,
    filename: input.filename || 'missing',
    mimeType: input.mimeType,
    size: typeof input.size === 'number' && input.size >= 0 ? input.size : 0,
  };
}

/**
 * Generate a fresh `fileId` for a real upload. Format: `file:<uuid>`
 * — the prefix distinguishes real files from placeholders and leaves
 * room for future id shapes.
 */
export function newFileId(): string {
  return `${REAL_FILE_ID_PREFIX}${generateFileIdSuffix()}`;
}

/**
 * In-memory snapshot of the workspace's file registry — passed to the
 * VariableResolver so `{{file.X}}` can resolve synchronously. Three
 * indices for three lookup styles:
 *
 *   • `byFileId` — `{{file.file:<uuid>}}` resolves by exact file identity.
 *   • `byLabel`  — `{{file.invoice.pdf}}` resolves by filename. If
 *     multiple FileRefs share the same filename, first-insertion
 *     wins.
 *   • `byHash`   — `{{file.sha256:abc…}}` resolves by content digest.
 *     If multiple FileRefs share a hash, first-insertion wins.
 */
export interface FileRegistry {
  byFileId: ReadonlyMap<string, FileRef>;
  byLabel: ReadonlyMap<string, FileRef>;
  byHash: ReadonlyMap<string, FileRef>;
}

/** Build a FileRegistry from a flat list of FileRefs. */
export function buildFileRegistry(refs: readonly FileRef[]): FileRegistry {
  const byFileId = new Map<string, FileRef>();
  const byLabel = new Map<string, FileRef>();
  const byHash = new Map<string, FileRef>();
  for (const ref of refs) {
    byFileId.set(ref.fileId, ref);
    if (!byLabel.has(ref.filename)) byLabel.set(ref.filename, ref);
    if (!byHash.has(ref.hash)) byHash.set(ref.hash, ref);
  }
  return { byFileId, byLabel, byHash };
}

/**
 * Look up a file by the name used in `{{file.X}}`. Accepts a
 * filename, an explicit hash (`sha256:…`), or a fileId (`file:…`).
 * Returns `null` when the registry has no matching entry.
 */
export function resolveFileRef(registry: FileRegistry, name: string): FileRef | null {
  if (name.startsWith(REAL_FILE_ID_PREFIX) || name.startsWith(PLACEHOLDER_FILE_ID_PREFIX)) {
    return registry.byFileId.get(name) ?? null;
  }
  if (name.startsWith('sha256:')) {
    return registry.byHash.get(name) ?? null;
  }
  return registry.byLabel.get(name) ?? null;
}

/** Empty registry — convenient default when no files are uploaded yet. */
export const EMPTY_FILE_REGISTRY: FileRegistry = {
  byFileId: new Map(),
  byLabel: new Map(),
  byHash: new Map(),
};

// ── Helpers ────────────────────────────────────────────────────────

function generateFileIdSuffix(): string {
  // `crypto.randomUUID` exists in every target runtime (service worker,
  // renderer, desktop main + renderer). Falls back to a timestamp +
  // random combo only if the runtime is a test harness without the
  // global; kept defensive, not likely to fire.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
