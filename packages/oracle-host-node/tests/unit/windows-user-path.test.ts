/**
 * Windows user-PATH refresh laws — `reg query` output parses to the
 * raw value (REG_SZ and REG_EXPAND_SZ, absent value reads null),
 * `%VAR%` references expand case-insensitively with unknown refs left
 * literal, and merging appends only registry entries the process PATH
 * doesn't already carry (case-insensitive, trailing-slash tolerant).
 */

import { describe, expect, it } from 'vitest';
import {
  expandEnvRefs,
  mergeWindowsPath,
  parseRegQueryPath,
  refreshedWindowsPath,
} from '../../src/host-runtime/windows-user-path';

const REG_OUTPUT = [
  '',
  'HKEY_CURRENT_USER\\Environment',
  '    Path    REG_EXPAND_SZ    %USERPROFILE%\\bin;C:\\Users\\dev\\AppData\\Local\\OpenHeaders\\bin',
  '',
].join('\r\n');

describe('parseRegQueryPath', () => {
  it('pulls the value out of reg query output', () => {
    expect(parseRegQueryPath(REG_OUTPUT)).toBe('%USERPROFILE%\\bin;C:\\Users\\dev\\AppData\\Local\\OpenHeaders\\bin');
  });

  it('accepts plain REG_SZ and any value-name casing', () => {
    expect(parseRegQueryPath('    PATH    REG_SZ    C:\\tools')).toBe('C:\\tools');
  });

  it('reads null when no Path value is present', () => {
    expect(parseRegQueryPath('HKEY_CURRENT_USER\\Environment\r\n')).toBeNull();
  });
});

describe('expandEnvRefs', () => {
  it('expands %VAR% case-insensitively and leaves unknown refs literal', () => {
    const env = { UserProfile: 'C:\\Users\\dev' };
    expect(expandEnvRefs('%USERPROFILE%\\bin;%NOPE%\\x', env)).toBe('C:\\Users\\dev\\bin;%NOPE%\\x');
  });
});

describe('mergeWindowsPath', () => {
  it('appends only entries the process PATH lacks', () => {
    const merged = mergeWindowsPath('C:\\Windows;C:\\Windows\\System32', 'C:\\Windows;C:\\oh\\bin');
    expect(merged).toBe('C:\\Windows;C:\\Windows\\System32;C:\\oh\\bin');
  });

  it('compares case-insensitively and ignores trailing separators', () => {
    const merged = mergeWindowsPath('C:\\Tools\\', 'c:\\tools;C:\\extra');
    expect(merged).toBe('C:\\Tools\\;C:\\extra');
  });

  it('returns the process PATH untouched when the registry adds nothing', () => {
    expect(mergeWindowsPath('C:\\a;C:\\b', 'c:\\A')).toBe('C:\\a;C:\\b');
  });
});

describe('refreshedWindowsPath', () => {
  it('reads null off-Windows where reg.exe cannot run', async () => {
    if (process.platform === 'win32') return;
    expect(await refreshedWindowsPath({ PATH: '/usr/bin' })).toBeNull();
  });
});
