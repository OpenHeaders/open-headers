/**
 * FilesContext — file blob catalog provider for popup, sidepanel,
 * panel, and workbench surfaces.
 *
 * Mirrors the prior per-family providers (per MWPT-FULL § 4.1) but
 * adapts the read path to the files entity's structurally-distinct
 * shape: there is no `wsKeys.files` storage key. The catalog (list of
 * `FileRef` shells) lives as a sync-engine singleton entity exposed via
 * `oh.sync.snapshotFiles` + per-workspace {@link FilesSyncMirror}; the
 * actual blob bytes live in IndexedDB `BlobStore`, keyed
 * `(workspaceId, fileId)`.
 *
 *   - `activeWorkspaceIdOverride` set ⇒ workbench (override) branch:
 *     reads via `getFilesSyncMirrorForWorkspace(wsId).subscribeMirror`
 *     (the mirror's bridge subscription filters by
 *     `event.envelope.workspaceId` per M-2); writes route through the
 *     SW message handlers (`putFile` / `getFile` / `deleteFile` /
 *     `renameFile`) with the explicit `workspaceId` so both layers
 *     (BlobStore IDB + catalog batch) land on the editing-scope
 *     workspace, regardless of the runtime-Active.
 *   - `activeWorkspaceIdOverride` unset ⇒ legacy (system surface)
 *     branch: reads via `listFiles` RPC + `filesChanged` broadcast on
 *     the SW's runtime-Active workspace; writes via the legacy
 *     workspaceId-free RPC (which falls back to runtime-Active inside
 *     the SW).
 *
 * Bytes cannot bypass the SW (BlobStore IDB lives in the SW only), so
 * the canonical "renderer-direct Phase B writes" path used for prior
 * sessions does not fully apply — the SW message handlers stay
 * load-bearing. The override-branch correctness contract is the
 * `workspaceId` thread through the SW handlers (BC-MWPT-FULL-3-files).
 */

import type { FileRef } from '@openheaders/core/files';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFilesSyncMirrorForWorkspace } from '@/context/files-sync-mirror';

export type RenameFileOutcome =
  | { ok: true; fileRef: FileRef }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface FilesContextValue {
  files: FileRef[];
  isReady: boolean;
  uploadFile: (file: File | Blob, filename: string, mimeType?: string) => Promise<FileRef | null>;
  deleteFile: (fileId: string) => Promise<boolean>;
  renameFile: (fileId: string, filename: string, mimeType?: string) => Promise<RenameFileOutcome>;
  readFile: (fileId: string) => Promise<{ blob: Blob; mimeType: string } | null>;
}

const defaultContextValue: FilesContextValue = {
  files: [],
  isReady: false,
  uploadFile: () => Promise.resolve(null),
  deleteFile: () => Promise.resolve(false),
  renameFile: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  readFile: () => Promise.resolve(null),
};

export const FilesContext = createContext<FilesContextValue>(defaultContextValue);

interface FilesProviderProps {
  children: React.ReactNode;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See sibling Providers for the discipline contract; same shape here
   * for the files singleton-catalog slice
   * (BC-MWPT-FULL-1-files / BC-MWPT-FULL-2-files / BC-MWPT-FULL-3-files).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const FilesProvider: React.FC<FilesProviderProps> = ({ children, activeWorkspaceIdOverride }) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const writeWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : null;

  const [files, setFiles] = useState<FileRef[]>([]);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path — legacy branch (system surfaces) ────────────────
  //
  // Legacy: `listFiles` RPC (runtime-Active workspace) + `filesChanged`
  // broadcast + `workspaceChanged` re-load. The override branch
  // short-circuits the broadcast handler so it never overwrites the
  // override-branch state with global-default data.

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (isOverridden) return;
      const resp = await call('listFiles', {}).catch(() => null);
      if (cancelled) return;
      setFiles(resp?.files ?? []);
      setIsReady(true);
    };
    void initialLoad();

    const unsub = subscribe('filesChanged', (payload) => {
      if (!isOverridden) setFiles(payload.files);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      if (isOverridden) return;
      void initialLoad();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden]);

  // ── Read path — override branch (workbench) ─────────────────────
  //
  // Files do NOT have a `wsKeys.X` storage key (catalog lives in the
  // sync engine; bytes live in BlobStore IDB). Override branch consumes
  // the per-workspace mirror's `subscribeMirror` instead of
  // `hostStorage.subscribe`. The mirror's bridge subscription
  // filters by `event.envelope.workspaceId` (M-2), so cross-workspace
  // contamination is structurally inexpressible.

  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setFiles([]);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    const mirror = getFilesSyncMirrorForWorkspace(wsId);
    const updateFromMirror = () => {
      if (overrideIdRef.current !== wsId) return;
      setFiles(mirror.liveRefs());
    };
    // Kick a snapshot to gate isReady — the mirror also auto-fetches
    // at construction, but the Provider needs an explicit ack so
    // editors can pause spinners until the catalog has landed.
    void call('oh.sync.snapshotFiles', { workspaceId: wsId })
      .then((resp) => {
        if (overrideIdRef.current !== wsId) return;
        const first = resp.entries[0];
        setFiles(first ? first.refs : mirror.liveRefs());
        setIsReady(true);
      })
      .catch(() => {
        if (overrideIdRef.current !== wsId) return;
        setFiles(mirror.liveRefs());
        setIsReady(true);
      });
    const unsub = mirror.subscribeMirror(updateFromMirror);
    return () => unsub();
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Bytes cannot bypass the SW (BlobStore IDB lives in the SW only).
  // Both branches dispatch to the SW message handlers; the override
  // branch threads `workspaceId` so the SW routes to the editing-scope
  // workspace's BlobStore + oracle (closes the same-class bug from
  // Session 14 for the file entity family — BC-MWPT-FULL-3-files).

  const uploadFile = useCallback<FilesContextValue['uploadFile']>(
    async (file, filename, mimeType) => {
      const buf = await file.arrayBuffer();
      const bytesBase64 = arrayBufferToBase64(buf);
      const resolvedMime = mimeType ?? (file instanceof File ? file.type || undefined : undefined);
      const wsArg = isOverridden && writeWorkspaceId ? { workspaceId: writeWorkspaceId } : {};
      const resp = await call('putFile', { filename, mimeType: resolvedMime, bytesBase64, ...wsArg }).catch(() => null);
      return resp?.success ? (resp.fileRef ?? null) : null;
    },
    [isOverridden, writeWorkspaceId],
  );

  const deleteFile = useCallback<FilesContextValue['deleteFile']>(
    async (fileId) => {
      const wsArg = isOverridden && writeWorkspaceId ? { workspaceId: writeWorkspaceId } : {};
      const resp = await call('deleteFile', { fileId, ...wsArg }).catch(() => null);
      return Boolean(resp?.removed);
    },
    [isOverridden, writeWorkspaceId],
  );

  const renameFile = useCallback<FilesContextValue['renameFile']>(
    async (fileId, filename, mimeType) => {
      try {
        const wsArg = isOverridden && writeWorkspaceId ? { workspaceId: writeWorkspaceId } : {};
        const resp = await call('renameFile', { fileId, filename, mimeType, ...wsArg });
        if (!resp.success) return { ok: false, reason: 'other', message: resp.error };
        if (!resp.found) return { ok: false, reason: 'not-found' };
        return { ok: true, fileRef: resp.fileRef as FileRef };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        return { ok: false, reason: 'other', message };
      }
    },
    [isOverridden, writeWorkspaceId],
  );

  const readFile = useCallback<FilesContextValue['readFile']>(
    async (fileId) => {
      const wsArg = isOverridden && writeWorkspaceId ? { workspaceId: writeWorkspaceId } : {};
      const resp = await call('getFile', { fileId, ...wsArg }).catch(() => null);
      if (!resp?.found || typeof resp.bytesBase64 !== 'string') return null;
      const buf = base64ToArrayBuffer(resp.bytesBase64);
      const mimeType = resp.mimeType ?? 'application/octet-stream';
      return { blob: new Blob([buf], { type: mimeType }), mimeType };
    },
    [isOverridden, writeWorkspaceId],
  );

  const value = useMemo<FilesContextValue>(
    () => ({ files, isReady, uploadFile, deleteFile, renameFile, readFile }),
    [files, isReady, uploadFile, deleteFile, renameFile, readFile],
  );

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
};

export function useFilesContext(): FilesContextValue {
  return useContext(FilesContext);
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
