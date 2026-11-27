/**
 * The Windows package takes in the data a move from the classic app
 * handed over: once, by one rename, only on the classic app's request
 * and only when the classic install is gone. The folders are real ones
 * under a temporary root; what Windows answers (is the classic install
 * still registered, a refused rename) is injected, so every rule runs on
 * every platform.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_UNINSTALL_REGISTRY_KEY,
  type DataFolderMoveFacts,
  FINISH_MOVE_EXIT,
  FINISH_MOVE_SWITCH,
  MOVE_REQUEST_FILE_NAME,
  moveDataFolderToPackage,
} from '@/main/bootstrap/data-folder-move';
import type { InstallKind } from '@/main/bootstrap/install-kind';

describe('the data folder taken in by the Windows package', () => {
  let root: string;
  let ownDir: string;
  let classicDir: string;

  const classicGone = vi.fn<() => boolean | null>();
  const sleep = vi.fn<(ms: number) => void>();

  function makeFacts(overrides: Partial<DataFolderMoveFacts> = {}): DataFolderMoveFacts {
    return { installKind: 'msix', ownDir, classicDir, awaitClassicUninstall: false, ...overrides };
  }

  function seedClassicData(request: string | null = '{"requestedBy":"2026.11.3"}'): void {
    mkdirSync(join(classicDir, 'data'), { recursive: true });
    writeFileSync(join(classicDir, 'data', 'settings.json'), '{"owner":"John Doe"}');
    if (request !== null) writeFileSync(join(classicDir, MOVE_REQUEST_FILE_NAME), request);
  }

  function fileError(code: string): Error {
    return Object.assign(new Error(code), { code });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-data-move-'));
    ownDir = join(root, 'Local', 'OpenHeaders-Data');
    classicDir = join(root, 'Roaming', 'OpenHeaders');
    mkdirSync(join(root, 'Local'), { recursive: true });
    mkdirSync(join(root, 'Roaming'), { recursive: true });
    classicGone.mockReset().mockReturnValue(false);
    sleep.mockReset();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('renames the classic folder into its own when the request is there and the classic install is gone', () => {
    seedClassicData();
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, sleep });
    expect(result).toEqual({ outcome: 'moved', from: classicDir, sharedFilesLeft: [] });
    expect(readFileSync(join(ownDir, 'data', 'settings.json'), 'utf8')).toBe('{"owner":"John Doe"}');
    expect(existsSync(classicDir)).toBe(false);
    expect(existsSync(join(ownDir, MOVE_REQUEST_FILE_NAME))).toBe(false);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('puts the files of oh and the hosts back under the classic name, where they are read', () => {
    seedClassicData();
    writeFileSync(join(classicDir, 'cli.json'), '{"token":"t"}');
    writeFileSync(join(classicDir, 'telemetry-outbox.json'), '{}');
    writeFileSync(join(classicDir, 'desktop-traffic-seal.key'), 'key');
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, sleep });
    expect(result).toEqual({ outcome: 'moved', from: classicDir, sharedFilesLeft: [] });
    expect(readdirSync(classicDir).sort()).toEqual(['cli.json', 'desktop-traffic-seal.key', 'telemetry-outbox.json']);
    expect(readFileSync(join(classicDir, 'cli.json'), 'utf8')).toBe('{"token":"t"}');
    expect(readdirSync(ownDir)).toEqual(['data']);
  });

  it('makes no classic folder again when the data brought no file of theirs', () => {
    seedClassicData();
    writeFileSync(join(classicDir, 'window-state.json'), '{}');
    moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, sleep });
    expect(existsSync(classicDir)).toBe(false);
    expect(readdirSync(ownDir).sort()).toEqual(['data', 'window-state.json']);
  });

  it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])('does nothing in an install of kind %s', (installKind) => {
    seedClassicData();
    const rename = vi.fn();
    const result = moveDataFolderToPackage(makeFacts({ installKind }), { isClassicInstalled: classicGone, rename });
    expect(result).toEqual({ outcome: 'nothing-to-move' });
    expect(classicGone).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('never touches a folder that carries no request: an install it knows nothing of may be using it', () => {
    seedClassicData(null);
    const rename = vi.fn();
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename });
    expect(result).toEqual({ outcome: 'nothing-to-move' });
    expect(classicGone).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('never touches either folder once its own exists, even empty', () => {
    seedClassicData();
    mkdirSync(ownDir);
    const rename = vi.fn();
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename });
    expect(result).toEqual({ outcome: 'nothing-to-move' });
    expect(rename).not.toHaveBeenCalled();
    expect(existsSync(join(classicDir, 'data', 'settings.json'))).toBe(true);
  });

  it('does nothing when no classic folder was left', () => {
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone });
    expect(result).toEqual({ outcome: 'nothing-to-move' });
    expect(existsSync(ownDir)).toBe(false);
  });

  it('does not follow a link standing where the classic folder would be', () => {
    const elsewhere = join(root, 'Elsewhere');
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, MOVE_REQUEST_FILE_NAME), '{}');
    symlinkSync(elsewhere, classicDir, 'junction');
    const rename = vi.fn();
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename });
    expect(result).toEqual({ outcome: 'nothing-to-move' });
    expect(rename).not.toHaveBeenCalled();
  });

  it("takes a request it cannot parse for a request: the file is the classic app's word", () => {
    seedClassicData('not json');
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone });
    expect(result.outcome).toBe('moved');
  });

  it.each<[string, boolean | null]>([
    ['is still registered', true],
    ['cannot be asked about', null],
  ])('leaves the data on a plain start while the classic install %s, asking once', (_case, answer) => {
    seedClassicData();
    const rename = vi.fn();
    const isClassicInstalled = vi.fn(() => answer);
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled, rename, sleep });
    expect(result).toEqual({ outcome: 'classic-still-installed', from: classicDir });
    expect(isClassicInstalled).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('waits for the classic uninstaller when asked to finish a move, then renames', () => {
    seedClassicData();
    const isClassicInstalled = vi
      .fn<() => boolean | null>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    const result = moveDataFolderToPackage(makeFacts({ awaitClassicUninstall: true }), { isClassicInstalled, sleep });
    expect(result).toEqual({ outcome: 'moved', from: classicDir, sharedFilesLeft: [] });
    expect(isClassicInstalled).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('stops waiting after a minute and leaves everything as it is', () => {
    seedClassicData();
    const rename = vi.fn();
    const isClassicInstalled = vi.fn(() => true);
    const result = moveDataFolderToPackage(makeFacts({ awaitClassicUninstall: true }), {
      isClassicInstalled,
      rename,
      sleep,
    });
    expect(result).toEqual({ outcome: 'classic-still-installed', from: classicDir });
    expect(sleep.mock.calls.length * 500).toBeLessThanOrEqual(60_000);
    expect(sleep.mock.calls.length * 500).toBeGreaterThanOrEqual(59_000);
    expect(rename).not.toHaveBeenCalled();
    expect(existsSync(join(classicDir, MOVE_REQUEST_FILE_NAME))).toBe(true);
  });

  it.each(['EPERM', 'EBUSY', 'EACCES'])('waits out a file held inside the folder (%s), then renames', (code) => {
    seedClassicData();
    let refusals = 3;
    const rename = vi.fn((from: string, to: string) => {
      if (refusals-- > 0) throw fileError(code);
      mkdirSync(to);
      rmSync(from, { recursive: true });
    });
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename, sleep });
    expect(result).toEqual({ outcome: 'moved', from: classicDir, sharedFilesLeft: [] });
    expect(rename).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('gives up on a held file after fifteen seconds, keeping the request for the next start', () => {
    seedClassicData();
    const rename = vi.fn(() => {
      throw fileError('EBUSY');
    });
    const result = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename, sleep });
    expect(result).toEqual({ outcome: 'held', from: classicDir, code: 'EBUSY' });
    expect(sleep.mock.calls.length * 500).toBeLessThanOrEqual(15_000);
    expect(sleep.mock.calls.length * 500).toBeGreaterThanOrEqual(14_000);
    expect(readFileSync(join(classicDir, MOVE_REQUEST_FILE_NAME), 'utf8')).toBe('{"requestedBy":"2026.11.3"}');
    expect(existsSync(ownDir)).toBe(false);
  });

  it('writes a refusal that cannot pass into the request, and never tries again', () => {
    seedClassicData();
    const rename = vi.fn(() => {
      throw fileError('EXDEV');
    });
    const first = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename, sleep });
    expect(first).toEqual({ outcome: 'ineligible', from: classicDir, code: 'EXDEV' });
    expect(rename).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(join(classicDir, MOVE_REQUEST_FILE_NAME), 'utf8'))).toEqual({
      verdict: 'ineligible',
      code: 'EXDEV',
    });
    expect(existsSync(join(classicDir, 'data', 'settings.json'))).toBe(true);

    const second = moveDataFolderToPackage(makeFacts(), { isClassicInstalled: classicGone, rename, sleep });
    expect(second).toEqual({ outcome: 'nothing-to-move' });
    expect(rename).toHaveBeenCalledOnce();
  });

  it('keeps its permanent names', () => {
    expect(FINISH_MOVE_SWITCH).toBe('--finish-move-to-package');
    expect(MOVE_REQUEST_FILE_NAME).toBe('move-to-package.json');
    expect(FINISH_MOVE_EXIT).toEqual({ classicStillInstalled: 6, dataHeld: 7 });
  });

  it("names the classic installer's entry as its builder does: from the app's id", () => {
    const manifest: { build: { appId: string } } = JSON.parse(
      readFileSync(join(__dirname, '../../../../package.json'), 'utf8'),
    );
    // A name-based identifier (version 5) under the builder's own namespace.
    const digest = createHash('sha1')
      .update(Buffer.from('50e065bc313411e69bab38c9862bdaf3', 'hex'))
      .update(manifest.build.appId)
      .digest();
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    const hex = digest.subarray(0, 16).toString('hex');
    const entryName = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join(
      '-',
    );
    expect(CLASSIC_UNINSTALL_REGISTRY_KEY).toBe(
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${entryName}`,
    );
  });
});
