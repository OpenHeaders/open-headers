/** Content-addressed file-blob RPCs (Phase 12). */

import { deleteFile, getFileBlob, listFiles, putFile, renameFile } from '@openheaders/oracle/entity/files-store';
import type { HandlerMap } from '../types';

/**
 * Base64 helpers for file-blob transport. `chrome.runtime.sendMessage`
 * JSON-serializes its payload so ArrayBuffer / Blob are not directly
 * usable on the wire; encoding to base64 is the cross-browser-safe
 * bridge for the putFile / getFile RPCs. Chunked conversion below
 * avoids `btoa(String.fromCharCode(...bigArray))`'s stack overflow
 * on files larger than a few hundred KB.
 */
function base64ToBlob(b64: string, mimeType: string | undefined): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], mimeType ? { type: mimeType } : undefined);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // String.fromCharCode spread is bounded at ~65535 args in some engines;
    // the explicit CHUNK cap above keeps us safe.
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

const workspaceIdOf = (message: Record<string, unknown>): string | undefined =>
  typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;

export const fileHandlers: HandlerMap = {
  listFiles: ({ message, respond }) => {
    listFiles(workspaceIdOf(message))
      .then((files) => respond({ files }))
      .catch((err: Error) => respond({ files: [], error: err.message }));
    return true;
  },

  putFile: ({ message, respond }) => {
    const filename = message.filename as string;
    const mimeType = message.mimeType as string | undefined;
    const bytesBase64 = message.bytesBase64 as string;
    const blob = base64ToBlob(bytesBase64, mimeType);
    putFile({ blob, filename, mimeType, workspaceId: workspaceIdOf(message) })
      .then((fileRef) => respond({ success: true, fileRef }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  getFile: ({ message, respond }) => {
    const fileId = message.fileId as string;
    getFileBlob(fileId, workspaceIdOf(message))
      .then(async (blob) => {
        if (!blob) {
          respond({ found: false });
          return;
        }
        const bytesBase64 = await blobToBase64(blob);
        respond({ found: true, bytesBase64, mimeType: blob.type });
      })
      .catch((err: Error) => respond({ found: false, error: err.message } as unknown as { found: false }));
    return true;
  },

  deleteFile: ({ message, respond }) => {
    const fileId = message.fileId as string;
    deleteFile(fileId, workspaceIdOf(message))
      .then((removed) => respond({ success: true, removed }))
      .catch((err: Error) => respond({ success: false, removed: false, error: err.message }));
    return true;
  },

  renameFile: ({ message, respond }) => {
    const fileId = message.fileId as string;
    const filename = message.filename as string;
    const mimeType = message.mimeType as string | undefined;
    renameFile({ fileId, filename, mimeType, workspaceId: workspaceIdOf(message) })
      .then((fileRef) => respond(fileRef ? { success: true, found: true, fileRef } : { success: true, found: false }))
      .catch((err: Error) => respond({ success: false, found: false, error: err.message }));
    return true;
  },
};
