import type { BrowserWindow, WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import {
  type DownloadFeedbackDeps,
  type DownloadItemLike,
  installDownloadFeedbackWith,
} from '@/main/bootstrap/downloads';

type DoneListener = (event: unknown, state: 'completed' | 'cancelled' | 'interrupted') => void;
type WillDownload = (event: unknown, item: DownloadItemLike, webContents: WebContents) => void;

function harness() {
  let willDownload: WillDownload | null = null;
  let reveal: ((event: unknown, path: unknown) => void) | null = null;
  const win = { id: 1 } as unknown as BrowserWindow;
  const deps: DownloadFeedbackDeps = {
    session: {
      on: (_event, listener) => {
        willDownload = listener;
      },
    },
    windowOf: () => win,
    send: vi.fn(),
    reveal: vi.fn(),
    handle: (_channel, listener) => {
      reveal = listener;
    },
  };
  installDownloadFeedbackWith(deps);
  const download = (filename: string, path: string, state: 'completed' | 'cancelled' | 'interrupted') => {
    let done: DoneListener | null = null;
    const item: DownloadItemLike = {
      getFilename: () => filename,
      getSavePath: () => path,
      once: (_event, listener) => {
        done = listener;
      },
    };
    (willDownload as WillDownload | null)?.({}, item, {} as WebContents);
    (done as DoneListener | null)?.({}, state);
  };
  return {
    deps,
    win,
    download,
    reveal: (path: unknown) => (reveal as ((e: unknown, p: unknown) => void) | null)?.({}, path),
  };
}

describe('download feedback', () => {
  it('tells the window where a completed download went, and warns on an interrupted one', () => {
    const h = harness();
    h.download('a.zip', '/Users/jane/Downloads/a.zip', 'completed');
    expect(h.deps.send).toHaveBeenCalledWith(h.win, 'downloadDone', {
      filename: 'a.zip',
      path: '/Users/jane/Downloads/a.zip',
      state: 'completed',
    });
    h.download('b.json', '/Users/jane/Downloads/b.json', 'interrupted');
    expect(h.deps.send).toHaveBeenLastCalledWith(h.win, 'downloadDone', {
      filename: 'b.json',
      path: '/Users/jane/Downloads/b.json',
      state: 'interrupted',
    });
  });

  it('sends nothing for a cancelled dialog', () => {
    const h = harness();
    h.download('a.zip', '', 'cancelled');
    expect(h.deps.send).not.toHaveBeenCalled();
  });

  it('reveals only a path it reported as completed', () => {
    const h = harness();
    h.download('a.zip', '/Users/jane/Downloads/a.zip', 'completed');
    h.download('b.json', '/Users/jane/Downloads/b.json', 'interrupted');
    h.reveal('/Users/jane/Downloads/a.zip');
    h.reveal('/Users/jane/Downloads/b.json');
    h.reveal('/etc/passwd');
    h.reveal(42);
    expect(h.deps.reveal).toHaveBeenCalledTimes(1);
    expect(h.deps.reveal).toHaveBeenCalledWith('/Users/jane/Downloads/a.zip');
  });
});
