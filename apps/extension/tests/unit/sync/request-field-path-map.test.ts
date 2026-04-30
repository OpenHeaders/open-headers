import { describe, expect, it } from 'vitest';
import {
  REQUEST_METHOD_PATH,
  REQUEST_URL_PATH,
  type RequestTabKey,
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
