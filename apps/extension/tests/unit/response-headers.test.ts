import {
  filterHeaderRows,
  serializeHeaderLines,
  withWireCookieHeaders,
} from '@openheaders/ui/workbench/components/request-editor/response/response-headers';
import { describe, expect, it } from 'vitest';

const HEADERS = [
  { key: 'cache-control', value: 'no-store' },
  { key: 'content-type', value: 'application/json; charset=utf-8' },
  { key: 'server', value: 'openheaders.io edge' },
  { key: 'x-request-id', value: 'abc-123' },
];

describe('filterHeaderRows', () => {
  it('keeps every row on a blank or whitespace-only query', () => {
    expect(filterHeaderRows(HEADERS, '')).toEqual(HEADERS);
    expect(filterHeaderRows(HEADERS, '   ')).toEqual(HEADERS);
  });

  it('matches name substrings case-insensitively', () => {
    expect(filterHeaderRows(HEADERS, 'CONTENT')).toEqual([HEADERS[1]]);
    expect(filterHeaderRows(HEADERS, 'x-req')).toEqual([HEADERS[3]]);
  });

  it('matches value substrings case-insensitively', () => {
    expect(filterHeaderRows(HEADERS, 'JSON')).toEqual([HEADERS[1]]);
    expect(filterHeaderRows(HEADERS, 'openheaders.io')).toEqual([HEADERS[2]]);
  });

  it('trims the query before matching', () => {
    expect(filterHeaderRows(HEADERS, '  abc-123  ')).toEqual([HEADERS[3]]);
  });

  it('returns empty when nothing matches', () => {
    expect(filterHeaderRows(HEADERS, 'set-cookie')).toEqual([]);
  });

  it('preserves snapshot order in the filtered result', () => {
    expect(filterHeaderRows(HEADERS, 'c').map((h) => h.key)).toEqual(['cache-control', 'content-type', 'x-request-id']);
  });
});

describe('serializeHeaderLines', () => {
  it('serializes rows to name: value lines', () => {
    expect(serializeHeaderLines(HEADERS.slice(0, 2))).toBe(
      'cache-control: no-store\ncontent-type: application/json; charset=utf-8',
    );
  });

  it('serializes an empty list to an empty string', () => {
    expect(serializeHeaderLines([])).toBe('');
  });
});

describe('withWireCookieHeaders', () => {
  it('appends one set-cookie row per wire line, in arrival order', () => {
    const merged = withWireCookieHeaders(HEADERS, [
      'oh_cred=present; Path=/; SameSite=None; Secure',
      'oh_hop=1; Path=/',
    ]);
    expect(merged).toHaveLength(HEADERS.length + 2);
    expect(merged.slice(HEADERS.length)).toEqual([
      { key: 'set-cookie', value: 'oh_cred=present; Path=/; SameSite=None; Secure' },
      { key: 'set-cookie', value: 'oh_hop=1; Path=/' },
    ]);
  });

  it('returns the rows unchanged when the capture saw no cookies', () => {
    expect(withWireCookieHeaders(HEADERS, undefined)).toEqual(HEADERS);
    expect(withWireCookieHeaders(HEADERS, [])).toEqual(HEADERS);
  });
});
