/**
 * HTTP/3 helper bootstrap — candidate path derivation: the packaged
 * `resources/h3-helper` copy, the dev tree's staged matrix target
 * ahead of the crate's plain release build, and the platform-suffixed
 * binary name.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { h3HelperBinaryCandidates } from '../../../src/main/h3-helper-install';

describe('h3HelperBinaryCandidates', () => {
  it('resolves only the packaged resources copy when packaged', () => {
    const candidates = h3HelperBinaryCandidates({
      isPackaged: true,
      resourcesPath: '/Applications/OpenHeaders.app/Contents/Resources',
      appPath: '/Applications/OpenHeaders.app/Contents/Resources/app.asar',
      platform: 'darwin',
      arch: 'arm64',
    });
    expect(candidates).toEqual([
      path.join('/Applications/OpenHeaders.app/Contents/Resources', 'h3-helper', 'oh-h3-helper'),
    ]);
  });

  it('prefers the staged matrix target over the plain release build in dev', () => {
    const candidates = h3HelperBinaryCandidates({
      isPackaged: false,
      resourcesPath: '/somewhere/electron/resources',
      appPath: '/repo/apps/desktop',
      platform: 'darwin',
      arch: 'arm64',
    });
    expect(candidates).toEqual([
      path.resolve('/repo/native/h3-helper/dist/mac-arm64/oh-h3-helper'),
      path.resolve('/repo/native/h3-helper/target/release/oh-h3-helper'),
    ]);
  });

  it('falls back to the release build alone off the matrix', () => {
    const candidates = h3HelperBinaryCandidates({
      isPackaged: false,
      resourcesPath: '/somewhere/electron/resources',
      appPath: '/repo/apps/desktop',
      platform: 'linux',
      arch: 'ia32',
    });
    expect(candidates).toEqual([path.resolve('/repo/native/h3-helper/target/release/oh-h3-helper')]);
  });

  it('appends the .exe suffix on win32', () => {
    const candidates = h3HelperBinaryCandidates({
      isPackaged: true,
      resourcesPath: 'C:\\Program Files\\OpenHeaders\\resources',
      appPath: 'C:\\Program Files\\OpenHeaders\\resources\\app.asar',
      platform: 'win32',
      arch: 'x64',
    });
    expect(candidates).toEqual([
      path.join('C:\\Program Files\\OpenHeaders\\resources', 'h3-helper', 'oh-h3-helper.exe'),
    ]);
  });
});
