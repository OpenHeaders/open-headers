/**
 * The files `oh` and the hosts keep under the classic data folder's name:
 * told from the app's own by the shared list, and moved a file at a time.
 * The folders are real ones under a temporary root.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_DIR_FILE_NAMES } from '@openheaders/core/cli-config';
import { TRAFFIC_SEAL_KEY_FILE_DAEMON, TRAFFIC_SEAL_KEY_FILE_DESKTOP } from '@openheaders/oracle-host-node/traffic';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveSharedConfigFiles, readSharedConfigFiles } from '@/main/bootstrap/shared-config-files';

describe('the shared files under the classic data folder’s name', () => {
  let root: string;
  let dir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-shared-config-'));
    dir = join(root, 'OpenHeaders');
    mkdirSync(dir);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('names the shared files a folder holds, as they are spelled there', () => {
    writeFileSync(join(dir, 'CLI.json'), '{}');
    writeFileSync(join(dir, 'telemetry-outbox.json'), '{}');
    const shared = readSharedConfigFiles(dir);
    expect(shared?.names.slice().sort()).toEqual(['CLI.json', 'telemetry-outbox.json']);
    expect(shared?.alone).toBe(true);
  });

  it.each([
    ["a file of the app's", (): void => writeFileSync(join(dir, 'window-state.json'), '{}')],
    ["a folder of the app's", (): void => mkdirSync(join(dir, 'logs'))],
    ['a folder under a shared name', (): void => mkdirSync(join(dir, 'update-check.json'))],
  ])('says the shared files are not alone beside %s', (_case, add) => {
    writeFileSync(join(dir, 'cli.json'), '{}');
    add();
    expect(readSharedConfigFiles(dir)).toEqual({ names: ['cli.json'], alone: false });
  });

  it('reads an empty folder as holding none, alone', () => {
    expect(readSharedConfigFiles(dir)).toEqual({ names: [], alone: true });
  });

  it('says nothing of a folder it cannot list', () => {
    expect(readSharedConfigFiles(join(root, 'missing'))).toBeNull();
  });

  it('moves the named files, making the folder they go to', () => {
    writeFileSync(join(dir, 'cli.json'), '{"token":"t"}');
    writeFileSync(join(dir, 'window-state.json'), '{}');
    const target = join(root, 'Elsewhere', 'OpenHeaders');
    expect(moveSharedConfigFiles(dir, target, ['cli.json'])).toEqual([]);
    expect(readFileSync(join(target, 'cli.json'), 'utf8')).toBe('{"token":"t"}');
    expect(readdirSync(dir)).toEqual(['window-state.json']);
  });

  it('names a file that stayed, and makes no folder for nothing', () => {
    const target = join(root, 'Elsewhere');
    expect(moveSharedConfigFiles(dir, target, [])).toEqual([]);
    expect(existsSync(target)).toBe(false);
    expect(moveSharedConfigFiles(dir, target, ['cli.json'])).toEqual(['cli.json']);
  });

  it("lists the hosts' raw seal key files among the shared ones", () => {
    expect(CONFIG_DIR_FILE_NAMES).toContain(TRAFFIC_SEAL_KEY_FILE_DESKTOP);
    expect(CONFIG_DIR_FILE_NAMES).toContain(TRAFFIC_SEAL_KEY_FILE_DAEMON);
  });
});
