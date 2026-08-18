/**
 * App Paths registry parsing for the named-browser open — the
 * `reg query <key> /ve` default-value reader behind
 * `oh:open-in-browser`'s Windows resolution.
 */

import { describe, expect, it } from 'vitest';
import { parseAppPathsDefault } from '@/main/bootstrap/external-links';

const CHROME_QUERY = [
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
  '    (Default)    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '',
].join('\r\n');

describe('parseAppPathsDefault', () => {
  it('reads a REG_SZ default value', () => {
    expect(parseAppPathsDefault(CHROME_QUERY, {})).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  });

  it('strips surrounding quotes', () => {
    const text = '    (Default)    REG_SZ    "C:\\Program Files\\Mozilla Firefox\\firefox.exe"';
    expect(parseAppPathsDefault(text, {})).toBe('C:\\Program Files\\Mozilla Firefox\\firefox.exe');
  });

  it('expands environment references in REG_EXPAND_SZ values', () => {
    const text = '    (Default)    REG_EXPAND_SZ    %ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe';
    expect(parseAppPathsDefault(text, { ProgramFiles: 'C:\\Program Files' })).toBe(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    );
  });

  it('leaves unknown environment references literal', () => {
    const text = '    (Default)    REG_EXPAND_SZ    %OH_UNSET%\\chrome.exe';
    expect(parseAppPathsDefault(text, {})).toBe('%OH_UNSET%\\chrome.exe');
  });

  it('matches on the type token, not the localized "(Default)" label', () => {
    const text = '    (Standard)    REG_SZ    C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
    expect(parseAppPathsDefault(text, {})).toBe('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe');
  });

  it('answers undefined for empty or valueless output', () => {
    expect(parseAppPathsDefault('', {})).toBeUndefined();
    expect(parseAppPathsDefault('HKEY_CURRENT_USER\\Software\\...\\App Paths\\chrome.exe', {})).toBeUndefined();
  });
});
