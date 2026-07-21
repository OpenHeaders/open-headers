/**
 * Copy-as-fetch formatter — wire-shape → fetch() call text.
 *
 * Asserts the init composition per body variant (string bodies, the
 * urlencoded form fold with its explicit Content-Type, the FormData
 * prologue for multipart) and the not-expressible comments for
 * wire-signing auth.
 */

import { describe, expect, it } from 'vitest';
import type { WireSnippetRequest } from '../../src/snippet';
import { formatFetchSnippet } from '../../src/snippet';

function wire(overrides: Partial<WireSnippetRequest> = {}): WireSnippetRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/things',
    headers: [],
    body: { type: 'none' },
    ...overrides,
  };
}

describe('formatFetchSnippet', () => {
  it('emits a bare GET without an init object', () => {
    expect(formatFetchSnippet(wire())).toBe('fetch("https://api.openheaders.io/v1/things")');
  });

  it('composes method, headers, and a string body', () => {
    const out = formatFetchSnippet(
      wire({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"name":"hello"}' },
      }),
    );
    expect(out).toBe(
      'fetch("https://api.openheaders.io/v1/things", {\n' +
        '  "method": "POST",\n' +
        '  "headers": {\n' +
        '    "Content-Type": "application/json"\n' +
        '  },\n' +
        '  "body": "{\\"name\\":\\"hello\\"}"\n' +
        '})',
    );
  });

  it('serializes form bodies urlencoded and makes the Content-Type explicit', () => {
    const out = formatFetchSnippet(
      wire({
        method: 'POST',
        body: {
          type: 'form',
          formParts: [
            { uid: 'f1', key: 'a', value: '1' },
            { uid: 'f2', key: 'b c', value: '2&3' },
            { uid: 'f3', key: 'off', value: 'x', enabled: false },
          ],
        },
      }),
    );
    expect(out).toContain('"Content-Type": "application/x-www-form-urlencoded"');
    expect(out).toContain('"body": "a=1&b+c=2%263"');
    expect(out).not.toContain('off=');
  });

  it('emits a FormData prologue for multipart bodies', () => {
    const out = formatFetchSnippet(
      wire({
        method: 'POST',
        body: {
          type: 'multipart',
          multipartParts: [
            { kind: 'text', uid: 'p1', name: 'field', value: 'hello' },
            {
              kind: 'file',
              uid: 'p2',
              name: 'photo',
              fileRefs: [
                {
                  fileId: 'file:1',
                  hash: `sha256:${'a'.repeat(64)}`,
                  filename: 'logo.png',
                  mimeType: 'image/png',
                  size: 10,
                },
              ],
            },
          ],
        },
      }),
    );
    expect(out).toContain('const formData = new FormData();');
    expect(out).toContain('formData.append("field", "hello");');
    expect(out).toContain('// "photo": attach logo.png as a File/Blob here');
    expect(out).toContain('"body": formData');
  });

  it('notes that SigV4 signing is not expressible in fetch', () => {
    const out = formatFetchSnippet(
      wire({
        awsSigV4: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', service: 's3', region: 'eu-west-1' },
      }),
    );
    expect(out).toContain('// AWS SigV4 signing is not expressible in fetch()');
  });

  it('notes that digest auth is not expressible in fetch', () => {
    const out = formatFetchSnippet(wire({ digest: { username: 'u', password: 'p' } }));
    expect(out).toContain('// HTTP digest auth is not expressible in fetch()');
  });
});
