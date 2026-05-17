/**
 * Phase C M5 — pins the SW backup-writer installer.
 *
 *   - install registers a writer on the host-neutral registry
 *   - installed writer routes through `chrome.downloads.download` with
 *     the right filename + JSON body
 *   - install is idempotent (second call doesn't double-register)
 *   - writer rejects when chrome.runtime.lastError is populated
 */

import type { DiscardBackupArchive } from '@openheaders/core/sync';
import { getBackupWriter, setBackupWriter } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface DownloadOptions {
  url: string;
  filename: string;
  saveAs?: boolean;
  conflictAction?: string;
}

type DownloadCallback = (downloadId?: number) => void;

const downloadMock = vi.fn<(opts: DownloadOptions, cb: DownloadCallback) => void>();
let lastErrorValue: { message?: string } | undefined;

vi.stubGlobal('chrome', {
  downloads: {
    download: (opts: DownloadOptions, cb: DownloadCallback) => downloadMock(opts, cb),
  },
  runtime: {
    get lastError() {
      return lastErrorValue;
    },
  },
});

import {
  __resetBackupWriterForTests,
  installBackupWriter,
} from '../../src/background/install-backup-writer';

function archive(generatedAt: string): DiscardBackupArchive {
  return {
    schemaVersion: 1,
    generatedAt,
    workspaces: [],
  };
}

function decodeDataUrl(url: string): unknown {
  const match = url.match(/^data:application\/json;base64,(.+)$/);
  if (!match) throw new Error(`unexpected data url: ${url}`);
  const json = decodeURIComponent(escape(atob(match[1])));
  return JSON.parse(json);
}

beforeEach(() => {
  downloadMock.mockReset();
  lastErrorValue = undefined;
  __resetBackupWriterForTests();
});

afterEach(() => {
  setBackupWriter(null);
});

describe('installBackupWriter', () => {
  it('registers a writer on the host-neutral registry', () => {
    expect(getBackupWriter()).toBeNull();
    installBackupWriter();
    expect(getBackupWriter()).not.toBeNull();
  });

  it('is idempotent — calling twice does not double-register', () => {
    installBackupWriter();
    const first = getBackupWriter();
    installBackupWriter();
    expect(getBackupWriter()).toBe(first);
  });

  it('routes the archive through chrome.downloads with a timestamped filename + JSON body', async () => {
    installBackupWriter();
    const write = getBackupWriter();
    if (!write) throw new Error('writer not installed');

    downloadMock.mockImplementationOnce((_opts, cb) => {
      cb(42);
    });

    const result = await write(archive('2026-05-17T12:00:00.000Z'));
    expect(downloadMock).toHaveBeenCalledTimes(1);
    const opts = downloadMock.mock.calls[0][0];
    // Colons + dots in ISO timestamps aren't safe in filenames — must be normalized.
    expect(opts.filename).toBe('oh-backup-2026-05-17T12-00-00-000Z.json');
    expect(opts.saveAs).toBe(false);
    expect(opts.conflictAction).toBe('uniquify');
    expect(decodeDataUrl(opts.url)).toEqual({
      schemaVersion: 1,
      generatedAt: '2026-05-17T12:00:00.000Z',
      workspaces: [],
    });
    expect(result.backupPath).toBe('oh-backup-2026-05-17T12-00-00-000Z.json');
  });

  it('rejects when chrome.runtime.lastError is populated by the download callback', async () => {
    installBackupWriter();
    const write = getBackupWriter();
    if (!write) throw new Error('writer not installed');

    downloadMock.mockImplementationOnce((_opts, cb) => {
      lastErrorValue = { message: 'USER_CANCELED' };
      cb(undefined);
    });

    await expect(write(archive('2026-05-17T12:00:00.000Z'))).rejects.toThrow('USER_CANCELED');
  });
});
