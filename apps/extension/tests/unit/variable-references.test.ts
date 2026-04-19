import { describe, expect, it } from 'vitest';
import { collectTemplateStrings, TEMPLATE_RX } from '@/rules/variable-references';

describe('variable-references / TEMPLATE_RX', () => {
  it('matches a basic template reference', () => {
    expect(TEMPLATE_RX.test('Bearer {{TOKEN}}')).toBe(true);
  });

  it('matches a namespaced reference', () => {
    expect(TEMPLATE_RX.test('{{env.API_URL}}')).toBe(true);
  });

  it('does not match plain text', () => {
    expect(TEMPLATE_RX.test('no template here')).toBe(false);
  });

  it('does not match an unclosed brace', () => {
    expect(TEMPLATE_RX.test('{{UNCLOSED')).toBe(false);
  });
});

describe('variable-references / collectTemplateStrings', () => {
  it('collects matching strings from a flat object', () => {
    const out: string[] = [];
    collectTemplateStrings({ a: '{{A}}', b: 'plain', c: 'Bearer {{B}}' }, out);
    expect(out).toEqual(['{{A}}', 'Bearer {{B}}']);
  });

  it('walks arrays recursively', () => {
    const out: string[] = [];
    collectTemplateStrings([['{{A}}'], { x: '{{B}}' }, 'plain'], out);
    expect(out).toEqual(['{{A}}', '{{B}}']);
  });

  it('walks nested structures (rule-shaped input)', () => {
    const rule = {
      conditions: [{ type: 'request-domains', values: ['{{HOST}}', 'static.example.com'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Token', value: 'Bearer {{TOKEN}}' }],
      },
    };
    const out: string[] = [];
    collectTemplateStrings(rule, out);
    expect(out).toEqual(['{{HOST}}', 'Bearer {{TOKEN}}']);
  });

  it('skips non-string/array/object leaves', () => {
    const out: string[] = [];
    collectTemplateStrings({ n: 42, b: true, nil: null, s: '{{S}}' }, out);
    expect(out).toEqual(['{{S}}']);
  });

  it('returns empty for inputs with no templates', () => {
    const out: string[] = [];
    collectTemplateStrings({ a: 'foo', b: ['bar'], c: { d: 'baz' } }, out);
    expect(out).toEqual([]);
  });

  it('preserves duplicates — caller owns dedupe', () => {
    const out: string[] = [];
    collectTemplateStrings({ a: '{{X}}', b: '{{X}}' }, out);
    expect(out).toEqual(['{{X}}', '{{X}}']);
  });
});
