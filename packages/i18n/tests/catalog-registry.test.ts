import { describe, expect, it } from 'vitest';
import { getCatalog, getTranslator, isCatalogLoaded, loadCatalog } from '../src/catalog-registry';
import { en } from '../src/catalogs/en';
import { DEFAULT_LOCALE, LOCALES, PSEUDO_LOCALE } from '../src/locales';
import { createTranslator } from '../src/runtime';
import type { Catalog } from '../src/types';

describe('getCatalog', () => {
  it('returns the source catalog for the default locale', () => {
    expect(getCatalog(DEFAULT_LOCALE)).toBe(en);
  });

  it('derives and memoizes the pseudo catalog', () => {
    const first = getCatalog(PSEUDO_LOCALE);
    expect(first).not.toBe(en);
    expect(getCatalog(PSEUDO_LOCALE)).toBe(first);
  });

  it('keeps every locale catalog inside the English key set (parity gate)', async () => {
    // Real locales land file by file, so their catalogs may be a subset
    // of English (per-key fallback covers the rest); keys English does
    // not have are always a bug. Per-file key parity is enforced by
    // scripts/lint-locales.mjs.
    const sourceKeys = new Set(Object.keys(en));
    for (const def of LOCALES) {
      await loadCatalog(def.code);
      const foreign = Object.keys(getCatalog(def.code)).filter((key) => !sourceKeys.has(key));
      expect(foreign, `catalog "${def.code}"`).toEqual([]);
    }
  });
});

describe('loadCatalog', () => {
  it('treats synchronous locales as already loaded', () => {
    expect(isCatalogLoaded(DEFAULT_LOCALE)).toBe(true);
    expect(isCatalogLoaded(PSEUDO_LOCALE)).toBe(true);
  });

  it('treats locales without a catalog as loaded and resolves immediately', async () => {
    expect(isCatalogLoaded('xx')).toBe(true);
    await expect(loadCatalog('xx')).resolves.toBeUndefined();
    expect(getCatalog('xx')).toBe(en);
  });

  it('loads the French chunk and swaps the memoized translator', async () => {
    await loadCatalog('fr');
    expect(isCatalogLoaded('fr')).toBe(true);
    expect(getCatalog('fr')).not.toBe(en);
    expect(getTranslator('fr')('shared.action.save')).toBe('Enregistrer');
    expect(getTranslator('fr')('shared.count.rules', { count: 2 })).toBe('2 règles');
  });

  it('loads the German chunk and swaps the memoized translator', async () => {
    await loadCatalog('de');
    expect(isCatalogLoaded('de')).toBe(true);
    expect(getCatalog('de')).not.toBe(en);
    expect(getTranslator('de')('shared.action.save')).toBe('Speichern');
    expect(getTranslator('de')('shared.count.rules', { count: 2 })).toBe('2 Regeln');
  });

  it('loads the Simplified Chinese chunk and swaps the memoized translator', async () => {
    await loadCatalog('zh-CN');
    expect(isCatalogLoaded('zh-CN')).toBe(true);
    expect(getCatalog('zh-CN')).not.toBe(en);
    expect(getTranslator('zh-CN')('shared.action.save')).toBe('保存');
    expect(getTranslator('zh-CN')('shared.count.rules', { count: 2 })).toBe('2 条规则');
  });

  it('falls back to English per key while a locale catalog is partial', () => {
    const partial: Catalog = { 'shared.action.save': 'Enregistrer' };
    const t = createTranslator('fr', partial, en);
    expect(t('shared.action.save')).toBe('Enregistrer');
    expect(t('shared.action.cancel')).toBe(en['shared.action.cancel']);
  });

  it('serves French for every string key once the catalog is complete', async () => {
    await loadCatalog('fr');
    const frCatalog = getCatalog('fr');
    const pending = Object.keys(en).filter((key) => !(key in frCatalog));
    expect(pending).toEqual([]);
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
