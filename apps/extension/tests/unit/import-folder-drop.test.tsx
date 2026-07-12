/**
 * Import hub folder-drop surface — the picker plumbing that unlocks
 * Bruno collection-folder imports:
 *   • `pickedFromInput` maps a `webkitdirectory` FileList onto
 *     path+file pairs via `webkitRelativePath`.
 *   • `pickedFromEntries` walks dropped directory entries — batched
 *     `readEntries` drained to the empty batch, dot/node_modules
 *     directories skipped below the picked root only.
 *   • `ImportSourceModal` exposes the folder input (webkitdirectory
 *     attribute) + "Browse folder…" button and hands picked files to
 *     `onFolderChosen`.
 */

import ImportSourceModal from '@openheaders/ui/workbench/components/workspace-export/ImportSourceModal';
import { pickedFromEntries, pickedFromInput } from '@openheaders/ui/workbench/components/workspace-export/picked-files';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The paste TextArea autosizes via rc-resize-observer; jsdom doesn't
// ship a ResizeObserver.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

// ── Entry mocks ─────────────────────────────────────────────────────

function fileWithRelativePath(relativePath: string, content = 'x'): File {
  const name = relativePath.split('/').pop() ?? relativePath;
  const file = new File([content], name);
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

function fileEntry(fullPath: string): FileSystemFileEntry {
  const name = fullPath.split('/').pop() ?? '';
  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (cb: (f: File) => void) => cb(new File(['x'], name)),
  } as unknown as FileSystemFileEntry;
}

function dirEntry(fullPath: string, children: FileSystemEntry[], batchSize = 2): FileSystemDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    name: fullPath.split('/').pop() ?? '',
    fullPath,
    createReader: () => {
      let offset = 0;
      return {
        readEntries: (cb: (entries: FileSystemEntry[]) => void) => {
          const batch = children.slice(offset, offset + batchSize);
          offset += batch.length;
          cb(batch);
        },
      };
    },
  } as unknown as FileSystemDirectoryEntry;
}

// ── pickedFromInput ─────────────────────────────────────────────────

describe('pickedFromInput', () => {
  it('maps webkitRelativePath onto path+file pairs', () => {
    const files = [
      fileWithRelativePath('coll/bruno.json'),
      fileWithRelativePath('coll/auth/login.bru'),
    ] as unknown as FileList;
    expect(pickedFromInput(files).map((p) => p.path)).toEqual(['coll/bruno.json', 'coll/auth/login.bru']);
  });

  it('returns empty for a null FileList', () => {
    expect(pickedFromInput(null)).toEqual([]);
  });
});

// ── pickedFromEntries ───────────────────────────────────────────────

describe('pickedFromEntries', () => {
  it('walks nested directories across readEntries batches', async () => {
    const root = dirEntry('/coll', [
      fileEntry('/coll/bruno.json'),
      fileEntry('/coll/ping.bru'),
      dirEntry('/coll/auth', [fileEntry('/coll/auth/login.bru'), fileEntry('/coll/auth/logout.bru')], 1),
      fileEntry('/coll/readme.md'),
    ]);
    const picked = await pickedFromEntries([root, null]);
    expect(picked.map((p) => p.path)).toEqual([
      'coll/bruno.json',
      'coll/ping.bru',
      'coll/auth/login.bru',
      'coll/auth/logout.bru',
      'coll/readme.md',
    ]);
  });

  it('skips dot and node_modules directories below the picked root only', async () => {
    const root = dirEntry('/.coll', [
      fileEntry('/.coll/ping.bru'),
      dirEntry('/.coll/.git', [fileEntry('/.coll/.git/config.bru')]),
      dirEntry('/.coll/node_modules', [fileEntry('/.coll/node_modules/x.bru')]),
    ]);
    const picked = await pickedFromEntries([root]);
    expect(picked.map((p) => p.path)).toEqual(['.coll/ping.bru']);
  });
});

// ── Modal surface ───────────────────────────────────────────────────

describe('ImportSourceModal folder picker', () => {
  function renderModal(onFolderChosen: (files: unknown) => void) {
    return render(
      <ImportSourceModal
        open
        onCancel={() => undefined}
        onTextDetected={() => undefined}
        onFileChosen={() => undefined}
        onFolderChosen={onFolderChosen}
      />,
    );
  }

  it('renders a webkitdirectory input and a Browse folder button', () => {
    const { baseElement, getByRole } = renderModal(() => undefined);
    expect(baseElement.querySelector('input[webkitdirectory]')).not.toBeNull();
    expect(getByRole('button', { name: /browse folder/i })).toBeTruthy();
  });

  it('hands a picked folder to onFolderChosen with relative paths', async () => {
    const onFolderChosen = vi.fn();
    const { baseElement } = renderModal(onFolderChosen);
    const input = baseElement.querySelector('input[webkitdirectory]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [fileWithRelativePath('coll/ping.bru'), fileWithRelativePath('coll/bruno.json')] },
    });
    await waitFor(() => expect(onFolderChosen).toHaveBeenCalledTimes(1));
    const picked = onFolderChosen.mock.calls[0][0] as Array<{ path: string }>;
    expect(picked.map((p) => p.path)).toEqual(['coll/ping.bru', 'coll/bruno.json']);
  });
});
