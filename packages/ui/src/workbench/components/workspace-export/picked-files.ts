/**
 * Folder-picker plumbing for the import hub — turns the two ways a
 * user hands over a directory (a `webkitdirectory` input, a drag of a
 * folder onto the drop zone) into one `PickedFile[]` shape the host
 * routes into the Bruno folder import. Only collects file handles;
 * nothing is read until the host filters to importable paths.
 */

export interface PickedFile {
  path: string;
  file: File;
}

/** Directory names never descended into below the picked root. */
const SKIP_DIRS = new Set(['node_modules']);

/** Runaway guard for a drag of an unexpectedly huge tree. */
const MAX_FILES = 5000;

/** Files from a `webkitdirectory` input — paths from `webkitRelativePath`. */
export function pickedFromInput(files: FileList | null): PickedFile[] {
  if (!files) return [];
  return Array.from(files)
    .slice(0, MAX_FILES)
    .map((file) => ({ path: file.webkitRelativePath || file.name, file }));
}

function readEntriesBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, depth: number, out: PickedFile[]): Promise<void> {
  if (out.length >= MAX_FILES) return;
  if (entry.isFile) {
    try {
      const file = await entryFile(entry as FileSystemFileEntry);
      out.push({ path: entry.fullPath.replace(/^\/+/, ''), file });
    } catch {
      // Unreadable entry (perms, vanished mid-drag) — the host reports
      // read failures on the files it does open; a handle we can't
      // even obtain is skipped here.
    }
    return;
  }
  if (!entry.isDirectory) return;
  // The dropped root is the user's explicit choice — skip rules apply
  // only underneath it.
  if (depth > 0 && (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name))) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns batches (Chromium caps each at 100) — drain
  // until an empty batch marks the end.
  for (;;) {
    const batch = await readEntriesBatch(reader);
    if (batch.length === 0) return;
    for (const child of batch) await walkEntry(child, depth + 1, out);
  }
}

/**
 * Files from dropped `FileSystemEntry` roots (obtained synchronously
 * via `DataTransferItem.webkitGetAsEntry()` during the drop event).
 * Directories are walked depth-first; loose files ride along.
 */
export async function pickedFromEntries(entries: Array<FileSystemEntry | null>): Promise<PickedFile[]> {
  const out: PickedFile[] = [];
  for (const entry of entries) {
    if (entry) await walkEntry(entry, 0, out);
  }
  return out;
}
