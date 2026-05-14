import { isGenericMime, sniffContentFormat, sniffMisdeclared } from '@openheaders/ui/panel/data/content-sniff';
import { describe, expect, it } from 'vitest';

describe('isGenericMime', () => {
  it.each([
    // Genuinely generic — no format commitment from the server.
    ['', true],
    [undefined, true],
    [null, true],
    ['text/plain', true],
    ['text/plain; charset=utf-8', true],
    ['application/octet-stream', true],
    // Specific commitments — we trust the server.
    ['application/x-www-form-urlencoded', false],
    ['application/x-binary', false],
    ['application/json', false],
    ['application/json; charset=utf-8', false],
    ['text/html', false],
    ['application/xml', false],
    ['image/png', false],
    ['text/css', false],
  ])('%s -> %s', (mime, expected) => {
    expect(isGenericMime(mime as string | undefined | null)).toBe(expected);
  });
});

describe('sniffContentFormat', () => {
  it('detects a JSON object', () => {
    expect(sniffContentFormat('{"ok": true, "id": 42}')).toBe('json');
  });

  it('detects a JSON array', () => {
    expect(sniffContentFormat('[1, 2, 3]')).toBe('json');
  });

  it('detects whitespace-padded JSON', () => {
    expect(sniffContentFormat('  \n  { "x": 1 }  \n')).toBe('json');
  });

  it('does NOT classify malformed JSON as JSON', () => {
    expect(sniffContentFormat('{"unclosed":')).not.toBe('json');
  });

  it('does NOT classify a JSON-like number as JSON', () => {
    // `JSON.parse('42')` succeeds but scalars aren't structured data —
    // the leading-char guard keeps us honest.
    expect(sniffContentFormat('42')).toBeNull();
  });

  it('detects XML with decl', () => {
    expect(sniffContentFormat('<?xml version="1.0"?><root/>')).toBe('xml');
  });

  it('detects a bare XML document', () => {
    expect(sniffContentFormat('<user><id>1</id><name>alice</name></user>')).toBe('xml');
  });

  it('detects HTML via DOCTYPE', () => {
    expect(sniffContentFormat('<!DOCTYPE html><html><body>hi</body></html>')).toBe('html');
  });

  it('detects HTML via <html> lead', () => {
    expect(sniffContentFormat('<html><body>x</body></html>')).toBe('html');
  });

  it('detects form-urlencoded multi-pair', () => {
    expect(sniffContentFormat('username=alice&password=secret&remember=1')).toBe('form-urlencoded');
  });

  it('does NOT flag a single key=value pair as form-urlencoded (too ambiguous)', () => {
    // A single pair is often just prose (e.g. "timeout=30"). Require
    // at least one `&` separator to treat as form data.
    expect(sniffContentFormat('key=value')).toBeNull();
  });

  it('does NOT flag multi-line plain text as form-urlencoded', () => {
    expect(sniffContentFormat('key=value\nother=line')).toBeNull();
  });

  it('detects base64 when long enough and of length %% 4 === 0', () => {
    const bytes = 'openheaders'.repeat(10);
    const b64 = Buffer.from(bytes).toString('base64');
    expect(sniffContentFormat(b64)).toBe('base64');
  });

  it('does NOT flag short all-alpha strings as base64', () => {
    expect(sniffContentFormat('ABCD')).toBeNull();
    expect(sniffContentFormat('hello world how are you today friend ok')).toBeNull();
  });

  it('returns null on empty / too-short / prose input', () => {
    expect(sniffContentFormat('')).toBeNull();
    expect(sniffContentFormat(' ')).toBeNull();
    expect(sniffContentFormat('x')).toBeNull();
    expect(sniffContentFormat('Something failed — please retry.')).toBeNull();
  });
});

describe('sniffMisdeclared', () => {
  it('skips sniffing when the mime is specific', () => {
    expect(sniffMisdeclared('{"ok":true}', 'application/json')).toBeNull();
    expect(sniffMisdeclared('<html></html>', 'text/html')).toBeNull();
  });

  it('sniffs when the mime is generic', () => {
    expect(sniffMisdeclared('{"ok":true}', 'text/plain')).toBe('json');
    expect(sniffMisdeclared('<user/>', 'application/octet-stream')).toBe('xml');
  });

  it('sniffs when the mime is missing', () => {
    expect(sniffMisdeclared('{"ok":true}', undefined)).toBe('json');
  });

  it('returns null when both mime is generic and content is unrecognisable', () => {
    expect(sniffMisdeclared('plain prose description', 'text/plain')).toBeNull();
  });
});
