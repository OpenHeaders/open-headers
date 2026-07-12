import { describe, expect, it } from 'vitest';
import { getCatalog, getTranslator } from '../src/catalog-registry';
import { en } from '../src/catalogs/en';
import { DEFAULT_LOCALE, LOCALES, PSEUDO_LOCALE } from '../src/locales';

describe('getCatalog', () => {
  it('returns the source catalog for the default locale', () => {
    expect(getCatalog(DEFAULT_LOCALE)).toBe(en);
  });

  it('derives and memoizes the pseudo catalog', () => {
    const first = getCatalog(PSEUDO_LOCALE);
    expect(first).not.toBe(en);
    expect(getCatalog(PSEUDO_LOCALE)).toBe(first);
  });

  it('keeps every locale catalog key-identical to English (parity gate)', () => {
    const sourceKeys = Object.keys(en).sort();
    for (const def of LOCALES) {
      expect(Object.keys(getCatalog(def.code)).sort(), `catalog "${def.code}"`).toEqual(sourceKeys);
    }
  });
});

describe('getTranslator', () => {
  it('memoizes per locale', () => {
    expect(getTranslator('en')).toBe(getTranslator('en'));
    expect(getTranslator('en')).not.toBe(getTranslator(PSEUDO_LOCALE));
  });

  it('translates English verbatim and pseudo accented', () => {
    expect(getTranslator('en')('shared.action.save')).toBe('Save');
    const pseudo = getTranslator(PSEUDO_LOCALE)('shared.action.save');
    expect(pseudo.startsWith('⟦')).toBe(true);
    expect(pseudo).not.toContain('Save');
  });

  it('runs plural function messages per locale', () => {
    expect(getTranslator('en')('shared.count.rules', { count: 1 })).toBe('1 rule');
    expect(getTranslator('en')('shared.count.rules', { count: 2 })).toBe('2 rules');
  });
});
