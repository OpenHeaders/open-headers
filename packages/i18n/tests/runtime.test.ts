import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTranslator,
  formatMessage,
  getDateTimeFormat,
  getNumberFormat,
  getPluralRules,
  plural,
  setMissingKeyHandler,
} from '../src/runtime';
import type { Catalog } from '../src/types';

const source: Catalog = {
  'test.plain': 'Plain message',
  'test.args': 'Rule {name} saved to {collection}',
  'test.fn': ({ count }, locale) => plural(locale, Number(count), { one: '{count} rule', other: '{count} rules' }),
};

const translated: Catalog = {
  'test.plain': 'Nachricht',
};

describe('formatMessage', () => {
  it('interpolates named placeholders', () => {
    expect(formatMessage('Hello {name}', { name: 'openheaders.io' })).toBe('Hello openheaders.io');
  });

  it('stringifies numeric args', () => {
    expect(formatMessage('{count} items', { count: 3 })).toBe('3 items');
  });

  it('leaves unknown placeholders verbatim', () => {
    expect(formatMessage('Hello {name}', { other: 'x' })).toBe('Hello {name}');
  });

  it('returns the template untouched without args', () => {
    expect(formatMessage('Hello {name}')).toBe('Hello {name}');
  });
});

describe('createTranslator', () => {
  beforeEach(() => setMissingKeyHandler(undefined));

  it('resolves messages from the catalog', () => {
    const t = createTranslator('de', translated, source);
    expect(t('test.plain')).toBe('Nachricht');
  });

  it('falls back to the source catalog on a missing key', () => {
    const t = createTranslator('de', translated, source);
    expect(t('test.args', { name: 'Auth', collection: 'Staging' })).toBe('Rule Auth saved to Staging');
  });

  it('returns the key itself when no catalog has it', () => {
    const t = createTranslator('en', source, source);
    expect(t('test.unknown')).toBe('test.unknown');
  });

  it('never double-reports for the source locale', () => {
    const missing = vi.fn();
    setMissingKeyHandler(missing);
    const t = createTranslator('en', source, source);
    t('test.plain');
    expect(missing).not.toHaveBeenCalled();
  });

  it('reports fallback hits and total misses to the handler', () => {
    const missing = vi.fn();
    setMissingKeyHandler(missing);
    const t = createTranslator('de', translated, source);
    t('test.args', { name: 'a', collection: 'b' });
    t('test.gone');
    expect(missing).toHaveBeenCalledWith('test.args', 'de');
    expect(missing).toHaveBeenCalledWith('test.gone', 'de');
  });

  it('invokes function messages with args and locale', () => {
    const t = createTranslator('en', source, source);
    expect(t('test.fn', { count: 1 })).toBe('1 rule');
    expect(t('test.fn', { count: 5 })).toBe('5 rules');
  });

  it('exposes its locale', () => {
    expect(createTranslator('en', source, source).locale).toBe('en');
  });
});

describe('Intl caches', () => {
  it('returns the same formatter instance for identical inputs', () => {
    expect(getNumberFormat('en')).toBe(getNumberFormat('en'));
    expect(getDateTimeFormat('en', { hour: '2-digit' })).toBe(getDateTimeFormat('en', { hour: '2-digit' }));
    expect(getPluralRules('en')).toBe(getPluralRules('en'));
  });

  it('distinguishes formatter options', () => {
    expect(getNumberFormat('en')).not.toBe(getNumberFormat('en', { style: 'percent' }));
  });

  it('maps the pseudo locale to English CLDR data', () => {
    expect(getPluralRules('pseudo').select(1)).toBe('one');
  });
});

describe('plural', () => {
  it('selects the CLDR form and interpolates the count', () => {
    expect(plural('en', 0, { one: '{count} rule', other: '{count} rules' })).toBe('0 rules');
    expect(plural('en', 1, { one: '{count} rule', other: '{count} rules' })).toBe('1 rule');
  });

  it('falls back to the other form when a specific form is absent', () => {
    expect(plural('en', 1, { other: '{count} rules' })).toBe('1 rules');
  });
});
