/**
 * File-blob bridge RPCs (Phase 12 — ARCHITECTURE §6 content-addressed
 * blobs). Catalog operations carry metadata; blob bytes ride as base64
 * since `chrome.runtime.sendMessage` JSON-serializes its payload.
 */

import type { FileRef } from '../../files';

export interface FileRpc {
  /**
   * List every file blob in the active workspace. Metadata only
   * (FileRef = fileId + hash + filename + mimeType + size); bytes are
   * fetched separately via `getFile` when the user previews or when
   * the executor builds a multipart body.
   */
  listFiles: {
    req: { workspaceId?: string };
    res: { files: FileRef[] };
  };
  /**
   * Upload a blob. `chrome.runtime.sendMessage` JSON-serializes its
   * payload (ArrayBuffer becomes `{}` on the wire), so we ship the
   * bytes as a base64 string and decode them on the SW side. The SW
   * reconstitutes a Blob and writes to IDB. Every upload produces a
   * fresh `fileId` — two uploads of the same bytes are two entries.
   *
   * Optional `workspaceId` overrides the SW's runtime-Active workspace
   * (workbench tabs in per-window-or-tab mode pass their editing-scope
   * workspaceId so bytes + catalog mutation land on the correct
   * workspace). Omitted = falls back to the SW's runtime-Active.
   */
  putFile: {
    req: { filename: string; mimeType?: string; bytesBase64: string; workspaceId?: string };
    res: { success: boolean; fileRef?: FileRef; error?: string };
  };
  /**
   * Return the raw bytes for a file by `fileId`. Matches `putFile`'s
   * base64 transport — the SW encodes the blob bytes before responding,
   * the caller decodes to ArrayBuffer / Blob as needed. Returns
   * `found: false` when the fileId isn't stored in this workspace.
   */
  getFile: {
    req: { fileId: string; workspaceId?: string };
    res: { found: boolean; bytesBase64?: string; mimeType?: string };
  };
  /**
   * Delete a file by `fileId`. Callers should check upstream
   * references (request multipart parts) before firing; the SW does
   * not cascade.
   */
  deleteFile: {
    req: { fileId: string; workspaceId?: string };
    res: { success: boolean; removed: boolean; error?: string };
  };
  /**
   * Rename a file's metadata in place. Two-step write at the SW:
   * `BlobStore.renameBlob` updates the durable byte record, then a
   * `renameFileRef` envelope flows through the oracle so other surfaces
   * converge under per-(setPath, itemId) LWW. Bytes + hash are
   * preserved — only the `filename` (and optional `mimeType`) change.
   * Returns the updated `FileRef` shell on success, or `found: false`
   * when the fileId isn't present in this workspace.
   */
  renameFile: {
    req: { fileId: string; filename: string; mimeType?: string; workspaceId?: string };
    res: { success: boolean; found: boolean; fileRef?: FileRef; error?: string };
  };
}
