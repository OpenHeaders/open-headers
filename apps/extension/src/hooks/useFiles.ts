/**
 * useFiles — renderer-side view of the active workspace's file blobs.
 *
 * Mirrors the `useEnvironments` shape: one `listFiles` RPC at mount
 * for the first paint, one `filesChanged` subscription keeping every
 * component in sync afterwards, plus a `workspaceChanged` subscription
 * that re-reads when the active workspace swaps (filesChanged doesn't
 * fire on switch — the orchestrator swaps state without touching the
 * store's own mutators).
 *
 * Uploads / deletes go through the typed bridge RPCs. Bytes cross the
 * wire as base64 strings (chrome.runtime.sendMessage JSON-serializes
 * its payload; ArrayBuffer / Blob round-trip to `{}`). See the `putFile`
 * / `getFile` contract entries for the transport rationale.
 */

import type { FileRef } from '@openheaders/core/files';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';

export type RenameFileOutcome =
  | { ok: true; fileRef: FileRef }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface UseFilesApi {
  files: FileRef[];
  isReady: boolean;
  /** Upload a Blob/File to the active workspace. Every call produces a
   *  fresh `FileRef` with its own `fileId`; two uploads of the same
   *  bytes are two independent entries. */
  uploadFile: (file: File | Blob, filename: string, mimeType?: string) => Promise<FileRef | null>;
  /** Delete a file by `fileId`. Returns `true` when an entry was removed. */
  deleteFile: (fileId: string) => Promise<boolean>;
  /**
   * Rename a file's metadata in place. Bytes + hash are unchanged.
   * Returns `not-found` when the fileId isn't present in the active
   * workspace (deleted between gesture and apply); `other` carries any
   * transport-layer error message.
   */
  renameFile: (fileId: string, filename: string, mimeType?: string) => Promise<RenameFileOutcome>;
  /**
   * Pull the raw bytes for a file by `fileId`. Returns `null` when the
   * fileId isn't stored in the active workspace. Callers typically use
   * this for downloads or previews; the executor reads via
   * `getFileBlob` directly inside the SW.
   */
  readFile: (fileId: string) => Promise<{ blob: Blob; mimeType: string } | null>;
}

export function useFiles(): UseFilesApi {
  const [files, setFiles] = useState<FileRef[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      const resp = await call('listFiles').catch(() => null);
      if (cancelled) return;
      setFiles(resp?.files ?? []);
      setIsReady(true);
    };
    void loadInitial();

    const unsub = subscribe('filesChanged', (payload) => {
      setFiles(payload.files);
    });

    const unsubWs = subscribe('workspaceChanged', () => {
      void loadInitial();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, []);

  const uploadFile = useCallback<UseFilesApi['uploadFile']>(async (file, filename, mimeType) => {
    const buf = await file.arrayBuffer();
    const bytesBase64 = arrayBufferToBase64(buf);
    const resolvedMime = mimeType ?? (file instanceof File ? file.type || undefined : undefined);
    const resp = await call('putFile', { filename, mimeType: resolvedMime, bytesBase64 }).catch(() => null);
    return resp?.success ? (resp.fileRef ?? null) : null;
  }, []);

  const deleteFile = useCallback<UseFilesApi['deleteFile']>(async (fileId) => {
    const resp = await call('deleteFile', { fileId }).catch(() => null);
    return Boolean(resp?.removed);
  }, []);

  const renameFile = useCallback<UseFilesApi['renameFile']>(async (fileId, filename, mimeType) => {
    try {
      const resp = await call('renameFile', { fileId, filename, mimeType });
      if (!resp.success) return { ok: false, reason: 'other', message: resp.error };
      if (!resp.found) return { ok: false, reason: 'not-found' };
      return { ok: true, fileRef: resp.fileRef as FileRef };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return { ok: false, reason: 'other', message };
    }
  }, []);

  const readFile = useCallback<UseFilesApi['readFile']>(async (fileId) => {
    const resp = await call('getFile', { fileId }).catch(() => null);
    if (!resp?.found || typeof resp.bytesBase64 !== 'string') return null;
    const buf = base64ToArrayBuffer(resp.bytesBase64);
    const mimeType = resp.mimeType ?? 'application/octet-stream';
    return { blob: new Blob([buf], { type: mimeType }), mimeType };
  }, []);

  return { files, isReady, uploadFile, deleteFile, renameFile, readFile };
}

// ── Base64 helpers — chunked to avoid stack overflow on large files ─

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
