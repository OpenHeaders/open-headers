/**
 * `readTabSystemOverrides` — the SW-side validator/normalizer for the
 * per-tab override bag carried over the `setTabOverrides` RPC. It must validate
 * the struct facets, drop an `emulatedMedia` struct that pins nothing, and
 * collapse an all-empty bag to `null` so a cleared-to-empty payload never pins
 * an empty override.
 */

import { describe, expect, it } from 'vitest';
import { readTabSystemOverrides } from '../../src/types/cdp';

describe('readTabSystemOverrides', () => {
  it('returns null for null / undefined / unparseable input', () => {
    expect(readTabSystemOverrides(null)).toBeNull();
    expect(readTabSystemOverrides(undefined)).toBeNull();
    expect(readTabSystemOverrides({ userAgent: 42 })).toBeNull();
    expect(readTabSystemOverrides({ emulatedMedia: { colorScheme: 'sepia' } })).toBeNull();
  });

  it('collapses an all-empty bag to null', () => {
    expect(readTabSystemOverrides({})).toBeNull();
  });

  it('keeps the UA triple and the Emulation facets when pinned', () => {
    expect(
      readTabSystemOverrides({
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
    expect(readTabSystemOverrides({ locale: 'fr-FR', emulatedMedia: {} })).toEqual({ locale: 'fr-FR' });
    expect(readTabSystemOverrides({ locale: 'fr-FR', emulatedMedia: { print: false } })).toEqual({
      locale: 'fr-FR',
    });
  });

  it('collapses to null when the only facet is an empty media struct', () => {
    expect(readTabSystemOverrides({ emulatedMedia: {} })).toBeNull();
    expect(readTabSystemOverrides({ emulatedMedia: { print: false } })).toBeNull();
  });

  it('keeps a media struct that pins print only', () => {
    expect(readTabSystemOverrides({ emulatedMedia: { print: true } })).toEqual({
      emulatedMedia: { print: true },
    });
  });
});
