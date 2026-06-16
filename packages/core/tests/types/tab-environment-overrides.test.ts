/**
 * `readTabEnvironmentOverrides` — the SW-side validator/normalizer for the
 * per-tab override bag carried over the `setTabOverrides` RPC. It must validate
 * the struct facets, drop an `emulatedMedia` struct that pins nothing, and
 * collapse an all-empty bag to `null` so a cleared-to-empty payload never pins
 * an empty override.
 */

import { describe, expect, it } from 'vitest';
import { readTabEnvironmentOverrides } from '../../src/types/cdp';

describe('readTabEnvironmentOverrides', () => {
  it('returns null for null / undefined / unparseable input', () => {
    expect(readTabEnvironmentOverrides(null)).toBeNull();
    expect(readTabEnvironmentOverrides(undefined)).toBeNull();
    expect(readTabEnvironmentOverrides({ userAgent: 42 })).toBeNull();
    expect(readTabEnvironmentOverrides({ emulatedMedia: { colorScheme: 'sepia' } })).toBeNull();
  });

  it('collapses an all-empty bag to null', () => {
    expect(readTabEnvironmentOverrides({})).toBeNull();
  });

  it('keeps the UA triple and the Emulation facets when pinned', () => {
    expect(
      readTabEnvironmentOverrides({
        userAgent: 'Test-Agent/1.0 (openheaders.io)',
        locale: 'fr-FR',
        timezoneId: 'Europe/Berlin',
        emulatedMedia: { colorScheme: 'dark' },
      }),
    ).toEqual({
      userAgent: 'Test-Agent/1.0 (openheaders.io)',
      locale: 'fr-FR',
      timezoneId: 'Europe/Berlin',
      emulatedMedia: { colorScheme: 'dark' },
    });
  });

  it('drops an emulatedMedia struct that pins nothing (print:false counts as empty)', () => {
    expect(readTabEnvironmentOverrides({ locale: 'fr-FR', emulatedMedia: {} })).toEqual({ locale: 'fr-FR' });
    expect(readTabEnvironmentOverrides({ locale: 'fr-FR', emulatedMedia: { print: false } })).toEqual({
      locale: 'fr-FR',
    });
  });

  it('collapses to null when the only facet is an empty media struct', () => {
    expect(readTabEnvironmentOverrides({ emulatedMedia: {} })).toBeNull();
    expect(readTabEnvironmentOverrides({ emulatedMedia: { print: false } })).toBeNull();
  });

  it('keeps a media struct that pins print only', () => {
    expect(readTabEnvironmentOverrides({ emulatedMedia: { print: true } })).toEqual({
      emulatedMedia: { print: true },
    });
  });
});
