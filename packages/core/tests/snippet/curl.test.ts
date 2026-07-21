/**
 * Copy-as-cURL formatter — wire-shape → runnable POSIX command.
 *
 * Each test builds a resolved `WireSnippetRequest` and asserts the
 * emitted flags: method/header/body mapping per body variant, POSIX
 * quoting, the multipart Content-Type drop, and the native-flag
 * mapping for SigV4 / digest auth.
 */

import { describe, expect, it } from 'vitest';
import type { WireSnippetRequest } from '../../src/snippet';
import { formatCurlSnippet } from '../../src/snippet';

function wire(overrides: Partial<WireSnippetRequest> = {}): WireSnippetRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/things',
    headers: [],
    body: { type: 'none' },
    ...overrides,
  };
}

describe('formatCurlSnippet', () => {
  it('emits a bare GET as curl + url only', () => {
    expect(formatCurlSnippet(wire())).toBe("curl 'https://api.openheaders.io/v1/things'");
  });

  it('adds -X for non-GET methods and -H per header', () => {
    const out = formatCurlSnippet(
      wire({
        method: 'POST',
        headers: [
          { key: 'Authorization', value: 'Bearer tok' },
          { key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"name":"hello"}' },
      }),
    );
    expect(out).toBe(
      "curl 'https://api.openheaders.io/v1/things' \\\n" +
        "  -X 'POST' \\\n" +
        "  -H 'Authorization: Bearer tok' \\\n" +
        "  -H 'Content-Type: application/json' \\\n" +
        `  --data-raw '{"name":"hello"}'`,
    );
  });

  it('escapes single quotes POSIX-style', () => {
    const out = formatCurlSnippet(wire({ url: "https://api.openheaders.io/it's" }));
    expect(out).toBe("curl 'https://api.openheaders.io/it'\\''s'");
  });

  it('folds graphql bodies into the {"query","variables"} wire JSON', () => {
    const out = formatCurlSnippet(
      wire({
        method: 'POST',
        body: { type: 'graphql', content: 'query { me }', graphqlVariables: '{"id":1}' },
      }),
    );
    expect(out).toContain(`--data-raw '{"query":"query { me }","variables":{"id":1}}'`);
  });

  it('omits invalid graphql variables JSON instead of shipping garbage', () => {
    const out = formatCurlSnippet(
      wire({ method: 'POST', body: { type: 'graphql', content: 'query { me }', graphqlVariables: '{oops' } }),
    );
    expect(out).toContain(`--data-raw '{"query":"query { me }"}'`);
  });

  it('renders enabled form fields as --data-urlencode and skips disabled rows', () => {
    const out = formatCurlSnippet(
      wire({
        method: 'POST',
        body: {
          type: 'form',
          formParts: [
            { uid: 'f1', key: 'a', value: '1' },
            { uid: 'f2', key: 'b', value: '2', enabled: false },
          ],
        },
      }),
    );
    expect(out).toContain("--data-urlencode 'a=1'");
    expect(out).not.toContain('b=2');
  });

  it('renders multipart parts as -F, one flag per file ref, and drops the boundary-less Content-Type', () => {
    const out = formatCurlSnippet(
      wire({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'multipart/form-data' }],
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
    expect(out).not.toContain('Content-Type');
    expect(out).toContain("-F 'field=hello'");
    expect(out).toContain("-F 'photo=@logo.png;type=image/png'");
  });

  it('maps digest auth onto --digest --user', () => {
    const out = formatCurlSnippet(wire({ digest: { username: 'user', password: 'pass' } }));
    expect(out).toContain('--digest');
    expect(out).toContain("--user 'user:pass'");
  });

  it('maps SigV4 auth onto --aws-sigv4 with the session-token header', () => {
    const out = formatCurlSnippet(
      wire({
        awsSigV4: {
          accessKeyId: 'AKID',
          secretAccessKey: 'SECRET',
          sessionToken: 'STOK',
          service: 's3',
          region: 'eu-west-1',
        },
      }),
    );
    expect(out).toContain("--user 'AKID:SECRET'");
    expect(out).toContain("--aws-sigv4 'aws:amz:eu-west-1:s3'");
    expect(out).toContain("-H 'x-amz-security-token: STOK'");
  });
});
