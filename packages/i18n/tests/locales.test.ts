import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, getLocaleDef, LOCALES, PSEUDO_LOCALE, resolveLocale } from '../src/locales';

describe('locale registry', () => {
  it('includes the default locale', () => {
    expect(getLocaleDef(DEFAULT_LOCALE)).toBeDefined();
  });

  it('marks pseudo as synthetic', () => {
    expect(getLocaleDef(PSEUDO_LOCALE)?.synthetic).toBe(true);
  });

  it('gives every locale a direction and both names', () => {
    for (const def of LOCALES) {
      expect(def.direction === 'ltr' || def.direction === 'rtl').toBe(true);
      expect(def.englishName.length).toBeGreaterThan(0);
      expect(def.nativeName.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLocale', () => {
  it('returns an explicit known setting verbatim', () => {
    expect(resolveLocale('en', ['fr'])).toBe('en');
    expect(resolveLocale(PSEUDO_LOCALE)).toBe(PSEUDO_LOCALE);
  });

  it('falls back to the default for an unknown explicit setting', () => {
    expect(resolveLocale('tlh')).toBe(DEFAULT_LOCALE);
  });

  it('auto-resolves an exact preference match', () => {
    expect(resolveLocale('auto', ['en'])).toBe('en');
  });

  it('auto-resolves a regional preference to its base language', () => {
    expect(resolveLocale('auto', ['en-GB', 'en-US'])).toBe('en');
  });

  it('never auto-resolves to a synthetic locale', () => {
    expect(resolveLocale('auto', [PSEUDO_LOCALE, 'en'])).toBe('en');
  });

  it('falls back to the default when nothing matches', () => {
    expect(resolveLocale('auto', ['tlh-KL'])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('auto', [])).toBe(DEFAULT_LOCALE);
  });
});
