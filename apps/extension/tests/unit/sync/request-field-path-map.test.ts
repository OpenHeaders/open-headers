import { describe, expect, it } from 'vitest';
import {
  REQUEST_METHOD_PATH,
  REQUEST_URL_PATH,
  type RequestTabKey,
  requestRowPath,
  tabKeyToRequestFieldPath,
} from '@/workbench/components/request-field-path-map';

describe('tabKeyToRequestFieldPath', () => {
  it('maps every tab key to a canonical schema-aligned path', () => {
    const cases: Array<[RequestTabKey, string]> = [
      ['docs', 'description'],
      ['params', 'params'],
      ['authorization', 'auth'],
      ['headers', 'headers'],
      ['body', 'body'],
      ['scripts', 'scripts'],
      ['settings', 'settings'],
    ];
    for (const [tab, expected] of cases) {
      expect(tabKeyToRequestFieldPath(tab)).toBe(expected);
    }
  });

  it('exports stable url + method path constants', () => {
    expect(REQUEST_URL_PATH).toBe('url');
    expect(REQUEST_METHOD_PATH).toBe('method');
  });
});

describe('requestRowPath', () => {
  it('builds canonical schema-aligned per-row paths for headers', () => {
    expect(requestRowPath('headers', 0, 'key')).toBe('headers.0.key');
    expect(requestRowPath('headers', 2, 'value')).toBe('headers.2.value');
    expect(requestRowPath('headers', 9, 'description')).toBe('headers.9.description');
  });

  it('builds canonical schema-aligned per-row paths for params', () => {
    expect(requestRowPath('params', 0, 'value')).toBe('params.0.value');
    expect(requestRowPath('params', 5, 'key')).toBe('params.5.key');
    expect(requestRowPath('params', 1, 'description')).toBe('params.1.description');
  });

  it('keeps headers and params namespaces independent', () => {
    expect(requestRowPath('headers', 0, 'value')).not.toBe(requestRowPath('params', 0, 'value'));
  });
});
