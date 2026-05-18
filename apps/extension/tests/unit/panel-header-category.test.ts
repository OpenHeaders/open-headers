import {
  categorizeHeader,
  HEADER_CATEGORY_LABEL,
  HEADER_CATEGORY_ORDER,
  type HeaderCategory,
} from '@openheaders/ui/panel/data/header-category';
import { describe, expect, it } from 'vitest';

describe('categorizeHeader', () => {
  it('classifies authentication headers', () => {
    expect(categorizeHeader('Authorization')).toBe<HeaderCategory>('auth');
    expect(categorizeHeader('proxy-authorization')).toBe<HeaderCategory>('auth');
    expect(categorizeHeader('X-Api-Key')).toBe<HeaderCategory>('auth');
    expect(categorizeHeader('X-CSRF-Token')).toBe<HeaderCategory>('auth');
  });

  it('classifies CORS headers exactly and via prefix', () => {
    expect(categorizeHeader('Origin')).toBe<HeaderCategory>('cors');
    expect(categorizeHeader('Access-Control-Allow-Origin')).toBe<HeaderCategory>('cors');
    expect(categorizeHeader('Access-Control-Expose-Headers')).toBe<HeaderCategory>('cors');
    expect(categorizeHeader('access-control-something-new')).toBe<HeaderCategory>('cors');
  });

  it('classifies caching headers', () => {
    expect(categorizeHeader('Cache-Control')).toBe<HeaderCategory>('caching');
    expect(categorizeHeader('etag')).toBe<HeaderCategory>('caching');
    expect(categorizeHeader('Age')).toBe<HeaderCategory>('caching');
    expect(categorizeHeader('Pragma')).toBe<HeaderCategory>('caching');
  });

  it('classifies security headers including Sec-Fetch-* and Sec-CH-UA*', () => {
    expect(categorizeHeader('Content-Security-Policy')).toBe<HeaderCategory>('security');
    expect(categorizeHeader('Strict-Transport-Security')).toBe<HeaderCategory>('security');
    expect(categorizeHeader('Sec-Fetch-Mode')).toBe<HeaderCategory>('security');
    expect(categorizeHeader('sec-ch-ua-mobile')).toBe<HeaderCategory>('security');
  });

  it('classifies cookies, content, tracing', () => {
    expect(categorizeHeader('Set-Cookie')).toBe<HeaderCategory>('cookies');
    expect(categorizeHeader('Cookie')).toBe<HeaderCategory>('cookies');
    expect(categorizeHeader('Content-Type')).toBe<HeaderCategory>('content');
    expect(categorizeHeader('Server-Timing')).toBe<HeaderCategory>('tracing');
    expect(categorizeHeader('cf-ray')).toBe<HeaderCategory>('tracing');
  });

  it('falls back to other for unknown headers', () => {
    expect(categorizeHeader('X-Custom-Random')).toBe<HeaderCategory>('other');
    expect(categorizeHeader('Server')).toBe<HeaderCategory>('other');
  });

  it('exposes a stable rendering order with other last', () => {
    expect(HEADER_CATEGORY_ORDER[HEADER_CATEGORY_ORDER.length - 1]).toBe<HeaderCategory>('other');
    expect(new Set(HEADER_CATEGORY_ORDER).size).toBe(HEADER_CATEGORY_ORDER.length);
  });

  it('has a label for every category', () => {
    for (const cat of HEADER_CATEGORY_ORDER) {
      expect(HEADER_CATEGORY_LABEL[cat]).toBeTruthy();
    }
  });
});
