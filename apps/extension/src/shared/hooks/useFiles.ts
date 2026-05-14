/**
 * useFiles — context reader for the {@link FilesContext}.
 *
 * Reads from `FilesContext` (mounted by `<FilesProvider>` on every
 * surface). Override branch — when workbench mounts the Provider with
 * `activeWorkspaceIdOverride={editingScopeWorkspaceId}` — routes both
 * the catalog read (per-workspace mirror) and the byte-bearing
 * mutators (`putFile` / `getFile` / `deleteFile` / `renameFile`)
 * through the editing-scope workspace, regardless of runtime-Active.
 *
 * The byte transport contract is preserved: bytes still cross the
 * bridge as base64 strings (`chrome.runtime.sendMessage` JSON-
 * serializes payloads). The Provider owns the encoding/decoding and
 * the `workspaceId` thread.
 */

import { type FilesContextValue, type RenameFileOutcome, useFilesContext } from '@/context/FilesContext';

export type { RenameFileOutcome };

export type UseFilesApi = FilesContextValue;

export function useFiles(): UseFilesApi {
  return useFilesContext();
}
