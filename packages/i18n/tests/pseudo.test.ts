import { describe, expect, it } from 'vitest';
import { pseudoizeCatalog, pseudoizeString } from '../src/pseudo';
import type { Catalog } from '../src/types';

describe('pseudoizeString', () => {
  it('accents letters and wraps in delimiters', () => {
    const out = pseudoizeString('Save');
    expect(out.startsWith('⟦')).toBe(true);
    expect(out.endsWith('⟧')).toBe(true);
    expect(out).toContain('Šáṽé');
  });

  it('expands length by roughly a third', () => {
    const source = 'Search settings';
    const out = pseudoizeString(source);
    expect(out.length).toBeGreaterThan(source.length * 1.3);
  });

  it('preserves placeholders untouched', () => {
    const out = pseudoizeString('Rule {name} saved to {collection}');
    expect(out).toContain('{name}');
    expect(out).toContain('{collection}');
  });
});

describe('pseudoizeCatalog', () => {
  const source: Catalog = {
    plain: 'Hello {name}',
    fn: ({ count }) => `${count} rules`,
  };

  it('transforms every string message', () => {
    const pseudo = pseudoizeCatalog(source);
    expect(Object.keys(pseudo)).toEqual(Object.keys(source));
    expect(pseudo.plain).toContain('{name}');
    expect(pseudo.plain).not.toBe(source.plain);
  });

  it('wraps function messages so their output pseudoizes', () => {
    const pseudo = pseudoizeCatalog(source);
    const fn = pseudo.fn;
    if (typeof fn !== 'function') throw new Error('expected a function message');
    const out = fn({ count: 2 }, 'pseudo');
    expect(out.startsWith('⟦')).toBe(true);
    expect(out).toContain('2');
  });
});
