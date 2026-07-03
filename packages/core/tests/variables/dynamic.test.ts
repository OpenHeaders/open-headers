/**
 * Dynamic generators — `{{dynamic.*}}` catalog.
 *
 * All generators run against an injected runtime so outputs are pinned
 * deterministically; the default runtime is exercised only for shape.
 */

import {
  DYNAMIC_GENERATORS,
  defaultDynamicRuntime,
  type DynamicRuntime,
  resolveDynamicValue,
} from '@openheaders/core/variables';
import { describe, expect, it } from 'vitest';

function fixedRuntime(overrides: Partial<DynamicRuntime> = {}): DynamicRuntime {
  return {
    now: () => 1751500000123,
    random: () => 0.5,
    uuid: () => 'd9eef54b-1c2a-4e3f-8a1b-0123456789ab',
    ...overrides,
  };
}

describe('resolveDynamicValue', () => {
  it('timestamp is unix seconds from the injected clock', () => {
    expect(resolveDynamicValue('timestamp', fixedRuntime())).toBe('1751500000');
  });

  it('isoTimestamp is ISO 8601 UTC from the injected clock', () => {
    expect(resolveDynamicValue('isoTimestamp', fixedRuntime())).toBe('2025-07-02T23:46:40.123Z');
  });

  it('uuid comes from the injected uuid source', () => {
    expect(resolveDynamicValue('uuid', fixedRuntime())).toBe('d9eef54b-1c2a-4e3f-8a1b-0123456789ab');
  });

  it('randomInt spans 0..1000 inclusive', () => {
    expect(resolveDynamicValue('randomInt', fixedRuntime({ random: () => 0 }))).toBe('0');
    expect(resolveDynamicValue('randomInt', fixedRuntime({ random: () => 0.9999999 }))).toBe('1000');
  });

  it('randomAlphaNumeric is a single alphanumeric character', () => {
    const value = resolveDynamicValue('randomAlphaNumeric', fixedRuntime());
    expect(value).toMatch(/^[a-zA-Z0-9]$/);
  });

  it('randomBoolean maps the RNG halves to "true"/"false"', () => {
    expect(resolveDynamicValue('randomBoolean', fixedRuntime({ random: () => 0.2 }))).toBe('true');
    expect(resolveDynamicValue('randomBoolean', fixedRuntime({ random: () => 0.8 }))).toBe('false');
  });

  it('randomColor is a #rrggbb hex color, zero-padded', () => {
    expect(resolveDynamicValue('randomColor', fixedRuntime({ random: () => 0 }))).toBe('#000000');
    expect(resolveDynamicValue('randomColor', fixedRuntime())).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('randomEmail is a lowercase alphanumeric local part at example.com', () => {
    expect(resolveDynamicValue('randomEmail', fixedRuntime())).toMatch(/^[a-z0-9]{10}@example\.com$/);
  });

  it('randomIP is a dotted quad with non-zero first and last octets', () => {
    const ip = resolveDynamicValue('randomIP', fixedRuntime({ random: () => 0 }));
    expect(ip).toBe('1.0.0.1');
    expect(resolveDynamicValue('randomIP', fixedRuntime())).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
  });

  it('unknown generator name returns null', () => {
    expect(resolveDynamicValue('notAGenerator', fixedRuntime())).toBeNull();
  });

  it('default runtime produces sane shapes for every generator', () => {
    for (const g of DYNAMIC_GENERATORS) {
      const value = resolveDynamicValue(g.name, defaultDynamicRuntime);
      expect(value, g.name).toBeTypeOf('string');
      expect(value!.length, g.name).toBeGreaterThan(0);
    }
  });

  it('catalog names are unique', () => {
    const names = DYNAMIC_GENERATORS.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
