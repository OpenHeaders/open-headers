/**
 * Console level-filter model — the browser's "Default levels" menu label
 * ladder and the wire-level mapping of the four level switches.
 */

import {
  ALL_LEVELS,
  DEFAULT_LEVELS,
  isCustomLevels,
  levelMenuLabel,
  passesLevelMask,
} from '@openheaders/ui/panel/data/console-levels';
import { describe, expect, it } from 'vitest';

describe('levelMenuLabel', () => {
  it('collapses the mask the way the browser does', () => {
    expect(levelMenuLabel(ALL_LEVELS)).toBe('All levels');
    expect(levelMenuLabel(DEFAULT_LEVELS)).toBe('Default levels');
    expect(levelMenuLabel({ verbose: false, info: false, warnings: false, errors: true })).toBe('Errors only');
    expect(levelMenuLabel({ verbose: true, info: false, warnings: false, errors: false })).toBe('Verbose only');
    expect(levelMenuLabel({ verbose: false, info: true, warnings: false, errors: true })).toBe('Custom levels');
    expect(levelMenuLabel({ verbose: false, info: false, warnings: false, errors: false })).toBe('Hide all');
  });

  it('warns exactly when the mask is neither all nor default', () => {
    expect(isCustomLevels(ALL_LEVELS)).toBe(false);
    expect(isCustomLevels(DEFAULT_LEVELS)).toBe(false);
    expect(isCustomLevels({ verbose: false, info: false, warnings: true, errors: true })).toBe(true);
    expect(isCustomLevels({ verbose: false, info: false, warnings: false, errors: false })).toBe(true);
  });
});

describe('passesLevelMask', () => {
  it('maps wire levels onto the four switches: Verbose⇐debug, Info⇐log+info', () => {
    const onlyVerbose = { verbose: true, info: false, warnings: false, errors: false };
    expect(passesLevelMask('debug', onlyVerbose)).toBe(true);
    expect(passesLevelMask('log', onlyVerbose)).toBe(false);

    const onlyInfo = { verbose: false, info: true, warnings: false, errors: false };
    expect(passesLevelMask('log', onlyInfo)).toBe(true);
    expect(passesLevelMask('info', onlyInfo)).toBe(true);
    expect(passesLevelMask('warning', onlyInfo)).toBe(false);

    expect(passesLevelMask('warning', DEFAULT_LEVELS)).toBe(true);
    expect(passesLevelMask('error', DEFAULT_LEVELS)).toBe(true);
    expect(passesLevelMask('debug', DEFAULT_LEVELS)).toBe(false);
  });
});
