/**
 * Binary resolution — env-override precedence (set-but-missing never
 * falls through), the host-registered packaged locator, and the
 * matrix naming helpers the staging pipeline keys builds by.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  h3HelperBinaryName,
  h3HelperTargetName,
  registerH3HelperLocator,
  resolveH3HelperBinary,
} from '../../../src/live/h3-helper/helper-binary';

describe('resolveH3HelperBinary', () => {
  let dir: string;
  let realBinary: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'oh-h3-helper-binary-'));
    realBinary = path.join(dir, 'oh-h3-helper');
    writeFileSync(realBinary, '#!/bin/sh\n');
    vi.stubEnv('OPENHEADERS_H3_HELPER', '');
  });

  afterEach(() => {
    registerH3HelperLocator(null);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null with no override and no locator', () => {
    expect(resolveH3HelperBinary()).toBeNull();
  });

  it('prefers an existing env override over the packaged locator', () => {
    vi.stubEnv('OPENHEADERS_H3_HELPER', realBinary);
    registerH3HelperLocator(() => path.join(dir, 'packaged-should-not-win'));
    expect(resolveH3HelperBinary()).toBe(realBinary);
  });

  it('a set-but-missing override never falls through to the packaged copy', () => {
    vi.stubEnv('OPENHEADERS_H3_HELPER', path.join(dir, 'missing'));
    registerH3HelperLocator(() => realBinary);
    expect(resolveH3HelperBinary()).toBeNull();
  });

  it('resolves the registered locator when its binary exists', () => {
    registerH3HelperLocator(() => realBinary);
    expect(resolveH3HelperBinary()).toBe(realBinary);
  });

  it('a locator pointing at a missing file resolves null', () => {
    registerH3HelperLocator(() => path.join(dir, 'missing'));
    expect(resolveH3HelperBinary()).toBeNull();
  });

  it('a locator returning null resolves null', () => {
    registerH3HelperLocator(() => null);
    expect(resolveH3HelperBinary()).toBeNull();
  });

  it('a throwing locator degrades to null instead of surfacing', () => {
    registerH3HelperLocator(() => {
      throw new Error('payload unpack failed');
    });
    expect(resolveH3HelperBinary()).toBeNull();
  });

  it('unregistering restores the no-locator posture', () => {
    registerH3HelperLocator(() => realBinary);
    registerH3HelperLocator(null);
    expect(resolveH3HelperBinary()).toBeNull();
  });
});

describe('h3HelperBinaryName', () => {
  it('appends .exe on win32 only', () => {
    expect(h3HelperBinaryName('win32')).toBe('oh-h3-helper.exe');
    expect(h3HelperBinaryName('darwin')).toBe('oh-h3-helper');
    expect(h3HelperBinaryName('linux')).toBe('oh-h3-helper');
  });
});

describe('h3HelperTargetName', () => {
  it('names the five matrix targets', () => {
    expect(h3HelperTargetName('darwin', 'arm64')).toBe('mac-arm64');
    expect(h3HelperTargetName('darwin', 'x64')).toBe('mac-x64');
    expect(h3HelperTargetName('win32', 'x64')).toBe('win-x64');
    expect(h3HelperTargetName('linux', 'x64')).toBe('linux-x64');
    expect(h3HelperTargetName('linux', 'arm64')).toBe('linux-arm64');
  });

  it('returns null off the matrix', () => {
    expect(h3HelperTargetName('win32', 'arm64')).toBeNull();
    expect(h3HelperTargetName('freebsd', 'x64')).toBeNull();
    expect(h3HelperTargetName('linux', 'ia32')).toBeNull();
  });
});
